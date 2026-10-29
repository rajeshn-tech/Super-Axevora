/**
 * OpenComp - Main Application Orchestrator
 * Coordinates DAG graph execution, Viewer rendering, Node Graph, Properties, and Menu Actions.
 */

import { Graph } from './core/Graph.js';
import { createNode, NODE_REGISTRY, NODE_MENU } from './nodes/index.js';
import { ViewerUI } from './ui/ViewerUI.js';
import { NodeGraphUI } from './ui/NodeGraphUI.js';
import { PropertiesUI } from './ui/PropertiesUI.js';
import { TimelineUI } from './ui/TimelineUI.js';

class OpenCompApp {
  constructor() {
    this.graph = new Graph();

    // DOM Elements
    this.viewerCanvas = document.getElementById('viewer-canvas');
    this.viewerControls = document.getElementById('viewer-toolbar');
    this.viewerInfo = document.getElementById('viewer-info-bar');
    this.nodeCanvas = document.getElementById('node-graph-canvas');
    this.propertiesContainer = document.getElementById('properties-container');
    this.timelineContainer = document.getElementById('timeline-bar');

    // UI Modules
    this.viewerUI = new ViewerUI(this.viewerCanvas, this.viewerControls, this.viewerInfo);
    this.propertiesUI = new PropertiesUI(
      this.propertiesContainer,
      (node) => this.onNodeParamChange(node),
      (node) => this.onExportRender(node)
    );
    this.nodeGraphUI = new NodeGraphUI(
      this.nodeCanvas,
      this.graph,
      (node) => this.propertiesUI.showNode(node),
      (node) => this.propertiesUI.showNode(node)
    );
    this.timelineUI = new TimelineUI(
      this.timelineContainer,
      (frame) => this.onFrameChange(frame)
    );

    this.viewerUI.onViewerUpdate = () => this.evaluateGraph();

    // Wire Graph change events
    this.graph.addListener((type) => {
      this.nodeGraphUI.render();
      this.evaluateGraph();
    });

    this.initToolbarEvents();
    this.initNodeSearchPopup();
    this.initMenuEvents();

    // Load default production VFX preset
    this.loadPresetGreenscreen();
  }

  evaluateGraph() {
    // Find active Viewer node
    const viewers = this.graph.getAllNodes().filter(n => n.type === 'Viewer');
    if (viewers.length === 0) {
      this.viewerUI.setBuffer(null);
      return;
    }

    const viewer = viewers[0];
    this.viewerUI.setViewerNode(viewer);

    // Pull-based evaluation starting from the Viewer node
    const outputBuffer = this.graph.evaluate(viewer.id, {
      frame: this.timelineUI.currentFrame
    });

    this.viewerUI.setBuffer(outputBuffer);
  }

  onNodeParamChange(node) {
    this.nodeGraphUI.render();
    this.evaluateGraph();
  }

  onFrameChange(frame) {
    this.evaluateGraph();
  }

  onExportRender(writeNode) {
    const outputBuffer = this.graph.evaluate(writeNode.id);
    if (outputBuffer) {
      writeNode.exportFrame(outputBuffer);
    } else {
      alert('OpenComp: Nothing to export. Please connect an input to the Write node.');
    }
  }

  initToolbarEvents() {
    // Viewer Toolbar (Exposure, Gamma, Channels, Input 1/2)
    const expSlider = document.getElementById('viewer-exposure-slider');
    const expVal = document.getElementById('viewer-exposure-val');
    if (expSlider) {
      expSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.viewerUI.exposure = val;
        if (expVal) expVal.textContent = val.toFixed(1);
        this.viewerUI.render();
      });
    }

    const gammaSlider = document.getElementById('viewer-gamma-slider');
    const gammaVal = document.getElementById('viewer-gamma-val');
    if (gammaSlider) {
      gammaSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.viewerUI.gamma = val;
        if (gammaVal) gammaVal.textContent = val.toFixed(2);
        this.viewerUI.render();
      });
    }

    // Reset exposure / gamma buttons
    const resetExp = document.getElementById('btn-reset-exp');
    if (resetExp) {
      resetExp.addEventListener('click', () => {
        this.viewerUI.exposure = 0.0;
        if (expSlider) expSlider.value = 0;
        if (expVal) expVal.textContent = '0.0';
        this.viewerUI.render();
      });
    }

    const resetGamma = document.getElementById('btn-reset-gamma');
    if (resetGamma) {
      resetGamma.addEventListener('click', () => {
        this.viewerUI.gamma = 1.0;
        if (gammaSlider) gammaSlider.value = 1.0;
        if (gammaVal) gammaVal.textContent = '1.0';
        this.viewerUI.render();
      });
    }

    // Channel isolation buttons (RGB, R, G, B, A, Luma)
    const chanButtons = document.querySelectorAll('.btn-channel');
    chanButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        chanButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewerUI.channelMode = btn.dataset.channel;
        this.viewerUI.render();
      });
    });

    // View Input 1 / Input 2 toggle
    const btnInput1 = document.getElementById('btn-view-input-1');
    const btnInput2 = document.getElementById('btn-view-input-2');
    if (btnInput1 && btnInput2) {
      btnInput1.addEventListener('click', () => {
        btnInput1.classList.add('active');
        btnInput2.classList.remove('active');
        const viewer = this.graph.getAllNodes().find(n => n.type === 'Viewer');
        if (viewer) {
          viewer.setKnobValue('activeInput', '1');
          this.evaluateGraph();
        }
      });
      btnInput2.addEventListener('click', () => {
        btnInput2.classList.add('active');
        btnInput1.classList.remove('active');
        const viewer = this.graph.getAllNodes().find(n => n.type === 'Viewer');
        if (viewer) {
          viewer.setKnobValue('activeInput', '2');
          this.evaluateGraph();
        }
      });
    }

    // Fit View button
    const btnFit = document.getElementById('btn-fit-view');
    if (btnFit) {
      btnFit.addEventListener('click', () => this.viewerUI.fitToView());
    }
  }

  initNodeSearchPopup() {
    const popup = document.getElementById('node-search-popup');
    const input = document.getElementById('node-search-input');
    const list = document.getElementById('node-search-results');
    if (!popup || !input || !list) return;

    const renderList = (filter = '') => {
      list.innerHTML = '';
      const filterLower = filter.toLowerCase().trim();
      const nodeTypes = Object.keys(NODE_REGISTRY);

      const matches = nodeTypes.filter(type => type.toLowerCase().includes(filterLower));
      matches.forEach((type, index) => {
        const item = document.createElement('div');
        item.className = `search-item ${index === 0 ? 'selected' : ''}`;
        item.textContent = type;
        item.addEventListener('click', () => {
          this.spawnNodeFromSearch(type);
          popup.style.display = 'none';
        });
        list.appendChild(item);
      });
    };

    input.addEventListener('input', (e) => {
      renderList(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('.search-item');
      let selectedIdx = Array.from(items).findIndex(el => el.classList.contains('selected'));

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIdx < items.length - 1) {
          items[selectedIdx].classList.remove('selected');
          items[selectedIdx + 1].classList.add('selected');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIdx > 0) {
          items[selectedIdx].classList.remove('selected');
          items[selectedIdx - 1].classList.add('selected');
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = list.querySelector('.search-item.selected') || items[0];
        if (selected) {
          this.spawnNodeFromSearch(selected.textContent);
          popup.style.display = 'none';
        }
      } else if (e.key === 'Escape') {
        popup.style.display = 'none';
      }
    });

    // Close on outside click
    window.addEventListener('mousedown', (e) => {
      if (popup.style.display === 'block' && !popup.contains(e.target)) {
        popup.style.display = 'none';
      }
    });
  }

  spawnNodeFromSearch(type) {
    const c = this.nodeCanvas;
    const centerGraph = this.nodeGraphUI.screenToGraph(c.width * 0.5, c.height * 0.5);
    const node = createNode(type, null, centerGraph.x, centerGraph.y);
    if (node) {
      this.graph.addNode(node);
      this.nodeGraphUI.selectedNodes.clear();
      this.nodeGraphUI.selectedNodes.add(node.id);
      this.propertiesUI.showNode(node);
      this.nodeGraphUI.render();
    }
  }

  initMenuEvents() {
    // Presets
    document.getElementById('menu-preset-greenscreen')?.addEventListener('click', () => this.loadPresetGreenscreen());
    document.getElementById('menu-preset-grade')?.addEventListener('click', () => this.loadPresetColorGrade());
    document.getElementById('menu-preset-wipe')?.addEventListener('click', () => this.loadPresetWipeCompare());

    // File Actions
    document.getElementById('menu-save-project')?.addEventListener('click', () => this.saveProject());
    document.getElementById('menu-open-project')?.addEventListener('click', () => {
      document.getElementById('file-project-open')?.click();
    });
    document.getElementById('file-project-open')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.openProject(file);
    });

    // Clear Graph
    document.getElementById('menu-new-project')?.addEventListener('click', () => {
      if (confirm('Create new empty project? Current unsaved graph will be cleared.')) {
        this.graph.clear();
        this.propertiesUI.clear();
        this.viewerUI.setBuffer(null);
      }
    });
  }

  saveProject() {
    const data = this.graph.serialize();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'OpenComp_Project.comp';
    a.click();
    URL.revokeObjectURL(url);
  }

  openProject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        this.graph.deserialize(data, (type, id) => createNode(type, id));
        this.nodeGraphUI.render();
        this.evaluateGraph();
        this.viewerUI.fitToView();
      } catch (err) {
        alert('Failed to load OpenComp project file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --- Preloaded VFX Presets ---

  loadPresetGreenscreen() {
    this.graph.clear();

    // 1. Background Read node
    const bgRead = createNode('Read', 'Read_BG', 80, 60);
    bgRead.setKnobValue('sourceType', 'background');
    this.graph.addNode(bgRead);

    // 2. Foreground Greenscreen Read node
    const fgRead = createNode('Read', 'Read_Actor', 320, 60);
    fgRead.setKnobValue('sourceType', 'greenscreen');
    this.graph.addNode(fgRead);

    // 3. Chroma Keyer Node
    const keyer = createNode('Keyer', 'Keyer1', 320, 160);
    keyer.setKnobValue('tolerance', 0.28);
    keyer.setKnobValue('softness', 0.16);
    keyer.setKnobValue('despill', 1.1);
    this.graph.addNode(keyer);
    this.graph.connect(fgRead.id, 'out', keyer.id, 'in');

    // 4. Color Grading on Actor to match Background lighting
    const grade = createNode('Grade', 'Grade_Actor', 320, 260);
    grade.setKnobValue('gain', 1.05);
    grade.setKnobValue('gamma', 1.15);
    grade.setKnobValue('lift', -0.02);
    this.graph.addNode(grade);
    this.graph.connect(keyer.id, 'out', grade.id, 'in');

    // 5. Merge Over Background
    const merge = createNode('Merge', 'Merge1', 200, 360);
    merge.setKnobValue('operation', 'over');
    this.graph.addNode(merge);
    this.graph.connect(bgRead.id, 'out', merge.id, 'B'); // B = Background
    this.graph.connect(grade.id, 'out', merge.id, 'A');  // A = Foreground

    // 6. Viewer node
    const viewer = createNode('Viewer', 'Viewer1', 200, 480);
    this.graph.addNode(viewer);
    this.graph.connect(merge.id, 'out', viewer.id, '1'); // Input 1: Final Composite
    this.graph.connect(fgRead.id, 'out', viewer.id, '2'); // Input 2: Raw Greenscreen

    // 7. Write Node for rendering
    const write = createNode('Write', 'Write1', 400, 480);
    this.graph.addNode(write);
    this.graph.connect(merge.id, 'out', write.id, 'in');

    this.nodeGraphUI.selectedNodes.clear();
    this.nodeGraphUI.selectedNodes.add(merge.id);
    this.propertiesUI.showNode(merge);

    this.nodeGraphUI.render();
    this.evaluateGraph();
    setTimeout(() => this.viewerUI.fitToView(), 100);
  }

  loadPresetColorGrade() {
    this.graph.clear();

    const read = createNode('Read', 'Read_City', 200, 60);
    read.setKnobValue('sourceType', 'background');
    this.graph.addNode(read);

    const cc = createNode('ColorCorrect', 'ColorCorrect1', 200, 160);
    cc.setKnobValue('saturation', 1.35);
    cc.setKnobValue('contrast', 1.18);
    this.graph.addNode(cc);
    this.graph.connect(read.id, 'out', cc.id, 'in');

    // Glow branch: Blur + Merge Plus
    const blur = createNode('Blur', 'Blur_Glow', 380, 240);
    blur.setKnobValue('size', 28.0);
    this.graph.addNode(blur);
    this.graph.connect(cc.id, 'out', blur.id, 'in');

    const gradeGlow = createNode('Grade', 'Grade_Glow', 380, 330);
    gradeGlow.setKnobValue('multiply', 0.85);
    this.graph.addNode(gradeGlow);
    this.graph.connect(blur.id, 'out', gradeGlow.id, 'in');

    const mergePlus = createNode('Merge', 'Merge_Plus', 200, 420);
    mergePlus.setKnobValue('operation', 'plus');
    this.graph.addNode(mergePlus);
    this.graph.connect(cc.id, 'out', mergePlus.id, 'B');
    this.graph.connect(gradeGlow.id, 'out', mergePlus.id, 'A');

    const viewer = createNode('Viewer', 'Viewer1', 200, 530);
    this.graph.addNode(viewer);
    this.graph.connect(mergePlus.id, 'out', viewer.id, '1');
    this.graph.connect(read.id, 'out', viewer.id, '2');

    this.nodeGraphUI.render();
    this.evaluateGraph();
    setTimeout(() => this.viewerUI.fitToView(), 100);
  }

  loadPresetWipeCompare() {
    this.graph.clear();

    const read = createNode('Read', 'Read1', 120, 60);
    read.setKnobValue('sourceType', 'background');
    this.graph.addNode(read);

    const grade = createNode('Grade', 'Grade_Cinematic', 280, 160);
    grade.setKnobValue('gamma', 1.4);
    grade.setKnobValue('gain', 1.2);
    grade.setKnobValue('lift', -0.05);
    this.graph.addNode(grade);
    this.graph.connect(read.id, 'out', grade.id, 'in');

    const viewer = createNode('Viewer', 'Viewer1', 200, 300);
    viewer.setKnobValue('compareMode', 'wipe_h');
    viewer.setKnobValue('wipePosition', 0.5);
    this.graph.addNode(viewer);
    this.graph.connect(grade.id, 'out', viewer.id, '1'); // Input 1: Graded
    this.graph.connect(read.id, 'out', viewer.id, '2');  // Input 2: Original

    this.nodeGraphUI.render();
    this.evaluateGraph();
    setTimeout(() => this.viewerUI.fitToView(), 100);
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.openComp = new OpenCompApp();
});

