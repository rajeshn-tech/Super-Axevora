/**
 * OpenComp - DAG Node Graph Viewport UI
 * Interactive node canvas with smooth pan/zoom, Bezier wires, Tab node spawner, and Nuke hotkeys.
 */

import { NODE_REGISTRY, createNode } from '../nodes/index.js';

export class NodeGraphUI {
  constructor(canvasElement, graph, onSelectNode, onDoubleClickNode) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.graph = graph;
    this.onSelectNode = onSelectNode;
    this.onDoubleClickNode = onDoubleClickNode;

    // Viewport transform
    this.panX = 120;
    this.panY = 120;
    this.zoom = 1.0;

    this.selectedNodes = new Set();
    this.hoveredPort = null; // { nodeId, portId, isInput, x, y }

    // Dragging state
    this.isPanning = false;
    this.isDraggingNodes = false;
    this.isConnecting = false;
    this.dragStart = { x: 0, y: 0 };
    this.wireSource = null; // { nodeId, portId, isInput }
    this.currentWireMouse = { x: 0, y: 0 };

    this.initEvents();
  }

  initEvents() {
    const c = this.canvas;

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.2, Math.min(3.0, this.zoom * zoomFactor));

      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.render();
    }, { passive: false });

    c.addEventListener('mousedown', (e) => {
      const rect = c.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const graphPos = this.screenToGraph(mouseX, mouseY);

      // Pan with middle mouse, Alt+Click, or Space+Click
      if (e.button === 1 || (e.button === 0 && (e.altKey || e.spaceKey))) {
        this.isPanning = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        c.style.cursor = 'grabbing';
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        // Check port click (starting a connection wire)
        const port = this.findPortAt(graphPos.x, graphPos.y);
        if (port) {
          this.isConnecting = true;
          this.wireSource = port;
          this.currentWireMouse = graphPos;
          e.preventDefault();
          return;
        }

        // Check node click
        const node = this.findNodeAt(graphPos.x, graphPos.y);
        if (node) {
          if (!e.shiftKey && !this.selectedNodes.has(node.id)) {
            this.selectedNodes.clear();
          }
          this.selectedNodes.add(node.id);
          this.isDraggingNodes = true;
          this.dragStart = graphPos;

          if (this.onSelectNode) this.onSelectNode(node);
        } else {
          // Clicked empty background
          this.selectedNodes.clear();
          if (this.onSelectNode) this.onSelectNode(null);
        }
        this.render();
      }
    });

    window.addEventListener('mousemove', (e) => {
      const rect = c.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const graphPos = this.screenToGraph(mouseX, mouseY);

      if (this.isPanning) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.panX += dx;
        this.panY += dy;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.render();
      } else if (this.isDraggingNodes) {
        const dx = graphPos.x - this.dragStart.x;
        const dy = graphPos.y - this.dragStart.y;
        for (const id of this.selectedNodes) {
          const node = this.graph.getNode(id);
          if (node) {
            node.x += dx;
            node.y += dy;
          }
        }
        this.dragStart = graphPos;
        this.render();
      } else if (this.isConnecting) {
        this.currentWireMouse = graphPos;
        this.hoveredPort = this.findPortAt(graphPos.x, graphPos.y);
        this.render();
      } else {
        // Hover state
        this.hoveredPort = this.findPortAt(graphPos.x, graphPos.y);
        c.style.cursor = this.hoveredPort ? 'pointer' : 'default';
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isConnecting && this.wireSource) {
        const rect = c.getBoundingClientRect();
        const graphPos = this.screenToGraph(e.clientX - rect.left, e.clientY - rect.top);
        const targetPort = this.findPortAt(graphPos.x, graphPos.y);

        if (targetPort && targetPort.nodeId !== this.wireSource.nodeId) {
          // Output to Input connection
          if (!this.wireSource.isInput && targetPort.isInput) {
            this.graph.connect(this.wireSource.nodeId, this.wireSource.portId, targetPort.nodeId, targetPort.portId);
          } else if (this.wireSource.isInput && !targetPort.isInput) {
            this.graph.connect(targetPort.nodeId, targetPort.portId, this.wireSource.nodeId, this.wireSource.portId);
          }
        } else if (!targetPort && this.wireSource.isInput) {
          // Dragged input off into space: disconnect!
          this.graph.disconnect(this.wireSource.nodeId, this.wireSource.portId);
        }
      }

      this.isPanning = false;
      this.isDraggingNodes = false;
      this.isConnecting = false;
      this.wireSource = null;
      this.render();
    });

    // Double click to open node properties
    c.addEventListener('dblclick', (e) => {
      const rect = c.getBoundingClientRect();
      const graphPos = this.screenToGraph(e.clientX - rect.left, e.clientY - rect.top);
      const node = this.findNodeAt(graphPos.x, graphPos.y);
      if (node && this.onDoubleClickNode) {
        this.onDoubleClickNode(node);
      }
    });

    // Keybindings (Nuke Shortcuts)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      const selectedList = Array.from(this.selectedNodes).map(id => this.graph.getNode(id)).filter(Boolean);
      const primaryNode = selectedList[0];

      // Tab key: open Node Spawner Search
      if (e.key === 'Tab') {
        e.preventDefault();
        this.openNodeSearchPopup();
        return;
      }

      // Delete or Backspace: Remove selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        for (const node of selectedList) {
          this.graph.removeNode(node.id);
        }
        this.selectedNodes.clear();
        this.render();
        return;
      }

      // 'D': Disable / Enable node (Nuke hotkey)
      if (e.key === 'd' || e.key === 'D') {
        for (const node of selectedList) {
          node.disabled = !node.disabled;
          node.markDirty();
        }
        this.render();
        return;
      }

      // Number keys 1-9: Connect to Viewer Input 1-9 (Famous Nuke hotkey!)
      if (e.key >= '1' && e.key <= '9' && primaryNode) {
        let viewer = this.graph.getAllNodes().find(n => n.type === 'Viewer');
        if (!viewer) {
          viewer = createNode('Viewer', 'Viewer1', primaryNode.x, primaryNode.y + 160);
          this.graph.addNode(viewer);
        }
        const portId = e.key;
        this.graph.connect(primaryNode.id, 'out', viewer.id, portId);
        viewer.setKnobValue('activeInput', portId);
        this.render();
        return;
      }

      // Fast Nuke node creation hotkeys
      const keyUpper = e.key.toUpperCase();
      let spawnType = null;
      if (keyUpper === 'M') spawnType = 'Merge';
      else if (keyUpper === 'G') spawnType = 'Grade';
      else if (keyUpper === 'C') spawnType = 'ColorCorrect';
      else if (keyUpper === 'B') spawnType = 'Blur';
      else if (keyUpper === 'T') spawnType = 'Transform';
      else if (keyUpper === 'K') spawnType = 'Keyer';
      else if (keyUpper === 'R') spawnType = 'Read';
      else if (keyUpper === 'O') spawnType = 'Roto';
      else if (e.key === '.') spawnType = 'Dot';

      if (spawnType) {
        const posX = primaryNode ? primaryNode.x : this.screenToGraph(c.width * 0.5, c.height * 0.5).x;
        const posY = primaryNode ? primaryNode.y + 80 : this.screenToGraph(c.width * 0.5, c.height * 0.5).y;
        const newNode = createNode(spawnType, null, posX, posY);
        if (newNode) {
          this.graph.addNode(newNode);
          if (primaryNode && newNode.inputs.length > 0) {
            // Auto connect to primary input (B or in)
            const inPort = newNode.inputs.find(inp => inp.id === 'B' || inp.id === 'in');
            if (inPort) {
              this.graph.connect(primaryNode.id, 'out', newNode.id, inPort.id);
            }
          }
          this.selectedNodes.clear();
          this.selectedNodes.add(newNode.id);
          if (this.onSelectNode) this.onSelectNode(newNode);
          this.render();
        }
      }
    });

    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    this.render();
  }

  screenToGraph(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom
    };
  }

  graphToScreen(gx, gy) {
    return {
      x: gx * this.zoom + this.panX,
      y: gy * this.zoom + this.panY
    };
  }

  findNodeAt(gx, gy) {
    const nodes = this.graph.getAllNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (gx >= n.x && gx <= n.x + n.width && gy >= n.y && gy <= n.y + n.height) {
        return n;
      }
    }
    return null;
  }

  findPortAt(gx, gy) {
    const hitRadius = 14;
    for (const node of this.graph.getAllNodes()) {
      // Check inputs
      const inCount = node.inputs.length;
      for (let i = 0; i < inCount; i++) {
        const inp = node.inputs[i];
        const portX = node.x + (node.width / (inCount + 1)) * (i + 1);
        const portY = node.y;
        const d = Math.hypot(gx - portX, gy - portY);
        if (d <= hitRadius) {
          return { nodeId: node.id, portId: inp.id, isInput: true, x: portX, y: portY, label: inp.label };
        }
      }

      // Check outputs
      const outCount = node.outputs.length;
      for (let i = 0; i < outCount; i++) {
        const out = node.outputs[i];
        const portX = node.x + (node.width / (outCount + 1)) * (i + 1);
        const portY = node.y + node.height;
        const d = Math.hypot(gx - portX, gy - portY);
        if (d <= hitRadius) {
          return { nodeId: node.id, portId: out.id, isInput: false, x: portX, y: portY, label: out.name };
        }
      }
    }
    return null;
  }

  openNodeSearchPopup() {
    const popup = document.getElementById('node-search-popup');
    const input = document.getElementById('node-search-input');
    if (!popup || !input) return;

    popup.style.display = 'block';
    input.value = '';
    input.focus();
  }

  render() {
    const ctx = this.ctx;
    const c = this.canvas;

    ctx.save();
    // Background
    ctx.fillStyle = '#232323';
    ctx.fillRect(0, 0, c.width, c.height);

    // Grid dots
    const gridSize = 24 * this.zoom;
    const offsetX = this.panX % gridSize;
    const offsetY = this.panY % gridSize;

    ctx.fillStyle = '#2e2e2e';
    for (let x = offsetX; x < c.width; x += gridSize) {
      for (let y = offsetY; y < c.height; y += gridSize) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // 1. Draw Connection Wires (Cubic Bezier pipes)
    for (const node of this.graph.getAllNodes()) {
      const inCount = node.inputs.length;
      for (let i = 0; i < inCount; i++) {
        const inp = node.inputs[i];
        if (inp.connection) {
          const upstream = this.graph.getNode(inp.connection.nodeId);
          if (upstream) {
            const startX = upstream.x + upstream.width * 0.5;
            const startY = upstream.y + upstream.height;
            const endX = node.x + (node.width / (inCount + 1)) * (i + 1);
            const endY = node.y;

            this.drawWire(ctx, startX, startY, endX, endY, inp.id === 'mask' ? '#999' : '#e6a100');
          }
        }
      }
    }

    // Draw active wire currently being dragged
    if (this.isConnecting && this.wireSource) {
      this.drawWire(ctx, this.wireSource.x, this.wireSource.y, this.currentWireMouse.x, this.currentWireMouse.y, '#51cf66', true);
    }

    // 2. Draw Nodes
    for (const node of this.graph.getAllNodes()) {
      const isSelected = this.selectedNodes.has(node.id);

      if (node.type === 'Dot') {
        // Compact Dot Node
        ctx.fillStyle = isSelected ? '#ff922b' : node.color;
        ctx.beginPath();
        ctx.arc(node.x + 8, node.y + 8, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
        continue;
      }

      // Node Box Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Node Body
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, node.height, 4);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Selection Highlight Border
      ctx.strokeStyle = isSelected ? '#ff922b' : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.stroke();

      // Node Name Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x + node.width * 0.5, node.y + node.height * 0.5);

      // Disabled State Overlay (Red Cross like Nuke 'D')
      if (node.disabled) {
        ctx.strokeStyle = '#fa5252';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.x + node.width, node.y + node.height);
        ctx.moveTo(node.x + node.width, node.y);
        ctx.lineTo(node.x, node.y + node.height);
        ctx.stroke();
      }

      // Input Port Dots & Labels
      const inCount = node.inputs.length;
      for (let i = 0; i < inCount; i++) {
        const inp = node.inputs[i];
        const px = node.x + (node.width / (inCount + 1)) * (i + 1);
        const py = node.y;

        ctx.fillStyle = inp.connection ? '#ffbb33' : '#777';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Small input port label (e.g. B, A, mask)
        if (inCount > 1) {
          ctx.font = '9px Inter, sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(inp.id, px, py - 8);
        }
      }

      // Output Port Dot
      const outX = node.x + node.width * 0.5;
      const outY = node.y + node.height;
      ctx.fillStyle = '#ffbb33';
      ctx.beginPath();
      ctx.arc(outX, outY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawWire(ctx, x0, y0, x1, y1, color = '#e6a100', dashed = false) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    if (dashed) {
      ctx.setLineDash([6, 4]);
    } else {
      ctx.setLineDash([]);
    }

    // Cubic Bezier curve downwards
    const dy = Math.max(30, Math.abs(y1 - y0) * 0.5);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(x0, y0 + dy, x1, y1 - dy, x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

