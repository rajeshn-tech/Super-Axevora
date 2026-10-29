"""
OpenComp - 32-bit Floating-Point Pixel Buffer (Linear Color Space)
High-performance pixel engine using NumPy for Foundry Nuke precision.
"""

import numpy as np
from PIL import Image
from PySide6.QtGui import QImage, QPixmap


class PixelBuffer:
    def __init__(self, width: int, height: int, data: np.ndarray = None):
        self.width = max(1, int(width))
        self.height = max(1, int(height))

        if data is not None and data.shape == (self.height, self.width, 4):
            self.data = data.astype(np.float32)
        else:
            # Linear float RGBA: (H, W, 4) initialized to 0.0
            self.data = np.zeros((self.height, self.width, 4), dtype=np.float32)

    def clone(self) -> "PixelBuffer":
        return PixelBuffer(self.width, self.height, self.data.copy())

    def fill(self, r: float, g: float, b: float, a: float = 1.0):
        self.data[:, :, 0] = r
        self.data[:, :, 1] = g
        self.data[:, :, 2] = b
        self.data[:, :, 3] = a

    def get_pixel(self, x: int, y: int):
        if 0 <= x < self.width and 0 <= y < self.height:
            return self.data[y, x]
        return np.array([0.0, 0.0, 0.0, 0.0], dtype=np.float32)

    @classmethod
    def from_file(cls, file_path: str) -> "PixelBuffer":
        """Load image file and convert sRGB 8-bit to 32-bit Linear Float."""
        img = Image.open(file_path).convert("RGBA")
        arr = np.array(img, dtype=np.float32) / 255.0
        # sRGB to Linear approximation (gamma 2.2)
        arr[:, :, :3] = np.power(np.maximum(arr[:, :, :3], 0.0), 2.2)
        return cls(img.width, img.height, arr)

    def save_to_file(self, file_path: str, quality: int = 95):
        """Convert Linear Float to sRGB 8-bit and save."""
        # Linear to sRGB (gamma 1/2.2)
        srgb = np.power(np.clip(self.data[:, :, :3], 0.0, 1.0), 1.0 / 2.2)
        alpha = np.clip(self.data[:, :, 3:4], 0.0, 1.0)
        out_arr = (np.concatenate([srgb, alpha], axis=2) * 255.0).astype(np.uint8)
        img = Image.fromarray(out_arr, mode="RGBA")
        img.save(file_path, quality=quality)

    def to_qimage(
        self, exposure: float = 0.0, gamma: float = 1.0, channel_mode: str = "RGBA"
    ) -> QImage:
        """Convert float buffer to QImage for interactive display."""
        # 1. Apply Exposure (EV stops)
        exp_mult = np.float32(2.0**exposure)
        img = self.data.copy()
        img[:, :, :3] *= exp_mult

        # 2. Channel Isolation
        if channel_mode == "RED":
            img[:, :, 1] = img[:, :, 0]
            img[:, :, 2] = img[:, :, 0]
            img[:, :, 3] = 1.0
        elif channel_mode == "GREEN":
            img[:, :, 0] = img[:, :, 1]
            img[:, :, 2] = img[:, :, 1]
            img[:, :, 3] = 1.0
        elif channel_mode == "BLUE":
            img[:, :, 0] = img[:, :, 2]
            img[:, :, 1] = img[:, :, 2]
            img[:, :, 3] = 1.0
        elif channel_mode == "ALPHA":
            a = img[:, :, 3]
            img[:, :, 0] = a
            img[:, :, 1] = a
            img[:, :, 2] = a
            img[:, :, 3] = 1.0
        elif channel_mode == "LUMA":
            luma = (
                0.2126 * img[:, :, 0]
                + 0.7152 * img[:, :, 1]
                + 0.0722 * img[:, :, 2]
            )
            img[:, :, 0] = luma
            img[:, :, 1] = luma
            img[:, :, 2] = luma
            img[:, :, 3] = 1.0

        # 3. Display Gamma Correction
        inv_gamma = 1.0 / max(0.001, gamma)
        rgb_disp = np.power(np.maximum(img[:, :, :3], 0.0), inv_gamma)
        rgb_disp = np.clip(rgb_disp * 255.0, 0, 255).astype(np.uint8)
        a_disp = np.clip(img[:, :, 3] * 255.0, 0, 255).astype(np.uint8)

        # Pack into RGBA uint8
        rgba_bytes = np.dstack((rgb_disp, a_disp)).tobytes()
        qimg = QImage(
            rgba_bytes,
            self.width,
            self.height,
            self.width * 4,
            QImage.Format.Format_RGBA8888,
        )
        return qimg.copy()

    def resample(self, new_width: int, new_height: int) -> "PixelBuffer":
        """Resize using Bilinear sampling."""
        if new_width == self.width and new_height == self.height:
            return self.clone()
        img = Image.fromarray((self.data * 255.0).clip(0, 255).astype(np.uint8))
        resized = img.resize((new_width, new_height), Image.Resampling.BILINEAR)
        arr = np.array(resized, dtype=np.float32) / 255.0
        return PixelBuffer(new_width, new_height, arr)

    @classmethod
    def generate_checkerboard(cls, width: int = 1920, height: int = 1080, box_size: int = 64) -> "PixelBuffer":
        buf = cls(width, height)
        y_indices, x_indices = np.indices((height, width))
        pattern = ((x_indices // box_size) + (y_indices // box_size)) % 2 == 0
        buf.data[:, :, :3] = np.where(pattern[:, :, None], 0.8, 0.2)
        buf.data[:, :, 3] = 1.0
        return buf

    @classmethod
    def generate_greenscreen_footage(cls, width: int = 1920, height: int = 1080) -> "PixelBuffer":
        """Synthetic studio greenscreen actor with hair details and edge green spill."""
        buf = cls(width, height)
        y, x = np.indices((height, width))
        cx, cy = width * 0.5, height * 0.55
        radius = min(width, height) * 0.28

        # Studio green background with subtle vertical lighting gradient
        grad = 0.85 + 0.15 * (1.0 - (y / height))
        buf.data[:, :, 0] = 0.05 * grad
        buf.data[:, :, 1] = 0.95 * grad
        buf.data[:, :, 2] = 0.12 * grad
        buf.data[:, :, 3] = 1.0

        # Actor head & shoulders
        head_dist = np.sqrt((x - cx) ** 2 + (y - (cy - radius * 0.6)) ** 2)
        body_dist = np.sqrt(((x - cx) / 0.85) ** 2 + (y - cy) ** 2)

        is_head = head_dist < (radius * 0.45)
        is_body = (body_dist < (radius * 1.1)) & (y > (cy - radius * 0.3))
        is_subject = is_head | is_body

        # Edge green spill factor
        rim = np.clip(1.0 - (body_dist / radius), 0.0, 1.0)
        spill = np.power(1.0 - rim, 3.0) * 0.3

        # Skin tone on head
        buf.data[is_head, 0] = 0.72 + spill[is_head] * 0.1
        buf.data[is_head, 1] = 0.48 + spill[is_head] * 0.4  # Green spill
        buf.data[is_head, 2] = 0.35

        # Clothing tone on body
        buf.data[is_body & ~is_head, 0] = 0.12 + spill[is_body & ~is_head] * 0.1
        buf.data[is_body & ~is_head, 1] = 0.16 + spill[is_body & ~is_head] * 0.5
        buf.data[is_body & ~is_head, 2] = 0.25

        return buf

    @classmethod
    def generate_city_background(cls, width: int = 1920, height: int = 1080) -> "PixelBuffer":
        """Cinematic Cyberpunk City Skyline with glowing HDR lights."""
        buf = cls(width, height)
        y, x = np.indices((height, width))
        u = x / width
        v = y / height

        # Sky gradient
        horizon = np.exp(-((v - 0.6) * 5.0) ** 2)
        buf.data[:, :, 0] = 0.08 * (1.0 - v) + 0.85 * horizon
        buf.data[:, :, 1] = 0.04 * (1.0 - v) + 0.32 * horizon
        buf.data[:, :, 2] = 0.28 * (1.0 - v) + 0.12 * horizon
        buf.data[:, :, 3] = 1.0

        # Building silhouettes
        bldg_col = (u * 28).astype(int)
        bldg_h = 0.4 + 0.35 * np.sin(bldg_col * 123.45)
        is_bldg = v > (1.0 - bldg_h)

        # Windows
        win_x = ((x // 14) % 2) == 0
        win_y = ((y // 18) % 2) == 0
        is_win = win_x & win_y & (np.sin(bldg_col * 50 + win_x * 10 + win_y) > 0.3) & is_bldg

        buf.data[is_bldg, 0] = 0.03
        buf.data[is_bldg, 1] = 0.04
        buf.data[is_bldg, 2] = 0.06

        # Glowing windows
        buf.data[is_win, 0] = 1.3
        buf.data[is_win, 1] = 0.9
        buf.data[is_win, 2] = 0.4

        return buf
