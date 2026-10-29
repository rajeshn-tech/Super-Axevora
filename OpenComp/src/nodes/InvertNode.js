/**
 * OpenComp - Invert Node
 * Inverts RGB, Alpha, or all channels.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class InvertNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Invert', 'Color', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input');

    this.addKnob('channels', 'Channels', 'select', 'rgb', {
      options: [
        { label: 'RGB Only', value: 'rgb' },
        { label: 'RGBA (All)', value: 'rgba' },
        { label: 'Alpha Only', value: 'alpha' }
      ]
    });
  }

  compute(inputs, context = {}) {
    const inputBuf = inputs['in'];
    if (!inputBuf) return null;

    const channels = this.getKnobValue('channels') || 'rgb';
    const result = new PixelBuffer(inputBuf.width, inputBuf.height);
    const src = inputBuf.data;
    const dst = result.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      dst[i] = channels === 'rgb' || channels === 'rgba' ? 1.0 - src[i] : src[i];
      dst[i + 1] = channels === 'rgb' || channels === 'rgba' ? 1.0 - src[i + 1] : src[i + 1];
      dst[i + 2] = channels === 'rgb' || channels === 'rgba' ? 1.0 - src[i + 2] : src[i + 2];
      dst[i + 3] = channels === 'alpha' || channels === 'rgba' ? 1.0 - src[i + 3] : src[i + 3];
    }

    return result;
  }
}

