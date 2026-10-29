"""
OpenComp - Timeline Widget (PySide6)
Frame scrubber with playback controls and FPS counter.
"""

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtWidgets import (
    QWidget, QHBoxLayout, QPushButton, QSlider, QSpinBox, QLabel
)


class TimelineWidget(QWidget):
    frame_changed = Signal(int)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.current_frame = 1
        self.start_frame = 1
        self.end_frame = 100
        self.fps = 24
        self.is_playing = False

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._step_next)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 4, 10, 4)
        layout.setSpacing(8)

        self.btn_first = QPushButton("|◀")
        self.btn_prev = QPushButton("◀")
        self.btn_play = QPushButton("▶ Play")
        self.btn_next = QPushButton("▶")
        self.btn_last = QPushButton("▶|")

        for b in [self.btn_first, self.btn_prev, self.btn_play, self.btn_next, self.btn_last]:
            b.setFixedWidth(40 if b != self.btn_play else 65)
            layout.addWidget(b)

        self.spin_start = QSpinBox()
        self.spin_start.setRange(1, 99999)
        self.spin_start.setValue(self.start_frame)
        self.spin_start.setFixedWidth(50)
        layout.addWidget(self.spin_start)

        self.spin_cur = QSpinBox()
        self.spin_cur.setRange(1, 99999)
        self.spin_cur.setValue(self.current_frame)
        self.spin_cur.setFixedWidth(50)
        self.spin_cur.setStyleSheet("color:#ff922b; font-weight:bold;")
        layout.addWidget(self.spin_cur)

        self.spin_end = QSpinBox()
        self.spin_end.setRange(1, 99999)
        self.spin_end.setValue(self.end_frame)
        self.spin_end.setFixedWidth(50)
        layout.addWidget(self.spin_end)

        self.scrubber = QSlider(Qt.Orientation.Horizontal)
        self.scrubber.setRange(self.start_frame, self.end_frame)
        self.scrubber.setValue(self.current_frame)
        layout.addWidget(self.scrubber)

        self.lbl_fps = QLabel("FPS: 24")
        self.lbl_fps.setStyleSheet("color:#888; font-size:11px;")
        layout.addWidget(self.lbl_fps)

        # Connections
        self.btn_play.clicked.connect(self.toggle_play)
        self.btn_first.clicked.connect(lambda: self.set_frame(self.start_frame))
        self.btn_last.clicked.connect(lambda: self.set_frame(self.end_frame))
        self.btn_prev.clicked.connect(lambda: self.set_frame(self.current_frame - 1))
        self.btn_next.clicked.connect(lambda: self.set_frame(self.current_frame + 1))

        self.scrubber.valueChanged.connect(self.set_frame)
        self.spin_cur.valueChanged.connect(self.set_frame)
        self.spin_start.valueChanged.connect(self._on_start_changed)
        self.spin_end.valueChanged.connect(self._on_end_changed)

    def _on_start_changed(self, val):
        self.start_frame = val
        self.scrubber.setMinimum(val)

    def _on_end_changed(self, val):
        self.end_frame = val
        self.scrubber.setMaximum(val)

    def set_frame(self, frame: int):
        self.current_frame = max(self.start_frame, min(self.end_frame, frame))
        self.spin_cur.blockSignals(True)
        self.scrubber.blockSignals(True)
        self.spin_cur.setValue(self.current_frame)
        self.scrubber.setValue(self.current_frame)
        self.spin_cur.blockSignals(False)
        self.scrubber.blockSignals(False)
        self.frame_changed.emit(self.current_frame)

    def toggle_play(self):
        if self.is_playing:
            self.pause()
        else:
            self.play()

    def play(self):
        self.is_playing = True
        self.btn_play.setText("⏸ Pause")
        self.timer.start(int(1000 / self.fps))

    def pause(self):
        self.is_playing = False
        self.btn_play.setText("▶ Play")
        self.timer.stop()

    def _step_next(self):
        next_f = self.current_frame + 1
        if next_f > self.end_frame:
            next_f = self.start_frame
        self.set_frame(next_f)

