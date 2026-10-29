/**
 * OpenComp - DAG Node Graph Manager
 * Handles node lifecycle, connections, topological sorting, and pull-based evaluation.
 */

export class Graph {
  constructor() {
    /** @type {Map<string, import('./Node.js').Node>} */
    this.nodes = new Map();
    this.listeners = new Set();
    this.evaluating = false;
  }

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyChange(type, details = {}) {
    for (const listener of this.listeners) {
      try {
        listener(type, details);
      } catch (err) {
        console.error('Graph listener error:', err);
      }
    }
  }

  addNode(node) {
    node.graph = this;
    this.nodes.set(node.id, node);
    this.notifyChange('nodeAdded', { node });
    return node;
  }

  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Disconnect downstream connections to this node
    for (const other of this.nodes.values()) {
      for (const input of other.inputs) {
        if (input.connection && input.connection.nodeId === nodeId) {
          input.connection = null;
          other.markDirty();
        }
      }
    }

    this.nodes.delete(nodeId);
    this.notifyChange('nodeRemoved', { nodeId });
  }

  getNode(nodeId) {
    return this.nodes.get(nodeId);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  connect(fromNodeId, fromPortId, toNodeId, toInputId) {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);
    if (!fromNode || !toNode) return false;

    // Cycle check: can toNode reach fromNode?
    if (this.canReach(toNodeId, fromNodeId)) {
      console.warn('OpenComp: Connection rejected to prevent cyclic dependency.');
      return false;
    }

    const input = toNode.inputs.find(inp => inp.id === toInputId);
    if (!input) return false;

    input.connection = {
      nodeId: fromNodeId,
      outputPortId: fromPortId
    };

    toNode.markDirty();
    this.notifyChange('connectionChanged', { fromNodeId, toNodeId, toInputId });
    return true;
  }

  disconnect(toNodeId, toInputId) {
    const toNode = this.nodes.get(toNodeId);
    if (!toNode) return;

    const input = toNode.inputs.find(inp => inp.id === toInputId);
    if (input && input.connection) {
      input.connection = null;
      toNode.markDirty();
      this.notifyChange('connectionChanged', { toNodeId, toInputId });
    }
  }

  canReach(startId, targetId, visited = new Set()) {
    if (startId === targetId) return true;
    if (visited.has(startId)) return false;
    visited.add(startId);

    const node = this.nodes.get(startId);
    if (!node) return false;

    for (const other of this.nodes.values()) {
      for (const input of other.inputs) {
        if (input.connection && input.connection.nodeId === startId) {
          if (this.canReach(other.id, targetId, visited)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  markDependentsDirty(nodeId) {
    for (const other of this.nodes.values()) {
      for (const input of other.inputs) {
        if (input.connection && input.connection.nodeId === nodeId) {
          if (!other.isDirty) {
            other.isDirty = true;
            other.cachedBuffer = null;
            this.markDependentsDirty(other.id);
          }
        }
      }
    }
  }

  /**
   * Evaluate a node and all of its upstream dependencies
   * @param {string} targetNodeId 
   * @param {Object} context 
   * @returns {import('./PixelBuffer.js').PixelBuffer|null}
   */
  evaluate(targetNodeId, context = {}) {
    const targetNode = this.nodes.get(targetNodeId);
    if (!targetNode) return null;

    if (!targetNode.isDirty && targetNode.cachedBuffer) {
      return targetNode.cachedBuffer;
    }

    // Recursively collect inputs
    const inputBuffers = {};
    for (const input of targetNode.inputs) {
      if (input.connection) {
        const upstreamBuffer = this.evaluate(input.connection.nodeId, context);
        if (upstreamBuffer) {
          inputBuffers[input.id] = upstreamBuffer;
        }
      }
    }

    // Compute target node
    try {
      const result = targetNode.compute(inputBuffers, context);
      targetNode.cachedBuffer = result;
      targetNode.isDirty = false;
      return result;
    } catch (err) {
      console.error(`Error computing node ${targetNode.id}:`, err);
      return null;
    }
  }

  clear() {
    this.nodes.clear();
    this.notifyChange('graphCleared');
  }

  serialize() {
    return {
      version: '1.0',
      nodes: Array.from(this.nodes.values()).map(n => n.serialize())
    };
  }

  deserialize(data, nodeFactory) {
    this.clear();
    if (!data || !Array.isArray(data.nodes)) return;

    // 1. Instantiate nodes
    for (const nodeData of data.nodes) {
      const node = nodeFactory(nodeData.type, nodeData.id);
      if (node) {
        node.deserialize(nodeData);
        this.nodes.set(node.id, node);
        node.graph = this;
      }
    }

    // 2. Mark all dirty
    for (const node of this.nodes.values()) {
      node.markDirty();
    }

    this.notifyChange('graphLoaded');
  }
}

