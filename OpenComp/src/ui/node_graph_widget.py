"""
OpenComp - Interactive Node Graph Widget (PySide6)
DAG Viewport with draggable nodes, Bezier wires, Tab search spawner, and Nuke hotkeys.
"""

from PySide6.QtCore import Qt, QPointF, QRectF, Signal
from PySide6.QtGui import (
    QBrush, QColor, QFont, QPainter, QPainterPath, QPen
)
from PySide6.QtWidgets import (
    QGraphicsView, QGraphicsScene, QGraphicsItem, QGraphicsRectItem,
    QGraphicsPathItem, QGraphicsEllipseItem, QMenu, QLineEdit, QDialog,
    QVBoxLayout, QListWidget, QListWidgetItem
)
from ..nodes.registry import NODE_CLASSES, create_node


class PortItem(QGraphicsEllipseItem):
    def __init__(self, port_id: str, is_input: bool, node_item, parent=None):
        super().__init__(-5, -5, 10, 10, parent)
        self.port_id = port_id
        self.is_input = is_input
        self.node_item = node_item
        self.setBrush(QBrush(QColor("#ffbb33" if not is_input else "#888888")))
        self.setPen(QPen(QColor("#222222"), 1))
        self.setAcceptHoverEvents(True)

    def scene_center(self) -> QPointF:
        return self.scenePos()


class WireItem(QGraphicsPathItem):
    def __init__(self, from_port: PortItem, to_port: PortItem, parent=None):
        super().__init__(parent)
        self.from_port = from_port
        self.to_port = to_port
        self.setPen(QPen(QColor("#e6a100"), 2.2))
        self.setZValue(-1)
        self.update_path()

    def update_path(self):
        p1 = self.from_port.scene_center()
        p2 = self.to_port.scene_center()

        path = QPainterPath(p1)
        dy = max(30.0, abs(p2.y() - p1.y()) * 0.5)
        path.cubicTo(p1.x(), p1.y() + dy, p2.x(), p2.y() - dy, p2.x(), p2.y())
        self.setPath(path)


class NodeItem(QGraphicsRectItem):
    def __init__(self, node, graph_view, parent=None):
        super().__init__(0, 0, node.width, node.height, parent)
        self.node = node
        self.graph_view = graph_view
        self.setPos(node.x, node.y)

        self.setFlags(
            QGraphicsItem.GraphicsItemFlag.ItemIsMovable |
            QGraphicsItem.GraphicsItemFlag.ItemIsSelectable |
            QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges
        )
        self.setBrush(QBrush(QColor(node.color)))
        self.setPen(QPen(QColor("transparent"), 1))

        # Setup Ports
        self.input_ports: dict[str, PortItem] = {}
        in_count = len(node.inputs)
        for i, inp in enumerate(node.inputs):
            port = PortItem(inp["id"], is_input=True, node_item=self, parent=self)
            px = (node.width / (in_count + 1)) * (i + 1)
            port.setPos(px, 0)
            self.input_ports[inp["id"]] = port

        # Output port
        self.output_port = PortItem("out", is_input=False, node_item=self, parent=self)
        self.output_port.setPos(node.width * 0.5, node.height)

    def itemChange(self, change, value):
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            self.node.x = self.x()
            self.node.y = self.y()
            self.graph_view.update_wires()
        return super().itemChange(change, value)

    def paint(self, painter: QPainter, option, widget=None):
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        # Body
        painter.setBrush(QBrush(QColor(self.node.color)))
        if self.isSelected():
            painter.setPen(QPen(QColor("#ff922b"), 2.5))
        else:
            painter.setPen(QPen(QColor("#555"), 1))
        painter.drawRoundedRect(self.rect(), 4, 4)

        # Label
        painter.setPen(QColor("#ffffff"))
        painter.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
        painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, self.node.name)

        # Red cross if disabled (Nuke 'D')
        if self.node.disabled:
            painter.setPen(QPen(QColor("#fa5252"), 2.5))
            painter.drawLine(0, 0, self.node.width, self.node.height)
            painter.drawLine(0, self.node.height, self.node.width, 0)


class TabSearchDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Create Node (Tab)")
        self.setWindowFlags(Qt.WindowType.Popup)
        self.resize(220, 260)
        self.selected_type = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(4, 4, 4, 4)

        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Type node name...")
        self.search_box.setStyleSheet("background:#1e1e1e; color:#fff; padding:6px; border:1px solid #444;")
        layout.addWidget(self.search_box)

        self.list_widget = QListWidget()
        self.list_widget.setStyleSheet(
            "background:#282828; color:#eee; border:none;"
            "QListWidget::item:selected { background:#ff922b; color:#000; font-weight:bold; }"
        )
        layout.addWidget(self.list_widget)

        self.all_nodes = sorted(list(NODE_CLASSES.keys()))
        self._populate("")

        self.search_box.textChanged.connect(self._populate)
        self.search_box.returnPressed.connect(self._accept_current)
        self.list_widget.itemDoubleClicked.connect(self._accept_item)

    def _populate(self, text: str):
        self.list_widget.clear()
        query = text.lower().strip()
        for ntype in self.all_nodes:
            if query in ntype.lower():
                self.list_widget.addItem(QListWidgetItem(ntype))
        if self.list_widget.count() > 0:
            self.list_widget.setCurrentRow(0)

    def _accept_current(self):
        item = self.list_widget.currentItem()
        if item:
            self.selected_type = item.text()
            self.accept()

    def _accept_item(self, item):
        self.selected_type = item.text()
        self.accept()


class NodeGraphWidget(QGraphicsView):
    node_selected = Signal(object)
    node_double_clicked = Signal(object)

    def __init__(self, graph, parent=None):
        super().__init__(parent)
        self.graph = graph
        self.scene = QGraphicsScene(self)
        self.setScene(self.scene)
        self.scene.setSceneRect(-5000, -5000, 10000, 10000)

        self.node_items: dict[str, NodeItem] = {}
        self.wire_items: list[WireItem] = []

        # View settings
        self.setRenderHint(QPainter.RenderHint.Antialiasing)
        self.setViewportUpdateMode(QGraphicsView.ViewportUpdateMode.FullViewportUpdate)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self.setTransformationAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.setBackgroundBrush(QBrush(QColor("#222222")))

        self._drag_wire = None
        self._connecting_port = None

    def drawBackground(self, painter: QPainter, rect: QRectF):
        super().drawBackground(painter, rect)
        painter.setPen(QPen(QColor("#2c2c2c"), 1))
        grid_size = 25
        left = int(rect.left()) - (int(rect.left()) % grid_size)
        top = int(rect.top()) - (int(rect.top()) % grid_size)

        points = []
        for x in range(left, int(rect.right()), grid_size):
            for y in range(top, int(rect.bottom()), grid_size):
                points.append(QPointF(x, y))
        painter.drawPoints(points)

    def rebuild_scene(self):
        self.scene.clear()
        self.node_items.clear()
        self.wire_items.clear()

        # Add nodes
        for node in self.graph.nodes.values():
            item = NodeItem(node, self)
            self.scene.addItem(item)
            self.node_items[node.id] = item

        self.update_wires()

    def update_wires(self):
        for wire in self.wire_items:
            self.scene.removeItem(wire)
        self.wire_items.clear()

        for node in self.graph.nodes.values():
            to_item = self.node_items.get(node.id)
            if not to_item:
                continue
            for inp in node.inputs:
                conn = inp.get("connection")
                if conn:
                    from_id, from_port = conn
                    from_item = self.node_items.get(from_id)
                    if from_item:
                        to_port_item = to_item.input_ports.get(inp["id"])
                        wire = WireItem(from_item.output_port, to_port_item)
                        self.scene.addItem(wire)
                        self.wire_items.append(wire)

    def mousePressEvent(self, event):
        item = self.itemAt(event.pos())
        if isinstance(item, PortItem):
            self._connecting_port = item
            event.accept()
            return
        elif event.button() == Qt.MouseButton.MiddleButton or (event.button() == Qt.MouseButton.LeftButton and event.modifiers() == Qt.KeyboardModifier.AltModifier):
            self._pan_start = event.pos()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
            return

        super().mousePressEvent(event)
        selected = self.scene.selectedItems()
        if selected and isinstance(selected[0], NodeItem):
            self.node_selected.emit(selected[0].node)
        else:
            self.node_selected.emit(None)

    def mouseMoveEvent(self, event):
        if hasattr(self, "_pan_start") and self._pan_start:
            delta = event.pos() - self._pan_start
            self._pan_start = event.pos()
            self.horizontalScrollBar().setValue(self.horizontalScrollBar().value() - delta.x())
            self.verticalScrollBar().setValue(self.verticalScrollBar().value() - delta.y())
            event.accept()
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        if hasattr(self, "_pan_start") and self._pan_start:
            self._pan_start = None
            self.setCursor(Qt.CursorShape.ArrowCursor)

        if self._connecting_port:
            target_item = self.itemAt(event.pos())
            if isinstance(target_item, PortItem) and target_item.node_item != self._connecting_port.node_item:
                p1, p2 = self._connecting_port, target_item
                if not p1.is_input and p2.is_input:
                    self.graph.connect(p1.node_item.node.id, p1.port_id, p2.node_item.node.id, p2.port_id)
                elif p1.is_input and not p2.is_input:
                    self.graph.connect(p2.node_item.node.id, p2.port_id, p1.node_item.node.id, p1.port_id)
                self.rebuild_scene()
            self._connecting_port = None

        super().mouseReleaseEvent(event)

    def mouseDoubleClickEvent(self, event):
        item = self.itemAt(event.pos())
        if isinstance(item, NodeItem):
            self.node_double_clicked.emit(item.node)
        super().mouseDoubleClickEvent(event)

    def wheelEvent(self, event):
        factor = 1.15 if event.angleDelta().y() > 0 else 0.85
        self.scale(factor, factor)

    def keyPressEvent(self, event):
        # Tab: Open Node Finder Dialog
        if event.key() == Qt.Key.Key_Tab:
            dlg = TabSearchDialog(self)
            dlg.move(self.mapToGlobal(self.mapFromGlobal(event.globalPosition().toPoint())))
            if dlg.exec() and dlg.selected_type:
                scene_pos = self.mapToScene(self.mapFromGlobal(event.globalPosition().toPoint()))
                node = create_node(dlg.selected_type, x=scene_pos.x(), y=scene_pos.y())
                self.graph.add_node(node)
                self.rebuild_scene()
            event.accept()
            return

        selected = [i for i in self.scene.selectedItems() if isinstance(i, NodeItem)]
        primary = selected[0].node if selected else None

        # Nuke hotkeys
        if event.key() == Qt.Key.Key_D and selected:
            for item in selected:
                item.node.disabled = not item.node.disabled
                item.node.mark_dirty()
            self.scene.update()
            return
        elif event.key() in (Qt.Key.Key_Delete, Qt.Key.Key_Backspace) and selected:
            for item in selected:
                self.graph.remove_node(item.node.id)
            self.rebuild_scene()
            return
        elif Qt.Key.Key_1 <= event.key() <= Qt.Key.Key_9 and primary:
            # Connect selected node to Viewer Input (e.g. 1)
            port_num = str(event.key() - Qt.Key.Key_0)
            viewers = [n for n in self.graph.nodes.values() if n.type == "Viewer"]
            viewer = viewers[0] if viewers else self.graph.add_node(create_node("Viewer", x=primary.x, y=primary.y + 120))
            self.graph.connect(primary.id, "out", viewer.id, port_num)
            viewer.set_knob("active_input", port_num)
            self.rebuild_scene()
            return

        # Fast node shortcuts: M, G, C, B, K, R
        key_map = {
            Qt.Key.Key_M: "Merge",
            Qt.Key.Key_G: "Grade",
            Qt.Key.Key_C: "ColorCorrect",
            Qt.Key.Key_B: "Blur",
            Qt.Key.Key_K: "Keyer",
            Qt.Key.Key_R: "Read",
        }
        if event.key() in key_map:
            ntype = key_map[event.key()]
            px = primary.x if primary else 200
            py = (primary.y + 70) if primary else 200
            new_node = self.graph.add_node(create_node(ntype, x=px, y=py))
            if primary and new_node.inputs:
                first_port = new_node.inputs[0]["id"]
                self.graph.connect(primary.id, "out", new_node.id, first_port)
            self.rebuild_scene()
            return

        super().keyPressEvent(event)

