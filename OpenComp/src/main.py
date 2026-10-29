"""
OpenComp - Foundry Nuke Desktop Alternative (PySide6)
Professional 32-bit Float Node-Based Compositor with DAG graph, interactive viewer, and real-time grading.
"""

import sys
from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QSplitter,
    QMessageBox, QFileDialog
)

from .core.graph import Graph
from .nodes.registry import create_node
from .ui.viewer_widget import ViewerWidget
from .ui.node_graph_widget import NodeGraphWidget
from .ui.properties_widget import PropertiesWidget
from .ui.timeline_widget import TimelineWidget


DARK_NUKE_STYLESHEET = """
QMainWindow {
    background-color: #191919;
}
QMenuBar {
    background-color: #242424;
    color: #eee;
    border-bottom: 1px solid #333;
    font-size: 12px;
}
QMenuBar::item:selected {
    background-color: #383838;
}
QMenu {
    background-color: #282828;
    color: #eee;
    border: 1px solid #444;
}
QMenu::item:selected {
    background-color: #ff922b;
    color: #111;
    font-weight: bold;
}
QSplitter::handle {
    background-color: #2e2e2e;
}
QPushButton {
    background-color: #333;
    color: #eee;
    border: 1px solid #484848;
    border-radius: 3px;
    padding: 3px 6px;
    font-size: 11px;
}
QPushButton:hover {
    background-color: #404040;
    border-color: #666;
}
QPushButton:pressed {
    background-color: #ff922b;
    color: #000;
}
QSlider::groove:horizontal {
    height: 4px;
    background: #333;
}
QSlider::handle:horizontal {
    background: #ff922b;
    width: 10px;
    margin: -3px 0;
    border-radius: 5px;
}
"""


class OpenCompMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("OpenComp - VFX Node-Based Compositing Workstation (Foundry Nuke Alternative)")
        self.resize(1380, 880)
        self.setStyleSheet(DARK_NUKE_STYLESHEET)

        self.graph = Graph()

        # UI Components
        self.viewer = ViewerWidget(self)
        self.node_graph = NodeGraphWidget(self.graph, self)
        self.properties = PropertiesWidget(self)
        self.timeline = TimelineWidget(self)

        self._setup_layout()
        self._setup_menu()
        self._setup_signals()

        # Load default production VFX preset
        QTimer.singleShot(100, self.load_preset_greenscreen)

    def _setup_layout(self):
        central_widget = QWidget()
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)

        # Main Horizontal Splitter (Left: Viewer + NodeGraph, Right: Properties)
        h_splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left Vertical Splitter (Top: Viewer, Bottom: NodeGraph)
        v_splitter = QSplitter(Qt.Orientation.Vertical)
        v_splitter.addWidget(self.viewer)
        v_splitter.addWidget(self.node_graph)
        v_splitter.setSizes([500, 380])

        h_splitter.addWidget(v_splitter)
        h_splitter.addWidget(self.properties)
        h_splitter.setSizes([1040, 340])

        main_layout.addWidget(h_splitter)
        main_layout.addWidget(self.timeline)

        self.setCentralWidget(central_widget)

    def _setup_menu(self):
        menubar = self.menuBar()

        # File Menu
        file_menu = menubar.addMenu("&File")
        file_menu.addAction("New Project", self._new_project)
        file_menu.addSeparator()
        file_menu.addAction("Exit", self.close)

        # Presets Menu (Demos)
        preset_menu = menubar.addMenu("&Presets (VFX Demos)")
        preset_menu.addAction("1. VFX Greenscreen Keying & BG", self.load_preset_greenscreen)
        preset_menu.addAction("2. Cinematic Color Grade & Glow", self.load_preset_color_grade)
        preset_menu.addAction("3. A/B Wipe Comparison", self.load_preset_wipe_compare)

        # Help Menu
        help_menu = menubar.addMenu("&Help")
        help_menu.addAction("Nuke Hotkey Cheat Sheet", self._show_shortcuts)
        help_menu.addAction("About OpenComp", self._show_about)

    def _setup_signals(self):
        # Graph node selection -> Properties
        self.node_graph.node_selected.connect(self.properties.show_node)
        self.node_graph.node_double_clicked.connect(self.properties.show_node)

        # Properties knob changed -> Re-evaluate
        self.properties.param_changed.connect(self._on_param_change)
        self.properties.render_requested.connect(self._on_export_render)

        # Viewer input/channel change -> Re-evaluate
        self.viewer.render_requested.connect(self.evaluate_graph)

        # Timeline scrubber -> Re-evaluate
        self.timeline.frame_changed.connect(lambda f: self.evaluate_graph())

    def _on_param_change(self, node):
        self.node_graph.scene.update()
        self.evaluate_graph()

    def _on_export_render(self, write_node):
        buf = self.graph.evaluate(write_node.id)
        if buf:
            write_node.export_frame(buf)
            QMessageBox.information(self, "Render Complete", f"Frame exported successfully:\n{write_node.get_knob('file_path')}")
        else:
            QMessageBox.warning(self, "Export Failed", "Nothing to export. Connect an input to Write node.")

    def evaluate_graph(self):
        viewers = [n for n in self.graph.nodes.values() if n.type == "Viewer"]
        if not viewers:
            self.viewer.display_buffer(None)
            return

        viewer = viewers[0]
        buf = self.graph.evaluate(viewer.id)
        self.viewer.display_buffer(buf, viewer)

    def _new_project(self):
        if QMessageBox.question(self, "New Project", "Clear current node graph?") == QMessageBox.StandardButton.Yes:
            self.graph.clear()
            self.node_graph.rebuild_scene()
            self.properties.show_node(None)
            self.viewer.display_buffer(None)

    def _show_shortcuts(self):
        msg = (
            "Foundry Nuke Shortcuts in OpenComp:\n\n"
            "• Tab: Open Quick Node Spawner Dialog\n"
            "• 1 - 9: Connect selected node to Viewer Input\n"
            "• M: Create Merge Node\n"
            "• G: Create Grade Node\n"
            "• C: Create ColorCorrect Node\n"
            "• B: Create Blur Node\n"
            "• K: Create Keyer Node\n"
            "• R: Create Read Node\n"
            "• D: Disable / Bypass selected node\n"
            "• Del: Delete selected node\n"
            "• F: Fit image to Viewer\n"
            "• Middle Click: Pan Canvas & Graph\n"
            "• Mouse Wheel: Zoom Canvas & Graph\n"
        )
        QMessageBox.information(self, "Nuke Hotkeys", msg)

    def _show_about(self):
        QMessageBox.about(
            self,
            "About OpenComp",
            "<b>OpenComp v1.0</b><br>"
            "An open-source node-based VFX compositing software built as a Foundry Nuke alternative.<br><br>"
            "Features: 32-bit Float Linear Engine, A/B Merge, Grade, Chroma Keyer with Despill, and DAG Graph."
        )

    # --- Preloaded Production VFX Presets ---

    def load_preset_greenscreen(self):
        self.graph.clear()

        # 1. Background Read node
        read_bg = create_node("Read", "Read_BG", x=100, y=50)
        read_bg.set_knob("source_type", "background")
        self.graph.add_node(read_bg)

        # 2. Foreground Greenscreen Read node
        read_actor = create_node("Read", "Read_Actor", x=340, y=50)
        read_actor.set_knob("source_type", "greenscreen")
        self.graph.add_node(read_actor)

        # 3. Chroma Keyer Node
        keyer = create_node("Keyer", "Keyer1", x=340, y=150)
        keyer.set_knob("tolerance", 0.28)
        keyer.set_knob("softness", 0.16)
        keyer.set_knob("despill", 1.1)
        self.graph.add_node(keyer)
        self.graph.connect(read_actor.id, "out", keyer.id, "in")

        # 4. Color Grading on Actor to match background lighting
        grade = create_node("Grade", "Grade_Actor", x=340, y=250)
        grade.set_knob("gain", 1.05)
        grade.set_knob("gamma", 1.15)
        grade.set_knob("lift", -0.02)
        self.graph.add_node(grade)
        self.graph.connect(keyer.id, "out", grade.id, "in")

        # 5. Merge Over Background
        merge = create_node("Merge", "Merge1", x=220, y=350)
        merge.set_knob("operation", "over")
        self.graph.add_node(merge)
        self.graph.connect(read_bg.id, "out", merge.id, "B")
        self.graph.connect(grade.id, "out", merge.id, "A")

        # 6. Viewer node
        viewer = create_node("Viewer", "Viewer1", x=220, y=470)
        self.graph.add_node(viewer)
        self.graph.connect(merge.id, "out", viewer.id, "1")
        self.graph.connect(read_actor.id, "out", viewer.id, "2")

        # 7. Write Node for rendering
        write = create_node("Write", "Write1", x=420, y=470)
        self.graph.add_node(write)
        self.graph.connect(merge.id, "out", write.id, "in")

        self.node_graph.rebuild_scene()
        self.properties.show_node(merge)
        self.evaluate_graph()
        QTimer.singleShot(150, self.viewer.fit_view)

    def load_preset_color_grade(self):
        self.graph.clear()

        read = create_node("Read", "Read_City", x=220, y=50)
        read.set_knob("source_type", "background")
        self.graph.add_node(read)

        cc = create_node("ColorCorrect", "ColorCorrect1", x=220, y=150)
        cc.set_knob("saturation", 1.35)
        cc.set_knob("contrast", 1.18)
        self.graph.add_node(cc)
        self.graph.connect(read.id, "out", cc.id, "in")

        # Glow branch: Blur + Merge Plus
        blur = create_node("Blur", "Blur_Glow", x=380, y=230)
        blur.set_knob("size", 25.0)
        self.graph.add_node(blur)
        self.graph.connect(cc.id, "out", blur.id, "in")

        grade_glow = create_node("Grade", "Grade_Glow", x=380, y=320)
        grade_glow.set_knob("multiply", 0.85)
        self.graph.add_node(grade_glow)
        self.graph.connect(blur.id, "out", grade_glow.id, "in")

        merge_plus = create_node("Merge", "Merge_Plus", x=220, y=410)
        merge_plus.set_knob("operation", "plus")
        self.graph.add_node(merge_plus)
        self.graph.connect(cc.id, "out", merge_plus.id, "B")
        self.graph.connect(grade_glow.id, "out", merge_plus.id, "A")

        viewer = create_node("Viewer", "Viewer1", x=220, y=520)
        self.graph.add_node(viewer)
        self.graph.connect(merge_plus.id, "out", viewer.id, "1")
        self.graph.connect(read.id, "out", viewer.id, "2")

        self.node_graph.rebuild_scene()
        self.properties.show_node(merge_plus)
        self.evaluate_graph()
        QTimer.singleShot(150, self.viewer.fit_view)

    def load_preset_wipe_compare(self):
        self.graph.clear()

        read = create_node("Read", "Read1", x=140, y=60)
        read.set_knob("source_type", "background")
        self.graph.add_node(read)

        grade = create_node("Grade", "Grade_Cinematic", x=300, y=160)
        grade.set_knob("gamma", 1.4)
        grade.set_knob("gain", 1.2)
        grade.set_knob("lift", -0.05)
        self.graph.add_node(grade)
        self.graph.connect(read.id, "out", grade.id, "in")

        viewer = create_node("Viewer", "Viewer1", x=220, y=300)
        viewer.set_knob("compare_mode", "wipe_h")
        viewer.set_knob("wipe_pos", 0.5)
        self.graph.add_node(viewer)
        self.graph.connect(grade.id, "out", viewer.id, "1")
        self.graph.connect(read.id, "out", viewer.id, "2")

        self.node_graph.rebuild_scene()
        self.properties.show_node(grade)
        self.evaluate_graph()
        QTimer.singleShot(150, self.viewer.fit_view)


def main():
    app = QApplication(sys.argv)
    window = OpenCompMainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
