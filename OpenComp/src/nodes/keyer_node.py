"""
OpenComp - Keyer & Viewer Nodes
"""

import numpy as np
from typing import Dict, Optional
from ..core.node import Node
from ..core.pixel_buffer import PixelBuffer


class KeyerNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "Keyer", "Keyer", x, y)
        self.add_input("in", "Input")

        self.add_knob("key_type", "Key Type", "choice", "chroma_green", choices=["chroma_green", "chroma_blue", "luma"])
        self.add_knob("tolerance", "Tolerance", "float", 0.28, min_val=0.01, max_val=1.0, step=0.01)
        self.add_knob("softness", "Softness", "float", 0.15, min_val=0.0, max_val=0.8, step=0.01)
        self.add_knob("clip_black", "Clip Black", "float", 0.05, min_val=0.0, max_val=0.5, step=0.01)
        self.add_knob("clip_white", "Clip White", "float", 0.95, min_val=0.5, max_val=1.0, step=0.01)
        self.add_knob("despill", "Despill", "float", 1.0, min_val=0.0, max_val=1.5, step=0.05)
        self.add_knob("output_mode", "Output View", "choice", "composite", choices=["composite", "matte", "despill"])

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        buf_in = input_buffers.get("in")
        if not buf_in:
            return None

        key_type = self.get_knob("key_type", "chroma_green")
        tol = max(0.001, float(self.get_knob("tolerance", 0.28)))
        soft = max(0.001, float(self.get_knob("softness", 0.15)))
        clip_b = float(self.get_knob("clip_black", 0.05))
        clip_w = max(clip_b + 0.01, float(self.get_knob("clip_white", 0.95)))
        despill = float(self.get_knob("despill", 1.0))
        out_mode = self.get_knob("output_mode", "composite")

        src = buf_in.data.copy()
        r = src[:, :, 0]
        g = src[:, :, 1]
        b = src[:, :, 2]
        a = src[:, :, 3]

        if key_type == "chroma_green":
            max_other = np.maximum(r, b)
            green_delta = g - max_other
            raw_matte = np.where(green_delta > 0, 1.0 - (green_delta / tol), 1.0)

            # Despill: neutralize excess green reflections
            if despill > 0:
                excess = np.maximum(0.0, (g - max_other) * despill)
                g = np.maximum(0.0, g - excess)
                src[:, :, 1] = g

        elif key_type == "chroma_blue":
            max_other = np.maximum(r, g)
            blue_delta = b - max_other
            raw_matte = np.where(blue_delta > 0, 1.0 - (blue_delta / tol), 1.0)

            if despill > 0:
                excess = np.maximum(0.0, (b - max_other) * despill)
                b = np.maximum(0.0, b - excess)
                src[:, :, 2] = b

        else:  # luma
            luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
            raw_matte = (luma - tol) / soft

        # Curve mapping & clamping
        matte = np.clip(raw_matte, 0.0, 1.0)
        matte = np.where(matte <= clip_b, 0.0, np.where(matte >= clip_w, 1.0, (matte - clip_b) / (clip_w - clip_b)))
        matte = matte * a  # combine with input alpha

        if out_mode == "matte":
            out_rgb = np.dstack([matte, matte, matte])
            out_alpha = np.ones_like(matte)[:, :, None]
        elif out_mode == "despill":
            out_rgb = src[:, :, :3]
            out_alpha = a[:, :, None]
        else:  # composite (premultiplied)
            out_rgb = src[:, :, :3] * matte[:, :, None]
            out_alpha = matte[:, :, None]

        out_data = np.concatenate([out_rgb, out_alpha], axis=2)
        return PixelBuffer(buf_in.width, buf_in.height, out_data)


class ViewerNode(Node):
    def __init__(self, node_id: str = "Viewer1", x: float = 0, y: float = 0):
        super().__init__(node_id, "Viewer", "Viewer", x, y)
        self.width = 110
        self.height = 42

        self.add_input("1", "1 (Main A)")
        self.add_input("2", "2 (Main B)")
        self.add_input("3", "3")
        self.add_input("4", "4")

        self.add_knob("active_input", "Active Input", "choice", "1", choices=["1", "2", "3", "4"])
        self.add_knob("compare_mode", "Compare Mode", "choice", "single", choices=["single", "wipe_h", "diff"])
        self.add_knob("wipe_pos", "Wipe Position", "float", 0.5, min_val=0.0, max_val=1.0, step=0.01)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        mode = self.get_knob("compare_mode", "single")
        active = str(self.get_knob("active_input", "1"))

        if mode == "single":
            return input_buffers.get(active) or input_buffers.get("1")

        # A/B Comparison
        buf_a = input_buffers.get("1")
        buf_b = input_buffers.get("2")

        if not buf_a and not buf_b:
            return None
        if not buf_a:
            return buf_b
        if not buf_b:
            return buf_a

        w, h = buf_a.width, buf_a.height
        res_b = buf_b if (buf_b.width == w and buf_b.height == h) else buf_b.resample(w, h)

        wipe_pos = float(self.get_knob("wipe_pos", 0.5))
        result = buf_a.clone()

        if mode == "wipe_h":
            split_x = int(w * wipe_pos)
            if 0 <= split_x < w:
                result.data[:, split_x:, :] = res_b.data[:, split_x:, :]
                # Draw divider line in orange
                result.data[:, split_x, :3] = np.array([1.0, 0.5, 0.0], dtype=np.float32)
        elif mode == "diff":
            diff = np.abs(buf_a.data[:, :, :3] - res_b.data[:, :, :3]) * 5.0
            result.data[:, :, :3] = diff

        return result
