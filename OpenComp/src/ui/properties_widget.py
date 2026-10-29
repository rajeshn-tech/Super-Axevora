"""
OpenComp - Properties Bin Widget (PySide6)
Dynamic parameter inspector with live sliders, spinboxes, and color controls.
"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, QCheckBox,
    QComboBox, QSlider, QDoubleSpinBox, QPushButton, QFileDialog, QScrollArea, QFrame
)
from ..core.node import Node


class PropertiesWidget(QWidget):
    param_changed = Signal(object)
    render_requested = Signal(object)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.current_node: Node = None

        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(0, 0, 0, 0)

        # Header / Title
        self.header = QLabel("Properties Bin")
        self.header.setStyleSheet("background:#282828; color:#aaa; font-weight:bold; padding:6px 10px; font-size:11px;")
        main_layout.addWidget(self.header)

        # Scroll Area for dynamic knobs
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.scroll.setStyleSheet("background:#1f1f1f; border:none;")
        self.container = QWidget()
        self.container_layout = QVBoxLayout(self.container)
        self.container_layout.setAlignment(Qt.AlignmentFlag.AlignTop)
        self.scroll.setWidget(self.container)
        main_layout.addWidget(self.scroll)

        self.show_node(None)

    def show_node(self, node: Node):
        self.current_node = node
        # Clear layout
        while self.container_layout.count():
            item = self.container_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        if not node:
            empty_lbl = QLabel("No node selected.\nDouble-click a node to edit parameters.")
            empty_lbl.setAlignment(Qt.AlignmentFlag.AlignCenter)
            empty_lbl.setStyleSheet("color:#666; font-size:12px; margin-top:40px;")
            self.container_layout.addWidget(empty_lbl)
            return

        # Node Header Card
        card = QFrame()
        card.setStyleSheet(f"background:#292929; border-left:4px solid {node.color}; padding:6px; border-radius:3px;")
        card_layout = QVBoxLayout(card)

        title_row = QHBoxLayout()
        name_edit = QLineEdit(node.name)
        name_edit.setStyleSheet("background:transparent; color:#fff; font-weight:bold; font-size:13px; border:none;")
        name_edit.editingFinished.connect(lambda: self._on_name_change(name_edit.text()))
        title_row.addWidget(name_edit)

        type_lbl = QLabel(node.type)
        type_lbl.setStyleSheet("background:#1a1a1a; color:#888; padding:2px 6px; border-radius:3px; font-size:10px;")
        title_row.addWidget(type_lbl)
        card_layout.addLayout(title_row)

        disable_chk = QCheckBox("Disable [D]")
        disable_chk.setChecked(node.disabled)
        disable_chk.setStyleSheet("color:#ff6b6b; font-size:11px;")
        disable_chk.toggled.connect(self._on_disable_toggle)
        card_layout.addWidget(disable_chk)

        self.container_layout.addWidget(card)

        # Special action for Write node
        if node.type == "Write":
            btn_export = QPushButton("Export Rendered Frame")
            btn_export.setStyleSheet("background:#ff922b; color:#000; font-weight:bold; padding:8px; border-radius:4px;")
            btn_export.clicked.connect(lambda: self.render_requested.emit(node))
            self.container_layout.addWidget(btn_export)

        # Build controls for each knob
        for key, knob in node.knobs.items():
            row = QHBoxLayout()
            row.setSpacing(6)
            lbl = QLabel(knob["label"])
            lbl.setFixedWidth(85)
            lbl.setStyleSheet("color:#bbb; font-size:11px;")
            row.addWidget(lbl)

            k_type = knob["type"]
            val = knob["value"]

            if k_type == "choice":
                combo = QComboBox()
                combo.addItems(knob.get("choices", []))
                combo.setCurrentText(str(val))
                combo.setStyleSheet("background:#181818; color:#eee; border:1px solid #444; padding:3px;")
                combo.currentTextChanged.connect(lambda text, k=key: self._on_knob_change(k, text))
                row.addWidget(combo)

            elif k_type == "float":
                spin = QDoubleSpinBox()
                spin.setRange(knob.get("min_val", -1000.0), knob.get("max_val", 1000.0))
                spin.setSingleStep(knob.get("step", 0.01))
                spin.setValue(float(val))
                spin.setStyleSheet("background:#181818; color:#eee; border:1px solid #444; padding:3px;")

                slider = QSlider(Qt.Orientation.Horizontal)
                min_v = int(knob.get("min_val", 0.0) * 100)
                max_v = int(knob.get("max_val", 1.0) * 100)
                slider.setRange(min_v, max_v)
                slider.setValue(int(float(val) * 100))

                slider.valueChanged.connect(lambda v, s=spin, k=key: self._on_slider_change(k, v / 100.0, s))
                spin.valueChanged.connect(lambda v, sl=slider, k=key: self._on_spin_change(k, v, sl))

                row.addWidget(slider)
                row.addWidget(spin)

            elif k_type == "bool":
                chk = QCheckBox()
                chk.setChecked(bool(val))
                chk.toggled.connect(lambda state, k=key: self._on_knob_change(k, state))
                row.addWidget(chk)

            elif k_type == "file":
                path_edit = QLineEdit(str(val))
                path_edit.setStyleSheet("background:#181818; color:#eee; border:1px solid #444;")
                btn_browse = QPushButton("...")
                btn_browse.setFixedWidth(26)
                btn_browse.clicked.connect(lambda _, k=key, pe=path_edit: self._on_browse_file(k, pe))
                row.addWidget(path_edit)
                row.addWidget(btn_browse)

            elif k_type == "file_save":
                path_edit = QLineEdit(str(val))
                path_edit.setStyleSheet("background:#181818; color:#eee; border:1px solid #444;")
                btn_browse = QPushButton("...")
                btn_browse.setFixedWidth(26)
                btn_browse.clicked.connect(lambda _, k=key, pe=path_edit: self._on_browse_save(k, pe))
                row.addWidget(path_edit)
                row.addWidget(btn_browse)

            self.container_layout.addLayout(row)

    def _on_name_change(self, text: str):
        if self.current_node:
            self.current_node.name = text.strip() or self.current_node.id
            self.param_changed.emit(self.current_node)

    def _on_disable_toggle(self, checked: bool):
        if self.current_node:
            self.current_node.disabled = checked
            self.current_node.mark_dirty()
            self.param_changed.emit(self.current_node)

    def _on_knob_change(self, key: str, val):
        if self.current_node:
            self.current_node.set_knob(key, val)
            self.param_changed.emit(self.current_node)

    def _on_slider_change(self, key: str, val: float, spin: QDoubleSpinBox):
        spin.blockSignals(True)
        spin.setValue(val)
        spin.blockSignals(False)
        self._on_knob_change(key, val)

    def _on_spin_change(self, key: str, val: float, slider: QSlider):
        slider.blockSignals(True)
        slider.setValue(int(val * 100))
        slider.blockSignals(False)
        self._on_knob_change(key, val)

    def _on_browse_file(self, key: str, path_edit: QLineEdit):
        path, _ = QFileDialog.getOpenFileName(self, "Open Image", "", "Images (*.png *.jpg *.jpeg *.tif *.tiff);;All Files (*)")
        if path:
            path_edit.setText(path)
            if hasattr(self.current_node, "load_file"):
                self.current_node.load_file(path)
            self._on_knob_change(key, path)

    def _on_browse_save(self, key: str, path_edit: QLineEdit):
        path, _ = QFileDialog.getSaveFileName(self, "Export Image", "output.png", "Images (*.png *.jpg *.jpeg *.webp);;All Files (*)")
        if path:
            path_edit.setText(path)
            self._on_knob_change(key, path)
