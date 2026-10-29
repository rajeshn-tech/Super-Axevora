"""
OpenComp - Merge & Grade Nodes (NumPy Vectorized)
"""

import numpy as np
from typing import Dict, Optional
from ..core.node import Node
from ..core.pixel_buffer import PixelBuffer


class MergeNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "Merge", "Merge", x, y)
        self.add_input("B", "B (Background)")
        self.add_input("A", "A (Foreground)")
        self.add_input("mask", "mask")

        self.add_knob("operation", "Operation", "choice", "over", choices=[
            "over", "under", "plus", "multiply", "screen",
            "difference", "in", "out", "atop", "hypot", "xor"
        ])
        self.add_knob("mix", "Mix", "float", 1.0, min_val=0.0, max_val=1.0, step=0.01)
        self.add_knob("invert_mask", "Invert Mask", "bool", False)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        buf_b = input_buffers.get("B")
        buf_a = input_buffers.get("A")
        buf_mask = input_buffers.get("mask")

        if not buf_b and not buf_a:
            return None
        if not buf_b and buf_a:
            return buf_a.clone()
        if buf_b and not buf_a:
            return buf_b.clone()

        w, h = buf_b.width, buf_b.height
        res_a = buf_a if (buf_a.width == w and buf_a.height == h) else buf_a.resample(w, h)
        res_mask = buf_mask.resample(w, h) if (buf_mask and (buf_mask.width != w or buf_mask.height != h)) else buf_mask

        b = buf_b.data
        a = res_a.data
        op = self.get_knob("operation", "over")
        mix = float(self.get_knob("mix", 1.0))
        invert_mask = bool(self.get_knob("invert_mask", False))

        a_rgb = a[:, :, :3]
        a_alpha = a[:, :, 3:4]
        b_rgb = b[:, :, :3]
        b_alpha = b[:, :, 3:4]

        # Nuke compositing arithmetic
        if op == "over":
            out_rgb = a_rgb + b_rgb * (1.0 - a_alpha)
            out_alpha = a_alpha + b_alpha * (1.0 - a_alpha)
        elif op == "under":
            out_rgb = b_rgb + a_rgb * (1.0 - b_alpha)
            out_alpha = b_alpha + a_alpha * (1.0 - b_alpha)
        elif op == "plus":
            out_rgb = a_rgb + b_rgb
            out_alpha = a_alpha + b_alpha
        elif op == "multiply":
            out_rgb = a_rgb * b_rgb
            out_alpha = a_alpha * b_alpha
        elif op == "screen":
            out_rgb = a_rgb + b_rgb - a_rgb * b_rgb
            out_alpha = a_alpha + b_alpha - a_alpha * b_alpha
        elif op == "difference":
            out_rgb = np.abs(a_rgb - b_rgb)
            out_alpha = np.maximum(a_alpha, b_alpha)
        elif op == "in":
            out_rgb = a_rgb * b_alpha
            out_alpha = a_alpha * b_alpha
        elif op == "out":
            out_rgb = a_rgb * (1.0 - b_alpha)
            out_alpha = a_alpha * (1.0 - b_alpha)
        elif op == "atop":
            out_rgb = a_rgb * b_alpha + b_rgb * (1.0 - a_alpha)
            out_alpha = b_alpha
        elif op == "hypot":
            out_rgb = np.sqrt(a_rgb ** 2 + b_rgb ** 2)
            out_alpha = np.maximum(a_alpha, b_alpha)
        elif op == "xor":
            out_rgb = a_rgb * (1.0 - b_alpha) + b_rgb * (1.0 - a_alpha)
            out_alpha = a_alpha + b_alpha - 2.0 * a_alpha * b_alpha
        else:
            out_rgb = a_rgb + b_rgb * (1.0 - a_alpha)
            out_alpha = a_alpha + b_alpha * (1.0 - a_alpha)

        # Mask blending
        blend_weight = mix
        if res_mask:
            m = res_mask.data[:, :, 3:4]
            if invert_mask:
                m = 1.0 - m
            blend_weight = blend_weight * m

        final_rgb = b_rgb * (1.0 - blend_weight) + out_rgb * blend_weight
        final_alpha = b_alpha * (1.0 - blend_weight) + out_alpha * blend_weight

        out_data = np.concatenate([final_rgb, final_alpha], axis=2)
        return PixelBuffer(w, h, out_data)


class GradeNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "Grade", "Color", x, y)
        self.add_input("in", "Input")
        self.add_input("mask", "mask")

        self.add_knob("blackpoint", "Blackpoint", "float", 0.0, min_val=-1.0, max_val=2.0, step=0.01)
        self.add_knob("whitepoint", "Whitepoint", "float", 1.0, min_val=0.01, max_val=5.0, step=0.01)
        self.add_knob("lift", "Lift", "float", 0.0, min_val=-1.0, max_val=2.0, step=0.01)
        self.add_knob("gain", "Gain", "float", 1.0, min_val=0.0, max_val=5.0, step=0.01)
        self.add_knob("multiply", "Multiply", "float", 1.0, min_val=0.0, max_val=5.0, step=0.01)
        self.add_knob("offset", "Offset", "float", 0.0, min_val=-1.0, max_val=1.0, step=0.005)
        self.add_knob("gamma", "Gamma", "float", 1.0, min_val=0.1, max_val=4.0, step=0.01)
        self.add_knob("black_clamp", "Black Clamp", "bool", True)
        self.add_knob("white_clamp", "White Clamp", "bool", False)
        self.add_knob("reverse", "Reverse", "bool", False)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        buf_in = input_buffers.get("in")
        if not buf_in:
            return None

        w, h = buf_in.width, buf_in.height
        mask_buf = input_buffers.get("mask")
        res_mask = mask_buf.resample(w, h) if (mask_buf and (mask_buf.width != w or mask_buf.height != h)) else mask_buf

        src = buf_in.data
        bp = float(self.get_knob("blackpoint", 0.0))
        wp = max(0.0001, float(self.get_knob("whitepoint", 1.0)))
        lift = float(self.get_knob("lift", 0.0))
        gain = float(self.get_knob("gain", 1.0))
        mult = float(self.get_knob("multiply", 1.0))
        offset = float(self.get_knob("offset", 0.0))
        gamma = max(0.0001, float(self.get_knob("gamma", 1.0)))
        b_clamp = bool(self.get_knob("black_clamp", True))
        w_clamp = bool(self.get_knob("white_clamp", False))
        reverse = bool(self.get_knob("reverse", False))

        # Nuke Grade Terms
        denom = (wp - bp) if (wp - bp) != 0 else 0.00001
        A = mult * (gain - lift) / denom
        B = offset + lift - A * bp
        inv_gamma = 1.0 / gamma

        rgb = src[:, :, :3].copy()
        if not reverse:
            rgb = A * rgb + B
            rgb = np.where(rgb > 0, np.power(np.maximum(rgb, 0.0), inv_gamma), rgb)
        else:
            rgb = np.where(rgb > 0, np.power(np.maximum(rgb, 0.0), gamma), rgb)
            if A != 0:
                rgb = (rgb - B) / A

        if b_clamp:
            rgb = np.maximum(rgb, 0.0)
        if w_clamp:
            rgb = np.minimum(rgb, 1.0)

        # Apply mask
        if res_mask:
            m = res_mask.data[:, :, 3:4]
            rgb = src[:, :, :3] * (1.0 - m) + rgb * m

        out_data = np.concatenate([rgb, src[:, :, 3:4]], axis=2)
        return PixelBuffer(w, h, out_data)
