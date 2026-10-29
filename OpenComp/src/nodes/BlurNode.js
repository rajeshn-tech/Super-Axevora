/**
 * OpenComp - Blur Node
 * High-performance two-pass separable Gaussian blur filter.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class BlurNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Blur', 'Filter', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input');
    this.addInput('mask', 'mask', 'mask (Optional)');

    this.addKnob('size', 'Size', 'number', 15.0, { min: 0.0, max: 150.0, step: 0.5 });
    this.addKnob('aspectRatio', 'Aspect Ratio', 'number', 1.0, { min: 0.1, max: 10.0, step: 0.1 });
    this.addKnob('channels', 'Channels', 'select', 'rgba', {
      options: [
        { label: 'RGBA', value: 'rgba' },
        { label: 'RGB', value: 'rgb' },
        { label: 'Alpha Only', value: 'alpha' }
      ]
    });
  }

  compute(inputs, context = {}) {
    const inputBuf = inputs['in'];
    if (!inputBuf) return null;

    const size = Math.max(0, Number(this.getKnobValue('size')) ?? 0.0);
    if (size <= 0.001) return inputBuf.clone();

    const maskBuf = inputs['mask'];
    const resampledMask = (maskBuf && (maskBuf.width !== inputBuf.width || maskBuf.height !== inputBuf.height))
      ? maskBuf.resample(inputBuf.width, inputBuf.height)
      : maskBuf;

    const aspect = Number(this.getKnobValue('aspectRatio')) ?? 1.0;
    const radiusX = Math.round(size * aspect);
    const radiusY = Math.round(size);
    const w = inputBuf.width;
    const h = inputBuf.height;

    // Temporary intermediate buffer for horizontal pass
    const temp = new Float32Array(w * h * 4);
    const src = inputBuf.data;
    const result = new PixelBuffer(w, h);
    const dst = result.data;
    const mask = resampledMask ? resampledMask.data : null;

    // Build 1D Gaussian kernel
    const makeKernel = (radius) => {
      if (radius <= 0) return [1.0];
      const sigma = radius / 2.5;
      const kernel = [];
      let sum = 0;
      for (let i = -radius; i <= radius; i++) {
        const val = Math.exp(-(i * i) / (2 * sigma * sigma));
        kernel.push(val);
        sum += val;
      }
      return kernel.map(v => v / sum);
    };

    const kernelX = makeKernel(radiusX);
    const kernelY = makeKernel(radiusY);

    // Pass 1: Horizontal Blur (src -> temp)
    for (let y = 0; y < h; y++) {
      const rowOffset = y * w;
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let kIdx = 0;
        for (let k = -radiusX; k <= radiusX; k++) {
          const sampleX = Math.max(0, Math.min(w - 1, x + k));
          const idx = (rowOffset + sampleX) * 4;
          const weight = kernelX[kIdx++];
          r += src[idx] * weight;
          g += src[idx + 1] * weight;
          b += src[idx + 2] * weight;
          a += src[idx + 3] * weight;
        }
        const outIdx = (rowOffset + x) * 4;
        temp[outIdx] = r;
        temp[outIdx + 1] = g;
        temp[outIdx + 2] = b;
        temp[outIdx + 3] = a;
      }
    }

    // Pass 2: Vertical Blur (temp -> dst) with mask blending
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        let kIdx = 0;
        for (let k = -radiusY; k <= radiusY; k++) {
          const sampleY = Math.max(0, Math.min(h - 1, y + k));
          const idx = (sampleY * w + x) * 4;
          const weight = kernelY[kIdx++];
          r += temp[idx] * weight;
          g += temp[idx + 1] * weight;
          b += temp[idx + 2] * weight;
          a += temp[idx + 3] * weight;
        }

        const outIdx = (y * w + x) * 4;
        const maskVal = mask ? mask[outIdx + 3] : 1.0;

        dst[outIdx] = src[outIdx] * (1.0 - maskVal) + r * maskVal;
        dst[outIdx + 1] = src[outIdx + 1] * (1.0 - maskVal) + g * maskVal;
        dst[outIdx + 2] = src[outIdx + 2] * (1.0 - maskVal) + b * maskVal;
        dst[outIdx + 3] = src[outIdx + 3] * (1.0 - maskVal) + a * maskVal;
      }
    }

    return result;
  }
}

