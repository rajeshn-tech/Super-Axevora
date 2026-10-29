/**
 * OpenComp - ColorCorrect Node
 * Master saturation, contrast, gamma, gain, and offset color grading.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class ColorCorrectNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'ColorCorrect', 'Color', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input');
    this.addInput('mask', 'mask', 'mask (Optional)');

    this.addKnob('saturation', 'Saturation', 'number', 1.0, { min: 0.0, max: 4.0, step: 0.01 });
    this.addKnob('contrast', 'Contrast', 'number', 1.0, { min: 0.0, max: 3.0, step: 0.01 });
    this.addKnob('gamma', 'Gamma', 'number', 1.0, { min: 0.1, max: 4.0, step: 0.01 });
    this.addKnob('gain', 'Gain', 'number', 1.0, { min: 0.0, max: 4.0, step: 0.01 });
    this.addKnob('offset', 'Offset', 'number', 0.0, { min: -1.0, max: 1.0, step: 0.01 });
  }

  compute(inputs, context = {}) {
    const inputBuf = inputs['in'];
    if (!inputBuf) return null;

    const maskBuf = inputs['mask'];
    const resampledMask = (maskBuf && (maskBuf.width !== inputBuf.width || maskBuf.height !== inputBuf.height))
      ? maskBuf.resample(inputBuf.width, inputBuf.height)
      : maskBuf;

    const result = new PixelBuffer(inputBuf.width, inputBuf.height);
    const src = inputBuf.data;
    const dst = result.data;
    const mask = resampledMask ? resampledMask.data : null;
    const len = src.length;

    const sat = Number(this.getKnobValue('saturation')) ?? 1.0;
    const contrast = Number(this.getKnobValue('contrast')) ?? 1.0;
    const gamma = Math.max(0.0001, Number(this.getKnobValue('gamma')) ?? 1.0);
    const gain = Number(this.getKnobValue('gain')) ?? 1.0;
    const offset = Number(this.getKnobValue('offset')) ?? 0.0;
    const invGamma = 1.0 / gamma;

    for (let i = 0; i < len; i += 4) {
      const maskVal = mask ? mask[i + 3] : 1.0;
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];

      // 1. Saturation
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + sat * (r - luma);
      g = luma + sat * (g - luma);
      b = luma + sat * (b - luma);

      // 2. Contrast around 0.18 middle gray
      const mid = 0.18;
      r = mid + contrast * (r - mid);
      g = mid + contrast * (g - mid);
      b = mid + contrast * (b - mid);

      // 3. Gamma
      if (r > 0) r = Math.pow(r, invGamma);
      if (g > 0) g = Math.pow(g, invGamma);
      if (b > 0) b = Math.pow(b, invGamma);

      // 4. Gain and Offset
      r = r * gain + offset;
      g = g * gain + offset;
      b = b * gain + offset;

      // Apply mask mix
      dst[i] = src[i] * (1.0 - maskVal) + r * maskVal;
      dst[i + 1] = src[i + 1] * (1.0 - maskVal) + g * maskVal;
      dst[i + 2] = src[i + 2] * (1.0 - maskVal) + b * maskVal;
      dst[i + 3] = src[i + 3];
    }

    return result;
  }
}

