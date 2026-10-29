/**
 * OpenComp - Constant Node
 * Generates a solid floating-point color canvas of specified format.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class ConstantNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Constant', 'Image', x, y);
    this.width = 110;
    this.height = 38;

    this.addKnob('colorR', 'Red', 'number', 0.0, { min: 0.0, max: 2.0, step: 0.01 });
    this.addKnob('colorG', 'Green', 'number', 0.0, { min: 0.0, max: 2.0, step: 0.01 });
    this.addKnob('colorB', 'Blue', 'number', 0.0, { min: 0.0, max: 2.0, step: 0.01 });
    this.addKnob('colorA', 'Alpha', 'number', 1.0, { min: 0.0, max: 1.0, step: 0.01 });
    this.addKnob('format', 'Format', 'select', '1920x1080', {
      options: [
        { label: '1920 x 1080 (HD)', value: '1920x1080' },
        { label: '1280 x 720 (720p)', value: '1280x720' },
        { label: '2048 x 1080 (2K DCI)', value: '2048x1080' },
        { label: '3840 x 2160 (4K UHD)', value: '3840x2160' }
      ]
    });
  }

  compute(inputs, context = {}) {
    const format = this.getKnobValue('format') || '1920x1080';
    const [w, h] = format.split('x').map(Number);
    const buf = new PixelBuffer(w, h);

    const r = Number(this.getKnobValue('colorR')) ?? 0.0;
    const g = Number(this.getKnobValue('colorG')) ?? 0.0;
    const b = Number(this.getKnobValue('colorB')) ?? 0.0;
    const a = Number(this.getKnobValue('colorA')) ?? 1.0;

    buf.fill(r, g, b, a);
    return buf;
  }
}

