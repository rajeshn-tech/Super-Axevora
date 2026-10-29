"""
OpenComp - Interactive Viewer Widget (PySide6)
Real-time image viewport with zoom/pan, Exposure/Gamma, Channel modes, and Pixel Inspector.
"""

from PySide6.QtCore import Qt, QPointF, Signal
from PySide6.QtGui import QPainter, QPixmap, QImage, QColor, QFont
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QSlider, QPushButton,
    QGraphicsView, QGraphicsScene, QGraphicsPixmapItem, QStatusBar
)
from ..core.pixel_buffer import PixelBuffer


class ViewportCanvas(QGraphicsView):
    pixel_hovered = Signal(int, int, float, float, float, float)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = QGraphicsScene(self)
        self.setScene(self.scene)
        self.pixmap_item = QGraphicsPixmapItem()
        self.scene.addItem(self.pixmap_item)

        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setTransformationAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setBackgroundBrush(QColor("#181818"))
        self.setMouseTracking(True)

        self._pan_start = None
        self.current_buffer: PixelBuffer = None

    def set_pixmap(self, pixmap: QPixmap, buffer: PixelBuffer):
        self.current_buffer = buffer
        self.pixmap_item.setPixmap(pixmap)
        self.scene.setSceneRect(self.pixmap_item.boundingRect())

    def wheelEvent(self, event):
        factor = 1.15 if event.angleDelta().y() > 0 else 0.85
        self.scale(factor, factor)

    def mousePressEvent(self, event):
        if event.button() == Qt.MouseButton.MiddleButton or (event.button() == Qt.MouseButton.LeftButton and event.modifiers() == Qt.KeyboardModifier.AltModifier):
            self._pan_start = event.pos()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._pan_start:
            delta = event.pos() - self._pan_start
            self._pan_start = event.pos()
            self.horizontalScrollBar().setValue(self.horizontalScrollBar().value() - delta.x())
            self.verticalScrollBar().setValue(self.verticalScrollBar().value() - delta.y())
            event.accept()
            return

        # Pixel Inspector
        if self.current_buffer:
            scene_pos = self.mapToScene(event.pos())
            x, y = int(scene_pos.x()), int(scene_pos.y())
            if 0 <= x < self.current_buffer.width and 0 <= y < self.current_buffer.height:
                rgba = self.current_buffer.get_pixel(x, y)
                self.pixel_hovered.emit(x, y, rgba[0], rgba[1], rgba[2], rgba[3])

        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if self._pan_start:
            self._pan_start = None
            self.setCursor(Qt.CursorShape.ArrowCursor)
        super().mouseReleaseEvent(event)

    def fit_view(self):
        if self.pixmap_item.pixmap().isNull():
            return
        self.fitInView(self.pixmap_item, Qt.AspectRatioMode.KeepAspectRatio)


class ViewerWidget(QWidget):
    render_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self.exposure = 0.0
        self.gamma = 1.0
        self.channel_mode = "RGBA"
        self.current_buffer: PixelBuffer = None
        self.viewer_node = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Toolbar
        self.toolbar = QWidget()
        self.toolbar.setStyleSheet("background-color: #2b2b2b; color: #eee; font-size: 11px;")
        t_layout = QHBoxLayout(self.toolbar)
        t_layout.setContentsMargins(8, 4, 8, 4)
        t_layout.setSpacing(8)

        # Input switcher
        self.btn_in1 = QPushButton("1")
        self.btn_in1.setFixedWidth(26)
        self.btn_in1.setStyleSheet("background:#ff922b; color:#000; font-weight:bold;")
        self.btn_in1.clicked.connect(lambda: self._set_active_input("1"))
        t_layout.addWidget(self.btn_in1)

        self.btn_in2 = QPushButton("2")
        self.btn_in2.setFixedWidth(26)
        self.btn_in2.clicked.connect(lambda: self._set_active_input("2"))
        t_layout.addWidget(self.btn_in2)

        # Exposure Slider
        t_layout.addWidget(QLabel("Exp:"))
        self.exp_slider = QSlider(Qt.Orientation.Horizontal)
        self.exp_slider.setRange(-50, 50)
        self.exp_slider.setValue(0)
        self.exp_slider.setFixedWidth(80)
        self.exp_label = QLabel("0.0")
        self.exp_label.setFixedWidth(26)
        self.exp_slider.valueChanged.connect(self._on_exp_changed)
        t_layout.addWidget(self.exp_slider)
        t_layout.addWidget(self.exp_label)

        # Gamma Slider
        t_layout.addWidget(QLabel("Gamma:"))
        self.gamma_slider = QSlider(Qt.Orientation.Horizontal)
        self.gamma_slider.setRange(20, 300)
        self.gamma_slider.setValue(100)
        self.gamma_slider.setFixedWidth(80)
        self.gamma_label = QLabel("1.0")
        self.gamma_label.setFixedWidth(26)
        self.gamma_slider.valueChanged.connect(self._on_gamma_changed)
        t_layout.addWidget(self.gamma_slider)
        t_layout.addWidget(self.gamma_label)

        # Channels
        for ch in ["RGBA", "RED", "GREEN", "BLUE", "ALPHA", "LUMA"]:
            btn = QPushButton(ch[:1] if ch != "RGBA" and ch != "LUMA" else ch)
            btn.setFixedWidth(30 if ch != "RGBA" and ch != "LUMA" else 42)
            btn.clicked.connect(lambda _, c=ch: self._set_channel(c))
            t_layout.addWidget(btn)

        # Fit view button
        t_layout.addStretch()
        self.btn_fit = QPushButton("Fit [F]")
        self.btn_fit.clicked.connect(self.fit_view)
        t_layout.addWidget(self.btn_fit)

        layout.addWidget(self.toolbar)

        # Canvas Viewport
        self.canvas = ViewportCanvas(self)
        self.canvas.pixel_hovered.connect(self._on_pixel_hover)
        layout.addWidget(self.canvas)

        # Status Bar for Pixel Inspector
        self.info_bar = QLabel("1920 x 1080 (32-bit Float Linear)")
        self.info_bar.setStyleSheet("background-color: #222; color: #888; font-family: monospace; font-size: 11px; padding: 4px 10px;")
        layout.addWidget(self.info_bar)

    def _set_active_input(self, inp_str: str):
        if self.viewer_node:
            self.viewer_node.set_knob("active_input", inp_str)
            self.btn_in1.setStyleSheet("background:#ff922b; color:#000; font-weight:bold;" if inp_str == "1" else "")
            self.btn_in2.setStyleSheet("background:#ff922b; color:#000; font-weight:bold;" if inp_str == "2" else "")
            self.render_requested.emit()

    def _on_exp_changed(self, val):
        self.exposure = val / 10.0
        self.exp_label.setText(f"{self.exposure:.1f}")
        self.update_display()

    def _on_gamma_changed(self, val):
        self.gamma = val / 100.0
        self.gamma_label.setText(f"{self.gamma:.1f}")
        self.update_display()

    def _set_channel(self, mode: str):
        self.channel_mode = mode
        self.update_display()

    def _on_pixel_hover(self, x, y, r, g, b, a):
        self.info_bar.setText(f"X: {x} Y: {y} | R: {r:.4f} G: {g:.4f} B: {b:.4f} A: {a:.4f} | 32-bit Float Linear")

    def display_buffer(self, buffer: PixelBuffer, viewer_node=None):
        self.current_buffer = buffer
        self.viewer_node = viewer_node
        self.update_display()

    def update_display(self):
        if not self.current_buffer:
            return
        qimg = self.current_buffer.to_qimage(self.exposure, self.gamma, self.channel_mode)
        pixmap = QPixmap.fromImage(qimg)
        self.canvas.set_pixmap(pixmap, self.current_buffer)

    def fit_view(self):
        self.canvas.fit_view()

