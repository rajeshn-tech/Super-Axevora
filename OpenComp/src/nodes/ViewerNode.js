/**
 * OpenComp - Viewer Node
 * Nuke-style interactive viewport sink with multi-input (1-9) switching and A/B split-screen wipe compare.
 */

import { Node } from '../core/Node.js';

export class ViewerNode extends Node {
  constructor(id = 'Viewer1', x = 0, y = 0) {
    super(id, 'Viewer', 'Viewer', x, y);
    this.width = 110;
    this.height = 42;

    // Multi-inputs like Nuke Viewer
    this.addInput('1', '1', '1 (Main A)');
    this.addInput('2', '2', '2 (Main B)');
    this.addInput('3', '3', '3');
    this.addInput('4', '4', '4');

    this.addKnob('activeInput', 'Active Input', 'select', '1', {
      options: [
        { label: 'Input 1', value: '1' },
        { label: 'Input 2', value: '2' },
        { label: 'Input 3', value: '3' },
        { label: 'Input 4', value: '4' }
      ]
    });

    this.addKnob('compareMode', 'Comparison Mode', 'select', 'single', {
      options: [
        { label: 'Single View', value: 'single' },
        { label: 'A/B Horizontal Wipe', value: 'wipe_h' },
        { label: 'A/B Vertical Wipe', value: 'wipe_v' },
        { label: 'A/B Side-by-Side', value: 'side_by_side' },
        { label: 'A/B Difference', value: 'diff' }
      ]
    });

    this.addKnob('wipePosition', 'Wipe Split Position', 'number', 0.5, { min: 0.0, max: 1.0, step: 0.01 });
  }

  compute(inputs, context = {}) {
    const compareMode = this.getKnobValue('compareMode') || 'single';
    const activeKey = this.getKnobValue('activeInput') || '1';

    if (compareMode === 'single') {
      return inputs[activeKey] || inputs['1'] || null;
    }

    // A/B Comparison between input '1' and input '2'
    const bufA = inputs['1'];
    const bufB = inputs['2'];

    if (!bufA && !bufB) return null;
    if (!bufA) return bufB;
    if (!bufB) return bufA;

    const w = bufA.width;
    const h = bufA.height;
    const resB = (bufB.width === w && bufB.height === h) ? bufB : bufB.resample(w, h);

    const wipePos = Number(this.getKnobValue('wipePosition')) ?? 0.5;

    // Create composite comparison buffer
    const result = bufA.clone();
    const dst = result.data;
    const srcB = resB.data;

    if (compareMode === 'wipe_h') {
      const splitX = Math.floor(w * wipePos);
      for (let y = 0; y < h; y++) {
        for (let x = splitX; x < w; x++) {
          const idx = (y * w + x) * 4;
          dst[idx] = srcB[idx];
          dst[idx + 1] = srcB[idx + 1];
          dst[idx + 2] = srcB[idx + 2];
          dst[idx + 3] = srcB[idx + 3];
        }
        // Draw wipe divider line
        if (splitX >= 0 && splitX < w) {
          const lIdx = (y * w + splitX) * 4;
          dst[lIdx] = 1.0;
          dst[lIdx + 1] = 0.5;
          dst[lIdx + 2] = 0.0;
        }
      }
    } else if (compareMode === 'wipe_v') {
      const splitY = Math.floor(h * wipePos);
      for (let y = splitY; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;
          dst[idx] = srcB[idx];
          dst[idx + 1] = srcB[idx + 1];
          dst[idx + 2] = srcB[idx + 2];
          dst[idx + 3] = srcB[idx + 3];
        }
      }
    } else if (compareMode === 'diff') {
      const len = dst.length;
      for (let i = 0; i < len; i += 4) {
        dst[i] = Math.abs(dst[i] - srcB[i]) * 5.0; // Boost diff visibility
        dst[i + 1] = Math.abs(dst[i + 1] - srcB[i + 1]) * 5.0;
        dst[i + 2] = Math.abs(dst[i + 2] - srcB[i + 2]) * 5.0;
      }
    }

    return result;
  }
}

