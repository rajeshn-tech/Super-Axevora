"""
OpenComp - Base Node Class (Python / PySide6)
Defines inputs, outputs, knobs, dirty flag caching, and execution contracts.
"""

from typing import Dict, List, Optional, Any
from .pixel_buffer import PixelBuffer


class Node:
    CATEGORY_COLORS = {
        "Image": "#705030",      # Read, Write, Constant (Brown/Orange)
        "Color": "#6e6a30",      # Grade, ColorCorrect (Olive Yellow)
        "Filter": "#305575",     # Blur, Glow (Blue)
        "Merge": "#2f663c",      # Merge, ChannelMerge (Green)
        "Transform": "#6e3570",  # Transform, Crop (Magenta)
        "Keyer": "#2b6363",      # ChromaKeyer, LumaKeyer (Teal)
        "Channel": "#355b6e",    # Roto, Shuffle (Cyan)
        "Viewer": "#505050",     # Viewer (Gray)
    }

    def __init__(self, node_id: str, node_type: str, category: str = "General", x: float = 0, y: float = 0):
        self.id = node_id
        self.name = node_id
        self.type = node_type
        self.category = category
        self.x = x
        self.y = y
        self.width = 110
        self.height = 38
        self.color = self.CATEGORY_COLORS.get(category, "#444444")

        self.inputs: List[Dict[str, Any]] = []
        self.outputs: List[Dict[str, Any]] = [{"id": "out", "label": "out"}]
        self.knobs: Dict[str, Dict[str, Any]] = {}

        self.disabled = False
        self.is_dirty = True
        self.cached_buffer: Optional[PixelBuffer] = None
        self.graph = None

    def add_input(self, port_id: str, label: str = ""):
        self.inputs.append({
            "id": port_id,
            "label": label or port_id,
            "connection": None  # (upstream_node_id, upstream_port_id)
        })

    def add_knob(self, key: str, label: str, knob_type: str, default_val: Any, **kwargs):
        self.knobs[key] = {
            "label": label,
            "type": knob_type,
            "value": default_val,
            **kwargs
        }

    def get_knob(self, key: str, default: Any = None) -> Any:
        knob = self.knobs.get(key)
        return knob["value"] if knob else default

    def set_knob(self, key: str, value: Any):
        if key in self.knobs:
            if self.knobs[key]["value"] != value:
                self.knobs[key]["value"] = value
                self.mark_dirty()

    def mark_dirty(self):
        self.is_dirty = True
        self.cached_buffer = null = None
        if self.graph:
            self.graph.mark_dependents_dirty(self.id)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        """Compute node output. If bypassed, pass through primary input."""
        if self.disabled:
            if self.inputs:
                first_id = self.inputs[0]["id"]
                return input_buffers.get(first_id)
            return None
        return None
