"""
OpenComp - ColorCorrect, Blur & Transform Nodes
"""

import numpy as np
from typing import Dict, Optional
from PIL import Image, ImageFilter
from ..core.node import Node
from ..core.pixel_buffer import PixelBuffer


class ColorCorrectNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "ColorCorrect", "Color", x, y)
        self.add_input("in", "Input")
        self.add_input("mask", "mask")

        self.add_knob("saturation", "Saturation", "float", 1.0, min_val=0.0, max_val=4.0, step=0.01)
        self.add_knob("contrast", "Contrast", "float", 1.0, min_val=0.0, max_val=3.0, step=0.01)
        self.add_knob("gamma", "Gamma", "float", 1.0, min_val=0.1, max_val=4.0, step=0.01)
        self.add_knob("gain", "Gain", "float", 1.0, min_val=0.0, max_val=4.0, step=0.01)
        self.add_knob("offset", "Offset", "float", 0.0, min_val=-1.0, max_val=1.0, step=0.01)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        buf_in = input_buffers.get("in")
        if not buf_in:
            return None

        w, h = buf_in.width, buf_in.height
        mask_buf = input_buffers.get("mask")
        res_mask = mask_buf.resample(w, h) if (mask_buf and (mask_buf.width != w or mask_buf.height != h)) else mask_buf

        src = buf_in.data
        sat = float(self.get_knob("saturation", 1.0))
        contrast = float(self.get_knob("contrast", 1.0))
        gamma = max(0.0001, float(self.get_knob("gamma", 1.0)))
        gain = float(self.get_knob("gain", 1.0))
        offset = float(self.get_knob("offset", 0.0))

        rgb = src[:, :, :3].copy()

        # 1. Saturation
        luma = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])[:, :, None]
        rgb = luma + sat * (rgb - luma)

        # 2. Contrast around middle gray (0.18)
        rgb = 0.18 + contrast * (rgb - 0.18)

        # 3. Gamma
        inv_gamma = 1.0 / gamma
        rgb = np.where(rgb > 0, np.power(np.maximum(rgb, 0.0), inv_gamma), rgb)

        # 4. Gain and Offset
        rgb = rgb * gain + offset

        # Mask blending
        if res_mask:
            m = res_mask.data[:, :, 3:4]
            rgb = src[:, :, :3] * (1.0 - m) + rgb * m

        out_data = np.concatenate([rgb, src[:, :, 3:4]], axis=2)
        return PixelBuffer(w, h, out_data)


class BlurNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "Blur", "Filter", x, y)
        self.add_input("in", "Input")
        self.add_knob("size", "Size", "float", 15.0, min_val=0.0, max_val=150.0, step=0.5)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        buf_in = input_buffers.get("in")
        if not buf_in:
            return None

        size = float(self.get_knob("size", 15.0))
        if size <= 0.1:
            return buf_in.clone()

        # Gaussian Blur via Pillow image filter for fast multi-channel float
        arr = (buf_in.data * 255.0).clip(0, 255).astype(np.uint8)
        img = Image.fromarray(arr, mode="RGBA")
        blurred = img.filter(ImageFilter.GaussianBlur(radius=size))
        out_data = np.array(blurred, dtype=np.float32) / 255.0
        return PixelBuffer(buf_in.width, buf_in.height, out_data)
