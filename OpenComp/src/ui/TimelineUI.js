/**
 * OpenComp - Timeline & Playback UI
 * Dopesheet timeline with scrubber, frame range, playback controls, and FPS counter.
 */

export class TimelineUI {
  constructor(containerElement, onFrameChange) {
    this.container = containerElement;
    this.onFrameChange = onFrameChange;

    this.currentFrame = 1;
    this.startFrame = 1;
    this.endFrame = 100;
    this.fps = 24;
    this.isPlaying = false;
    this.playTimer = null;

    this.render();
  }

  setFrame(frame) {
    this.currentFrame = Math.max(this.startFrame, Math.min(this.endFrame, Math.round(frame)));
    this.updateDisplay();
    if (this.onFrameChange) this.onFrameChange(this.currentFrame);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    const playBtn = this.container.querySelector('#btn-play');
    if (playBtn) playBtn.textContent = '⏸ Pause';

    this.playTimer = setInterval(() => {
      let nextFrame = this.currentFrame + 1;
      if (nextFrame > this.endFrame) nextFrame = this.startFrame;
      this.setFrame(nextFrame);
    }, 1000 / this.fps);
  }

  pause() {
    this.isPlaying = false;
    clearInterval(this.playTimer);
    const playBtn = this.container.querySelector('#btn-play');
    if (playBtn) playBtn.textContent = '▶ Play';
  }

  updateDisplay() {
    const curInput = this.container.querySelector('#timeline-cur-frame');
    const scrubber = this.container.querySelector('#timeline-scrubber');
    if (curInput) curInput.value = this.currentFrame;
    if (scrubber) scrubber.value = this.currentFrame;
  }

  render() {
    this.container.innerHTML = `
      <div class="timeline-controls">
        <button id="btn-first" class="btn-tool" title="First Frame">|◀</button>
        <button id="btn-prev" class="btn-tool" title="Step Back (,)">◀</button>
        <button id="btn-play" class="btn-tool btn-play" title="Play / Pause (Space)">▶ Play</button>
        <button id="btn-next" class="btn-tool" title="Step Forward (.)">▶</button>
        <button id="btn-last" class="btn-tool" title="Last Frame">▶|</button>

        <div class="timeline-frame-boxes">
          <input type="number" id="timeline-start-frame" value="${this.startFrame}" class="timeline-num" />
          <input type="number" id="timeline-cur-frame" value="${this.currentFrame}" class="timeline-num cur-frame" />
          <input type="number" id="timeline-end-frame" value="${this.endFrame}" class="timeline-num" />
        </div>

        <input type="range" id="timeline-scrubber" min="${this.startFrame}" max="${this.endFrame}" value="${this.currentFrame}" class="timeline-scrubber" />

        <div class="timeline-fps">
          <span>FPS: <b>${this.fps}</b></span>
        </div>
      </div>
    `;

    // Event listeners
    const scrubber = this.container.querySelector('#timeline-scrubber');
    scrubber.addEventListener('input', (e) => {
      this.setFrame(Number(e.target.value));
    });

    const curInput = this.container.querySelector('#timeline-cur-frame');
    curInput.addEventListener('change', (e) => {
      this.setFrame(Number(e.target.value));
    });

    const startInput = this.container.querySelector('#timeline-start-frame');
    startInput.addEventListener('change', (e) => {
      this.startFrame = Number(e.target.value);
      scrubber.min = this.startFrame;
    });

    const endInput = this.container.querySelector('#timeline-end-frame');
    endInput.addEventListener('change', (e) => {
      this.endFrame = Number(e.target.value);
      scrubber.max = this.endFrame;
    });

    this.container.querySelector('#btn-play').addEventListener('click', () => this.togglePlay());
    this.container.querySelector('#btn-first').addEventListener('click', () => this.setFrame(this.startFrame));
    this.container.querySelector('#btn-last').addEventListener('click', () => this.setFrame(this.endFrame));
    this.container.querySelector('#btn-prev').addEventListener('click', () => this.setFrame(this.currentFrame - 1));
    this.container.querySelector('#btn-next').addEventListener('click', () => this.setFrame(this.currentFrame + 1));

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === ',') {
        this.setFrame(this.currentFrame - 1);
      } else if (e.key === '.') {
        this.setFrame(this.currentFrame + 1);
      }
    });
  }
}

