"""
OpenComp - Read & Write Nodes
"""

from typing import Dict, Optional
from ..core.node import Node
from ..core.pixel_buffer import PixelBuffer


class ReadNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "Read", "Image", x, y)
        self.width = 120
        self.height = 42

        self.add_knob("source_type", "Source", "choice", "greenscreen",
                      choices=["greenscreen", "background", "checkerboard", "file"])
        self.add_knob("file_path", "File Path", "file", "")
        self.add_knob("format", "Resolution", "choice", "1920x1080",
                      choices=["1920x1080", "1280x720", "2048x1080", "3840x2160"])

        self.custom_image: Optional[PixelBuffer] = None

    def load_file(self, path: str):
        try:
            self.custom_image = PixelBuffer.from_file(path)
            self.set_knob("file_path", path)
            self.set_knob("source_type", "file")
            self.mark_dirty()
        except Exception as e:
            print(f"[ReadNode Load Error] {e}")

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        fmt = self.get_knob("format", "1920x1080")
        w, h = map(int, fmt.split("x"))
        source = self.get_knob("source_type", "greenscreen")

        if source == "file" and self.custom_image:
            return self.custom_image.resample(w, h)
        elif source == "greenscreen":
            return PixelBuffer.generate_greenscreen_footage(w, h)
        elif source == "background":
            return PixelBuffer.generate_city_background(w, h)
        elif source == "checkerboard":
            return PixelBuffer.generate_checkerboard(w, h)

        return PixelBuffer(w, h)


class WriteNode(Node):
    def __init__(self, node_id: str, x: float = 0, y: float = 0):
        super().__init__(node_id, "Write", "Image", x, y)
        self.add_input("in", "Input")
        self.add_knob("file_path", "Export Path", "file_save", "output_comp.png")
        self.add_knob("quality", "Quality", "int", 95, min_val=1, max_val=100)

    def compute(self, input_buffers: Dict[str, PixelBuffer], context: dict = None) -> Optional[PixelBuffer]:
        return input_buffers.get("in")

    def export_frame(self, buffer: PixelBuffer):
        if not buffer:
            return
        path = self.get_knob("file_path", "output_comp.png")
        quality = int(self.get_knob("quality", 95))
        buffer.save_to_file(path, quality=quality)
        print(f"[OpenComp] Render exported to: {path}")

