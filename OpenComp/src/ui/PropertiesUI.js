/**
 * OpenComp - Properties & Knobs Control Panel UI
 * Generates dynamic parameter controls for the selected node with live slider binding.
 */

import { PixelBuffer } from '../core/PixelBuffer.js';

export class PropertiesUI {
  constructor(containerElement, onParamChange, onRenderRequest) {
    this.container = containerElement;
    this.onParamChange = onParamChange;
    this.onRenderRequest = onRenderRequest;
    this.currentNode = null;
  }

  showNode(node) {
    this.currentNode = node;
    this.render();
  }

  clear() {
    this.currentNode = null;
    this.container.innerHTML = `
      <div class="empty-properties">
        <p>No node selected</p>
        <small>Select or double-click any node in the graph to edit parameters.</small>
      </div>
    `;
  }

  render() {
    const node = this.currentNode;
    if (!node) {
      this.clear();
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'node-properties-card';

    // Header with category badge and disable toggle
    const header = document.createElement('div');
    header.className = 'prop-header';
    header.style.borderLeft = `5px solid ${node.color}`;

    header.innerHTML = `
      <div class="prop-title-row">
        <input type="text" class="prop-node-name" value="${node.name}" />
        <span class="prop-node-type">${node.type}</span>
      </div>
      <div class="prop-header-actions">
        <label class="prop-disable-label" title="Disable / Bypass Node (Hotkey: D)">
          <input type="checkbox" id="prop-disable-chk" ${node.disabled ? 'checked' : ''} />
          <span>Disable [D]</span>
        </label>
      </div>
    `;

    const nameInput = header.querySelector('.prop-node-name');
    nameInput.addEventListener('change', (e) => {
      node.name = e.target.value.trim() || node.id;
      if (this.onParamChange) this.onParamChange(node);
    });

    const disableChk = header.querySelector('#prop-disable-chk');
    disableChk.addEventListener('change', (e) => {
      node.disabled = e.target.checked;
      node.markDirty();
      if (this.onParamChange) this.onParamChange(node);
    });

    panel.appendChild(header);

    // Knobs container
    const knobsBody = document.createElement('div');
    knobsBody.className = 'prop-knobs-body';

    // Special controls for Read node: File Upload
    if (node.type === 'Read') {
      const uploadRow = document.createElement('div');
      uploadRow.className = 'prop-knob-row file-upload-row';
      uploadRow.innerHTML = `
        <label>Upload Image</label>
        <input type="file" id="prop-file-input" accept="image/*" />
      `;
      const fileInput = uploadRow.querySelector('#prop-file-input');
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              const imgData = ctx.getImageData(0, 0, img.width, img.height);
              const buf = PixelBuffer.fromImageData(imgData);
              node.setUploadedImage(buf);
              if (this.onParamChange) this.onParamChange(node);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
      knobsBody.appendChild(uploadRow);
    }

    // Special controls for Write node: Export Button
    if (node.type === 'Write') {
      const exportRow = document.createElement('div');
      exportRow.className = 'prop-knob-row export-action-row';
      exportRow.innerHTML = `
        <button id="prop-export-btn" class="btn-primary">Export Rendered Frame</button>
      `;
      const exportBtn = exportRow.querySelector('#prop-export-btn');
      exportBtn.addEventListener('click', () => {
        if (this.onRenderRequest) this.onRenderRequest(node);
      });
      knobsBody.appendChild(exportRow);
    }

    // Render each knob
    for (const [key, knob] of Object.entries(node.knobs)) {
      const row = document.createElement('div');
      row.className = 'prop-knob-row';

      const label = document.createElement('label');
      label.textContent = knob.label;
      row.appendChild(label);

      const controlWrap = document.createElement('div');
      controlWrap.className = 'knob-control-wrap';

      if (knob.type === 'select') {
        const select = document.createElement('select');
        select.className = 'prop-select';
        for (const opt of knob.options || []) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.value === knob.value) option.selected = true;
          select.appendChild(option);
        }
        select.addEventListener('change', (e) => {
          node.setKnobValue(key, e.target.value);
          if (this.onParamChange) this.onParamChange(node);
        });
        controlWrap.appendChild(select);
      } else if (knob.type === 'number') {
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = knob.min ?? 0;
        slider.max = knob.max ?? 1;
        slider.step = knob.step ?? 0.01;
        slider.value = knob.value;
        slider.className = 'prop-slider';

        const numInput = document.createElement('input');
        numInput.type = 'number';
        numInput.step = knob.step ?? 0.01;
        numInput.value = Number(knob.value).toFixed(2);
        numInput.className = 'prop-num-input';

        slider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          numInput.value = val.toFixed(2);
          node.setKnobValue(key, val);
          if (this.onParamChange) this.onParamChange(node);
        });

        numInput.addEventListener('change', (e) => {
          const val = parseFloat(e.target.value);
          slider.value = val;
          node.setKnobValue(key, val);
          if (this.onParamChange) this.onParamChange(node);
        });

        controlWrap.appendChild(slider);
        controlWrap.appendChild(numInput);
      } else if (knob.type === 'boolean') {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!knob.value;
        chk.className = 'prop-checkbox';
        chk.addEventListener('change', (e) => {
          node.setKnobValue(key, e.target.checked);
          if (this.onParamChange) this.onParamChange(node);
        });
        controlWrap.appendChild(chk);
      } else if (knob.type === 'text') {
        const txt = document.createElement('input');
        txt.type = 'text';
        txt.value = knob.value || '';
        txt.className = 'prop-text-input';
        txt.addEventListener('change', (e) => {
          node.setKnobValue(key, e.target.value);
          if (this.onParamChange) this.onParamChange(node);
        });
        controlWrap.appendChild(txt);
      }

      row.appendChild(controlWrap);
      knobsBody.appendChild(row);
    }

    panel.appendChild(knobsBody);

    this.container.innerHTML = '';
    this.container.appendChild(panel);
  }
}

