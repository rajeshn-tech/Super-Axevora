"""
OpenComp - Node Registry & Factory
"""

from typing import Dict, Type
from ..core.node import Node
from .read_node import ReadNode, WriteNode
from .merge_node import MergeNode, GradeNode
from .color_correct_node import ColorCorrectNode, BlurNode
from .keyer_node import KeyerNode, ViewerNode

NODE_CLASSES: Dict[str, Type[Node]] = {
    "Read": ReadNode,
    "Write": WriteNode,
    "Merge": MergeNode,
    "Grade": GradeNode,
    "ColorCorrect": ColorCorrectNode,
    "Blur": BlurNode,
    "Keyer": KeyerNode,
    "Viewer": ViewerNode,
}

_counters = {}


def create_node(node_type: str, custom_id: str = None, x: float = 0, y: float = 0) -> Node:
    cls = NODE_CLASSES.get(node_type)
    if not cls:
        raise ValueError(f"Unknown node type: {node_type}")

    if not custom_id:
        count = _counters.get(node_type, 1)
        custom_id = f"{node_type}{count}"
        _counters[node_type] = count + 1

    return cls(custom_id, x, y)
