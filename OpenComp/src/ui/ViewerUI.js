/**
 * OpenComp - Interactive Viewport UI
 * Canvas renderer with real-time Zoom/Pan, Pixel Inspector, Exposure/Gamma, Channel modes, and Wipe compare.
 */

export class ViewerUI {
  constructor(canvasElement, controlsContainer, infoBarElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.controls = controlsContainer;
    this.infoBar = infoBarElement;

    this.currentBuffer = null;
    this.exposure = 0.0;
    this.gamma = 1.0;
    this.channelMode = 'RGBA';

    // Viewport transform
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Wipe compare drag state
    this.isDraggingWipe = false;
    this.activeViewerNode = null;

    this.initEvents();
  }

  setViewerNode(node) {
    this.activeViewerNode = node;
  }

  setBuffer(buffer) {
    this.currentBuffer = buffer;
    this.render();
  }

  initEvents() {
    const c = this.canvas;

    // Mouse Wheel Zoom
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.05, Math.min(20.0, this.zoom * zoomFactor));

      // Zoom towards mouse pointer
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;

      this.render();
      this.updateZoomDisplay();
    }, { passive: false });

    // Pan & Pixel Inspector
    c.addEventListener('mousedown', (e) => {
      // Middle click or Space+LeftClick or Alt+LeftClick for Pan
      if (e.button === 1 || (e.button === 0 && (e.spaceKey || e.altKey))) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        c.style.cursor = 'grabbing';
        e.preventDefault();
      } else if (e.button === 0 && this.activeViewerNode) {
        // Check if clicking near wipe divider line
        const compareMode = this.activeViewerNode.getKnobValue('compareMode');
        if (compareMode === 'wipe_h' && this.currentBuffer) {
          const rect = c.getBoundingClientRect();
          const imgX = (e.clientX - rect.left - this.panX) / this.zoom;
          const wipePos = Number(this.activeViewerNode.getKnobValue('wipePosition')) ?? 0.5;
          const wipeX = this.currentBuffer.width * wipePos;

          if (Math.abs(imgX - wipeX) < 15 / this.zoom) {
            this.isDraggingWipe = true;
            e.preventDefault();
          }
        }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.render();
      } else if (this.isDraggingWipe && this.activeViewerNode && this.currentBuffer) {
        const rect = c.getBoundingClientRect();
        const imgX = (e.clientX - rect.left - this.panX) / this.zoom;
        const newPos = Math.max(0.0, Math.min(1.0, imgX / this.currentBuffer.width));
        this.activeViewerNode.setKnobValue('wipePosition', newPos);
        if (this.onViewerUpdate) this.onViewerUpdate();
      } else {
        this.updatePixelInspector(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isPanning = false;
      this.isDraggingWipe = false;
      c.style.cursor = 'crosshair';
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') {
        this.fitToView();
      } else if (e.key === 'h' || e.key === 'H') {
        this.actualSize();
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
    this.resizeCanvas();
  }

  resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    this.render();
  }

  fitToView() {
    if (!this.currentBuffer) return;
    const padding = 24;
    const availW = this.canvas.width - padding * 2;
    const availH = this.canvas.height - padding * 2;

    const scaleW = availW / this.currentBuffer.width;
    const scaleH = availH / this.currentBuffer.height;
    this.zoom = Math.min(scaleW, scaleH);

    this.panX = (this.canvas.width - this.currentBuffer.width * this.zoom) * 0.5;
    this.panY = (this.canvas.height - this.currentBuffer.height * this.zoom) * 0.5;

    this.render();
    this.updateZoomDisplay();
  }

  actualSize() {
    if (!this.currentBuffer) return;
    this.zoom = 1.0;
    this.panX = (this.canvas.width - this.currentBuffer.width) * 0.5;
    this.panY = (this.canvas.height - this.currentBuffer.height) * 0.5;
    this.render();
    this.updateZoomDisplay();
  }

  updateZoomDisplay() {
    const zoomLabel = document.getElementById('viewer-zoom-label');
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  updatePixelInspector(e) {
    if (!this.currentBuffer || !this.infoBar) return;
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const imgX = Math.floor((mouseX - this.panX) / this.zoom);
    const imgY = Math.floor((mouseY - this.panY) / this.zoom);

    if (imgX >= 0 && imgX < this.currentBuffer.width && imgY >= 0 && imgY < this.currentBuffer.height) {
      const [r, g, b, a] = this.currentBuffer.getPixel(imgX, imgY);
      this.infoBar.innerHTML = `
        <span class="info-coord">X: <b>${imgX}</b> Y: <b>${imgY}</b></span>
        <span class="info-color">
          <span style="color:#ff6b6b">R: <b>${r.toFixed(4)}</b></span>
          <span style="color:#51cf66">G: <b>${g.toFixed(4)}</b></span>
          <span style="color:#339af0">B: <b>${b.toFixed(4)}</b></span>
          <span style="color:#ced4da">A: <b>${a.toFixed(4)}</b></span>
        </span>
        <span class="info-res">${this.currentBuffer.width} x ${this.currentBuffer.height} (32-bit Float Linear)</span>
      `;
    } else {
      this.infoBar.innerHTML = `
        <span class="info-res">${this.currentBuffer.width} x ${this.currentBuffer.height} (32-bit Float Linear)</span>
      `;
    }
  }

  render() {
    const ctx = this.ctx;
    const c = this.canvas;

    // Dark checkerboard viewport background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, c.width, c.height);

    if (!this.currentBuffer) {
      ctx.fillStyle = '#666';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No Image (Connect a node to Viewer [1])', c.width * 0.5, c.height * 0.5);
      return;
    }

    // Prepare display image from 32-bit float buffer with exposure & gamma
    if (!this.offlineCanvas) {
      this.offlineCanvas = document.createElement('canvas');
      this.offlineCtx = this.offlineCanvas.getContext('2d');
    }
    if (this.offlineCanvas.width !== this.currentBuffer.width || this.offlineCanvas.height !== this.currentBuffer.height) {
      this.offlineCanvas.width = this.currentBuffer.width;
      this.offlineCanvas.height = this.currentBuffer.height;
    }

    const imgData = this.currentBuffer.toImageData(this.exposure, this.gamma, this.channelMode);
    this.offlineCtx.putImageData(imgData, 0, 0);

    // Draw transformed image
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Image border / shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    ctx.drawImage(this.offlineCanvas, 0, 0);
    ctx.restore();
  }
}

