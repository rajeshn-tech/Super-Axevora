/**
 * OpenComp - Keyer Node
 * Professional VFX Chroma Keyer (Greenscreen/Bluescreen) with edge despill and Luma Keyer.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class KeyerNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Keyer', 'Keyer', x, y);
    this.width = 110;
    this.height = 38;

    this.addInput('in', 'in', 'Input');

    this.addKnob('keyType', 'Key Type', 'select', 'chroma_green', {
      options: [
        { label: 'Chroma Key (Green Screen)', value: 'chroma_green' },
        { label: 'Chroma Key (Blue Screen)', value: 'chroma_blue' },
        { label: 'Luma Key (Luminance)', value: 'luma' }
      ]
    });

    this.addKnob('tolerance', 'Tolerance / Screen', 'number', 0.28, { min: 0.01, max: 1.0, step: 0.01 });
    this.addKnob('softness', 'Edge Softness', 'number', 0.15, { min: 0.0, max: 0.8, step: 0.01 });
    this.addKnob('clipBlack', 'Clip Black (Clean BG)', 'number', 0.05, { min: 0.0, max: 0.5, step: 0.01 });
    this.addKnob('clipWhite', 'Clip White (Core Matte)', 'number', 0.95, { min: 0.5, max: 1.0, step: 0.01 });
    this.addKnob('despill', 'Despill Strength', 'number', 1.0, { min: 0.0, max: 1.5, step: 0.05 });
    this.addKnob('outputMode', 'Output View', 'select', 'composite', {
      options: [
        { label: 'Premultiplied RGBA + Despill', value: 'composite' },
        { label: 'Matte Only (Alpha in RGB)', value: 'matte' },
        { label: 'Despilled RGB Only', value: 'despill' }
      ]
    });
  }

  compute(inputs, context = {}) {
    const inputBuf = inputs['in'];
    if (!inputBuf) return null;

    const keyType = this.getKnobValue('keyType') || 'chroma_green';
    const tol = Math.max(0.001, Number(this.getKnobValue('tolerance')) ?? 0.28);
    const soft = Math.max(0.0001, Number(this.getKnobValue('softness')) ?? 0.15);
    const clipBlack = Number(this.getKnobValue('clipBlack')) ?? 0.05;
    const clipWhite = Math.max(clipBlack + 0.01, Number(this.getKnobValue('clipWhite')) ?? 0.95);
    const despillStrength = Number(this.getKnobValue('despill')) ?? 1.0;
    const outputMode = this.getKnobValue('outputMode') || 'composite';

    const w = inputBuf.width;
    const h = inputBuf.height;
    const result = new PixelBuffer(w, h);
    const src = inputBuf.data;
    const dst = result.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      let r = src[i];
      let g = src[i + 1];
      let b = src[i + 2];
      const a = src[i + 3];

      let rawMatte = 1.0;

      if (keyType === 'chroma_green') {
        // Foundry Nuke / Primatte style green screen differential: G - max(R, B)
        const maxOther = Math.max(r, b);
        const greenDelta = g - maxOther;

        if (greenDelta > 0) {
          rawMatte = 1.0 - (greenDelta / tol);
        } else {
          rawMatte = 1.0;
        }

        // Despill: replace excessive green with max(R, B) or average
        if (despillStrength > 0 && g > maxOther) {
          const excess = (g - maxOther) * despillStrength;
          g = Math.max(0, g - excess);
        }
      } else if (keyType === 'chroma_blue') {
        // Blue screen differential: B - max(R, G)
        const maxOther = Math.max(r, g);
        const blueDelta = b - maxOther;

        if (blueDelta > 0) {
          rawMatte = 1.0 - (blueDelta / tol);
        } else {
          rawMatte = 1.0;
        }

        // Despill blue
        if (despillStrength > 0 && b > maxOther) {
          const excess = (b - maxOther) * despillStrength;
          b = Math.max(0, b - excess);
        }
      } else if (keyType === 'luma') {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        rawMatte = (luma - tol) / soft;
      }

      // Smooth clamp and black/white clip curve
      let finalMatte = Math.max(0, Math.min(1, rawMatte));
      // Remap between clipBlack and clipWhite
      if (finalMatte <= clipBlack) {
        finalMatte = 0.0;
      } else if (finalMatte >= clipWhite) {
        finalMatte = 1.0;
      } else {
        finalMatte = (finalMatte - clipBlack) / (clipWhite - clipBlack);
      }
      finalMatte = finalMatte * a; // Combine with incoming alpha

      if (outputMode === 'matte') {
        // Output matte into RGB
        dst[i] = finalMatte;
        dst[i + 1] = finalMatte;
        dst[i + 2] = finalMatte;
        dst[i + 3] = 1.0;
      } else if (outputMode === 'despill') {
        // Output despilled RGB without alpha cutout
        dst[i] = r;
        dst[i + 1] = g;
        dst[i + 2] = b;
        dst[i + 3] = a;
      } else {
        // Default Premultiplied Composite
        dst[i] = r * finalMatte;
        dst[i + 1] = g * finalMatte;
        dst[i + 2] = b * finalMatte;
        dst[i + 3] = finalMatte;
      }
    }

    return result;
  }
}

