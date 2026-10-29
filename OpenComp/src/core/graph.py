"""
OpenComp - DAG Node Graph Manager
Handles topological execution, cycle prevention, and pull-based evaluation.
"""

from typing import Dict, List, Optional, Callable
from .node import Node
from .pixel_buffer import PixelBuffer


class Graph:
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.listeners: List[Callable[[str, dict], None]] = []

    def add_listener(self, cb: Callable[[str, dict], None]):
        self.listeners.append(cb)

    def notify(self, event_type: str, details: dict = None):
        for listener in self.listeners:
            try:
                listener(event_type, details or {})
            except Exception as e:
                print(f"[OpenComp Graph Error] {e}")

    def add_node(self, node: Node) -> Node:
        node.graph = self
        self.nodes[node.id] = node
        self.notify("node_added", {"node": node})
        return node

    def remove_node(self, node_id: str):
        if node_id not in self.nodes:
            return

        # Disconnect downstream inputs pointing to this node
        for other in self.nodes.values():
            for inp in other.inputs:
                conn = inp.get("connection")
                if conn and conn[0] == node_id:
                    inp["connection"] = None
                    other.mark_dirty()

        del self.nodes[node_id]
        self.notify("node_removed", {"node_id": node_id})

    def connect(self, from_id: str, from_port: str, to_id: str, to_port: str) -> bool:
        if from_id not in self.nodes or to_id not in self.nodes:
            return False

        # Cycle prevention: Can to_id reach from_id?
        if self._can_reach(to_id, from_id):
            print(f"[OpenComp] Cycle detected: Cannot connect {from_id} -> {to_id}")
            return False

        to_node = self.nodes[to_id]
        for inp in to_node.inputs:
            if inp["id"] == to_port:
                inp["connection"] = (from_id, from_port)
                to_node.mark_dirty()
                self.notify("connection_changed", {"from": from_id, "to": to_id, "port": to_port})
                return True
        return False

    def disconnect(self, to_id: str, to_port: str):
        if to_id in self.nodes:
            to_node = self.nodes[to_id]
            for inp in to_node.inputs:
                if inp["id"] == to_port and inp["connection"]:
                    inp["connection"] = None
                    to_node.mark_dirty()
                    self.notify("connection_changed", {"to": to_id, "port": to_port})
                    return

    def _can_reach(self, start_id: str, target_id: str, visited=None) -> bool:
        if visited is None:
            visited = set()
        if start_id == target_id:
            return True
        if start_id in visited:
            return False
        visited.add(start_id)

        start_node = self.nodes.get(start_id)
        if not start_node:
            return False

        # Check all nodes that take start_node as an input
        for other in self.nodes.values():
            for inp in other.inputs:
                conn = inp.get("connection")
                if conn and conn[0] == start_id:
                    if self._can_reach(other.id, target_id, visited):
                        return True
        return False

    def mark_dependents_dirty(self, node_id: str):
        for other in self.nodes.values():
            for inp in other.inputs:
                conn = inp.get("connection")
                if conn and conn[0] == node_id:
                    if not other.is_dirty:
                        other.is_dirty = True
                        other.cached_buffer = None
                        self.mark_dependents_dirty(other.id)

    def evaluate(self, target_node_id: str, context: dict = None) -> Optional[PixelBuffer]:
        """Pull-based backward evaluation starting from target node."""
        target_node = self.nodes.get(target_node_id)
        if not target_node:
            return None

        if not target_node.is_dirty and target_node.cached_buffer is not None:
            return target_node.cached_buffer

        # Recursively evaluate inputs
        input_buffers = {}
        for inp in target_node.inputs:
            conn = inp.get("connection")
            if conn:
                upstream_id = conn[0]
                upstream_buffer = self.evaluate(upstream_id, context)
                if upstream_buffer is not None:
                    input_buffers[inp["id"]] = upstream_buffer

        try:
            result = target_node.compute(input_buffers, context or {})
            target_node.cached_buffer = result
            target_node.is_dirty = False
            return result
        except Exception as e:
            print(f"[OpenComp Compute Error] {target_node.id}: {e}")
            return None

    def clear(self):
        self.nodes.clear()
        self.notify("graph_cleared")
