/**
 * OpenComp - Grade Node
 * Implements the exact industry-standard Foundry Nuke Grade algorithm.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class GradeNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Grade', 'Color', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input');
    this.addInput('mask', 'mask', 'mask (Optional)');

    this.addKnob('blackpoint', 'Blackpoint', 'number', 0.0, { min: -1.0, max: 2.0, step: 0.005 });
    this.addKnob('whitepoint', 'Whitepoint', 'number', 1.0, { min: 0.01, max: 5.0, step: 0.01 });
    this.addKnob('lift', 'Lift', 'number', 0.0, { min: -1.0, max: 2.0, step: 0.01 });
    this.addKnob('gain', 'Gain', 'number', 1.0, { min: 0.0, max: 5.0, step: 0.01 });
    this.addKnob('multiply', 'Multiply', 'number', 1.0, { min: 0.0, max: 5.0, step: 0.01 });
    this.addKnob('offset', 'Offset', 'number', 0.0, { min: -1.0, max: 1.0, step: 0.005 });
    this.addKnob('gamma', 'Gamma', 'number', 1.0, { min: 0.1, max: 4.0, step: 0.01 });
    this.addKnob('blackClamp', 'Black Clamp', 'boolean', true);
    this.addKnob('whiteClamp', 'White Clamp', 'boolean', false);
    this.addKnob('reverse', 'Reverse', 'boolean', false);
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

    const bp = Number(this.getKnobValue('blackpoint')) ?? 0.0;
    const wp = Math.max(0.0001, Number(this.getKnobValue('whitepoint')) ?? 1.0);
    const lift = Number(this.getKnobValue('lift')) ?? 0.0;
    const gain = Number(this.getKnobValue('gain')) ?? 1.0;
    const mult = Number(this.getKnobValue('multiply')) ?? 1.0;
    const offset = Number(this.getKnobValue('offset')) ?? 0.0;
    const gamma = Math.max(0.0001, Number(this.getKnobValue('gamma')) ?? 1.0);
    const blackClamp = !!this.getKnobValue('blackClamp');
    const whiteClamp = !!this.getKnobValue('whiteClamp');
    const reverse = !!this.getKnobValue('reverse');

    // Nuke Grade mathematical terms
    // A = multiply * (gain - lift) / (whitepoint - blackpoint)
    // B = offset + lift - A * blackpoint
    const denom = (wp - bp) === 0 ? 0.00001 : (wp - bp);
    const A = mult * (gain - lift) / denom;
    const B = offset + lift - A * bp;
    const invGamma = 1.0 / gamma;

    for (let i = 0; i < len; i += 4) {
      const maskVal = mask ? mask[i + 3] : 1.0;

      for (let c = 0; c < 3; c++) {
        const origVal = src[i + c];
        let val = origVal;

        if (!reverse) {
          // Normal Grade forward: (A * x + B) ^ (1 / gamma)
          val = A * val + B;
          if (val > 0) {
            val = Math.pow(val, invGamma);
          }
        } else {
          // Reverse Grade
          if (val > 0) {
            val = Math.pow(val, gamma);
          }
          if (A !== 0) {
            val = (val - B) / A;
          }
        }

        if (blackClamp) val = Math.max(0.0, val);
        if (whiteClamp) val = Math.min(1.0, val);

        // Mix with original using mask
        dst[i + c] = origVal * (1.0 - maskVal) + val * maskVal;
      }

      // Preserve alpha
      dst[i + 3] = src[i + 3];
    }

    return result;
  }
}

