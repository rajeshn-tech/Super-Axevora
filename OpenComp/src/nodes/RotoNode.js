/**
 * OpenComp - Roto Node
 * Vector shapes, ellipses, vignettes, and rotoscoping mattes with edge feathering and invert.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class RotoNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Roto', 'Channel', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input (Optional)');

    this.addKnob('shape', 'Shape', 'select', 'ellipse', {
      options: [
        { label: 'Ellipse / Oval', value: 'ellipse' },
        { label: 'Rectangle / Box', value: 'rectangle' },
        { label: 'Cinematic Vignette', value: 'vignette' }
      ]
    });

    this.addKnob('centerX', 'Center X', 'number', 0.5, { min: 0.0, max: 1.0, step: 0.01 });
    this.addKnob('centerY', 'Center Y', 'number', 0.5, { min: 0.0, max: 1.0, step: 0.01 });
    this.addKnob('radiusX', 'Radius X / Width', 'number', 0.35, { min: 0.01, max: 1.0, step: 0.01 });
    this.addKnob('radiusY', 'Radius Y / Height', 'number', 0.35, { min: 0.01, max: 1.0, step: 0.01 });
    this.addKnob('feather', 'Feather / Softness', 'number', 0.15, { min: 0.0, max: 0.5, step: 0.01 });
    this.addKnob('invert', 'Invert Matte', 'boolean', false);
    this.addKnob('opacity', 'Opacity', 'number', 1.0, { min: 0.0, max: 1.0, step: 0.05 });
  }

  compute(inputs, context = {}) {
    const inputBuf = inputs['in'];
    const w = inputBuf ? inputBuf.width : 1920;
    const h = inputBuf ? inputBuf.height : 1080;

    const result = new PixelBuffer(w, h);
    const dst = result.data;
    const src = inputBuf ? inputBuf.data : null;

    const shape = this.getKnobValue('shape') || 'ellipse';
    const cx = (Number(this.getKnobValue('centerX')) ?? 0.5) * w;
    const cy = (Number(this.getKnobValue('centerY')) ?? 0.5) * h;
    const rx = Math.max(1, (Number(this.getKnobValue('radiusX')) ?? 0.35) * w);
    const ry = Math.max(1, (Number(this.getKnobValue('radiusY')) ?? 0.35) * h);
    const feather = Math.max(0.0001, (Number(this.getKnobValue('feather')) ?? 0.15) * Math.min(rx, ry));
    const invert = !!this.getKnobValue('invert');
    const opacity = Number(this.getKnobValue('opacity')) ?? 1.0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const outIdx = (y * w + x) * 4;
        let distNorm = 0.0;

        if (shape === 'ellipse' || shape === 'vignette') {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          distNorm = Math.sqrt(dx * dx + dy * dy);
        } else if (shape === 'rectangle') {
          const dx = Math.abs(x - cx) / rx;
          const dy = Math.abs(y - cy) / ry;
          distNorm = Math.max(dx, dy);
        }

        // Feather falloff from edge (distNorm = 1.0)
        let matte = 0.0;
        const featherNorm = feather / Math.min(rx, ry);

        if (distNorm <= 1.0 - featherNorm) {
          matte = 1.0;
        } else if (distNorm >= 1.0 + featherNorm) {
          matte = 0.0;
        } else {
          // Smooth Hermite interpolation
          const t = (distNorm - (1.0 - featherNorm)) / (2.0 * featherNorm);
          matte = 1.0 - (t * t * (3.0 - 2.0 * t));
        }

        if (shape === 'vignette') {
          matte = 1.0 - matte; // Vignette darkens edges
        }

        if (invert) matte = 1.0 - matte;
        matte *= opacity;

        if (src) {
          // Replace alpha channel of input image with this roto matte
          dst[outIdx] = src[outIdx];
          dst[outIdx + 1] = src[outIdx + 1];
          dst[outIdx + 2] = src[outIdx + 2];
          dst[outIdx + 3] = matte;
        } else {
          // Pure white matte with alpha
          dst[outIdx] = matte;
          dst[outIdx + 1] = matte;
          dst[outIdx + 2] = matte;
          dst[outIdx + 3] = matte;
        }
      }
    }

    return result;
  }
}

