/**
 * OpenComp - Transform Node
 * 2D Translation, Rotation, Uniform/Non-uniform Scale, Center Pivot, and Bilinear Filtering.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class TransformNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Transform', 'Transform', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input');

    this.addKnob('translateX', 'Translate X', 'number', 0.0, { min: -1000.0, max: 1000.0, step: 1.0 });
    this.addKnob('translateY', 'Translate Y', 'number', 0.0, { min: -1000.0, max: 1000.0, step: 1.0 });
    this.addKnob('rotate', 'Rotate (deg)', 'number', 0.0, { min: -360.0, max: 360.0, step: 0.5 });
    this.addKnob('scale', 'Scale', 'number', 1.0, { min: 0.01, max: 10.0, step: 0.01 });
    this.addKnob('scaleY', 'Scale Y (Aspect)', 'number', 1.0, { min: 0.01, max: 10.0, step: 0.01 });
    this.addKnob('centerRatio', 'Center Pivot', 'select', 'center', {
      options: [
        { label: 'Image Center (0.5, 0.5)', value: 'center' },
        { label: 'Top-Left (0.0, 0.0)', value: 'topleft' }
      ]
    });
  }

  compute(inputs, context = {}) {
    const inputBuf = inputs['in'];
    if (!inputBuf) return null;

    const tx = Number(this.getKnobValue('translateX')) ?? 0.0;
    const ty = Number(this.getKnobValue('translateY')) ?? 0.0;
    const rotDeg = Number(this.getKnobValue('rotate')) ?? 0.0;
    const scale = Math.max(0.0001, Number(this.getKnobValue('scale')) ?? 1.0);
    const scaleY = Math.max(0.0001, Number(this.getKnobValue('scaleY')) ?? 1.0);
    const centerMode = this.getKnobValue('centerRatio') || 'center';

    const w = inputBuf.width;
    const h = inputBuf.height;

    // If identity transform, return clone
    if (tx === 0 && ty === 0 && rotDeg === 0 && scale === 1.0 && scaleY === 1.0) {
      return inputBuf.clone();
    }

    const cx = centerMode === 'center' ? w * 0.5 : 0.0;
    const cy = centerMode === 'center' ? h * 0.5 : 0.0;

    const rad = (-rotDeg * Math.PI) / 180.0; // Invert angle for backward lookup
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const invSx = 1.0 / scale;
    const invSy = 1.0 / (scale * scaleY);

    const result = new PixelBuffer(w, h);
    const src = inputBuf.data;
    const dst = result.data;

    // Backward mapping for Bilinear sampling
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // 1. Shift by translate
        const px = x - tx - cx;
        const py = y - ty - cy;

        // 2. Rotate
        const rx = px * cosA - py * sinA;
        const ry = px * sinA + py * cosA;

        // 3. Scale and un-center
        const srcX = rx * invSx + cx;
        const srcY = ry * invSy + cy;

        const outIdx = (y * w + x) * 4;

        if (srcX >= 0 && srcX < w - 1 && srcY >= 0 && srcY < h - 1) {
          // Bilinear interpolation
          const x0 = Math.floor(srcX);
          const y0 = Math.floor(srcY);
          const x1 = x0 + 1;
          const y1 = y0 + 1;

          const fx = srcX - x0;
          const fy = srcY - y0;

          const idx00 = (y0 * w + x0) * 4;
          const idx01 = (y0 * w + x1) * 4;
          const idx10 = (y1 * w + x0) * 4;
          const idx11 = (y1 * w + x1) * 4;

          for (let c = 0; c < 4; c++) {
            const top = src[idx00 + c] * (1.0 - fx) + src[idx01 + c] * fx;
            const bottom = src[idx10 + c] * (1.0 - fx) + src[idx11 + c] * fx;
            dst[outIdx + c] = top * (1.0 - fy) + bottom * fy;
          }
        }
      }
    }

    return result;
  }
}

