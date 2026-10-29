/**
 * OpenComp - Merge Node
 * Foundry Nuke-style A/B stream compositor with all standard blend operations, mask inputs, and mix controls.
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class MergeNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Merge', 'Merge', x, y);
    this.width = 110;
    this.height = 38;

    // Nuke port convention: B is on top/background, A is on right/side foreground, mask is on right/side
    this.addInput('B', 'B', 'B (Background)');
    this.addInput('A', 'A', 'A (Foreground)');
    this.addInput('mask', 'mask', 'mask (Matte)');

    this.addKnob('operation', 'Operation', 'select', 'over', {
      options: [
        { label: 'over', value: 'over' },
        { label: 'under', value: 'under' },
        { label: 'plus / add', value: 'plus' },
        { label: 'multiply', value: 'multiply' },
        { label: 'screen', value: 'screen' },
        { label: 'difference', value: 'difference' },
        { label: 'in', value: 'in' },
        { label: 'out', value: 'out' },
        { label: 'atop', value: 'atop' },
        { label: 'color-burn', value: 'color-burn' },
        { label: 'color-dodge', value: 'color-dodge' },
        { label: 'hypot', value: 'hypot' },
        { label: 'xor', value: 'xor' },
        { label: 'average', value: 'average' },
        { label: 'min', value: 'min' },
        { label: 'max', value: 'max' }
      ]
    });

    this.addKnob('mix', 'Mix', 'number', 1.0, { min: 0.0, max: 1.0, step: 0.01 });
    this.addKnob('maskChannel', 'Mask Channel', 'select', 'alpha', {
      options: [
        { label: 'Alpha', value: 'alpha' },
        { label: 'Luminance', value: 'luma' }
      ]
    });
    this.addKnob('invertMask', 'Invert Mask', 'boolean', false);
  }

  compute(inputs, context = {}) {
    const bufB = inputs['B'];
    const bufA = inputs['A'];
    const bufMask = inputs['mask'];

    // If no inputs connected, return empty
    if (!bufB && !bufA) return null;
    // If only one connected, pass it through
    if (!bufB && bufA) return bufA.clone();
    if (bufB && !bufA) return bufB.clone();

    // Use B's dimensions as the canvas output format
    const outW = bufB.width;
    const outH = bufB.height;
    const result = new PixelBuffer(outW, outH);

    // Resample A to match B if dimensions differ
    const resampledA = (bufA.width === outW && bufA.height === outH) ? bufA : bufA.resample(outW, outH);
    const resampledMask = (bufMask && (bufMask.width !== outW || bufMask.height !== outH)) ? bufMask.resample(outW, outH) : bufMask;

    const bData = bufB.data;
    const aData = resampledA.data;
    const outData = result.data;
    const maskData = resampledMask ? resampledMask.data : null;

    const op = this.getKnobValue('operation') || 'over';
    const globalMix = Math.max(0, Math.min(1, Number(this.getKnobValue('mix')) ?? 1.0));
    const maskChan = this.getKnobValue('maskChannel') || 'alpha';
    const invertMask = !!this.getKnobValue('invertMask');

    const len = outData.length;

    for (let i = 0; i < len; i += 4) {
      const bR = bData[i];
      const bG = bData[i + 1];
      const bB = bData[i + 2];
      const bA = bData[i + 3];

      const aR = aData[i];
      const aG = aData[i + 1];
      const aB = aData[i + 2];
      const aA = aData[i + 3];

      // Calculate effective mask weight
      let maskWeight = 1.0;
      if (maskData) {
        if (maskChan === 'luma') {
          maskWeight = 0.2126 * maskData[i] + 0.7152 * maskData[i + 1] + 0.0722 * maskData[i + 2];
        } else {
          maskWeight = maskData[i + 3];
        }
        if (invertMask) maskWeight = 1.0 - maskWeight;
      }
      const blendFactor = globalMix * Math.max(0, Math.min(1, maskWeight));

      let oR = 0, oG = 0, oB = 0, oA = 0;

      // Nuke compositing math formulas (Unclamped 32-bit float)
      switch (op) {
        case 'over':
          // A + B * (1 - aA)
          oR = aR + bR * (1.0 - aA);
          oG = aG + bG * (1.0 - aA);
          oB = aB + bB * (1.0 - aA);
          oA = aA + bA * (1.0 - aA);
          break;

        case 'under':
          // B + A * (1 - aB)
          oR = bR + aR * (1.0 - bA);
          oG = bG + aG * (1.0 - bA);
          oB = bB + aB * (1.0 - bA);
          oA = bA + aA * (1.0 - bA);
          break;

        case 'plus':
          // A + B
          oR = aR + bR;
          oG = aG + bG;
          oB = aB + bB;
          oA = aA + bA;
          break;

        case 'multiply':
          // A * B
          oR = aR * bR;
          oG = aG * bG;
          oB = aB * bB;
          oA = aA * bA;
          break;

        case 'screen':
          // A + B - A * B
          oR = aR + bR - aR * bR;
          oG = aG + bG - aG * bG;
          oB = aB + bB - aB * bB;
          oA = aA + bA - aA * bA;
          break;

        case 'difference':
          // |A - B|
          oR = Math.abs(aR - bR);
          oG = Math.abs(aG - bG);
          oB = Math.abs(aB - bB);
          oA = Math.max(aA, bA);
          break;

        case 'in':
          // A * bA
          oR = aR * bA;
          oG = aG * bA;
          oB = aB * bA;
          oA = aA * bA;
          break;

        case 'out':
          // A * (1 - bA)
          oR = aR * (1.0 - bA);
          oG = aG * (1.0 - bA);
          oB = aB * (1.0 - bA);
          oA = aA * (1.0 - bA);
          break;

        case 'atop':
          // A * bA + B * (1 - aA)
          oR = aR * bA + bR * (1.0 - aA);
          oG = aG * bA + bG * (1.0 - aA);
          oB = aB * bA + bB * (1.0 - aA);
          oA = bA;
          break;

        case 'color-burn':
          oR = aR <= 0 ? 0 : 1.0 - (1.0 - bR) / Math.max(0.0001, aR);
          oG = aG <= 0 ? 0 : 1.0 - (1.0 - bG) / Math.max(0.0001, aG);
          oB = aB <= 0 ? 0 : 1.0 - (1.0 - bB) / Math.max(0.0001, aB);
          oA = Math.max(aA, bA);
          break;

        case 'color-dodge':
          oR = aR >= 1.0 ? 1.0 : bR / Math.max(0.0001, 1.0 - aR);
          oG = aG >= 1.0 ? 1.0 : bG / Math.max(0.0001, 1.0 - aG);
          oB = aB >= 1.0 ? 1.0 : bB / Math.max(0.0001, 1.0 - aB);
          oA = Math.max(aA, bA);
          break;

        case 'hypot':
          oR = Math.sqrt(aR * aR + bR * bR);
          oG = Math.sqrt(aG * aG + bG * bG);
          oB = Math.sqrt(aB * aB + bB * bB);
          oA = Math.max(aA, bA);
          break;

        case 'xor':
          oR = aR * (1.0 - bA) + bR * (1.0 - aA);
          oG = aG * (1.0 - bA) + bG * (1.0 - aA);
          oB = aB * (1.0 - bA) + bB * (1.0 - aA);
          oA = aA + bA - 2.0 * aA * bA;
          break;

        case 'average':
          oR = (aR + bR) * 0.5;
          oG = (aG + bG) * 0.5;
          oB = (aB + bB) * 0.5;
          oA = (aA + bA) * 0.5;
          break;

        case 'min':
          oR = Math.min(aR, bR);
          oG = Math.min(aG, bG);
          oB = Math.min(aB, bB);
          oA = Math.min(aA, bA);
          break;

        case 'max':
          oR = Math.max(aR, bR);
          oG = Math.max(aG, bG);
          oB = Math.max(aB, bB);
          oA = Math.max(aA, bA);
          break;

        default:
          oR = aR + bR * (1.0 - aA);
          oG = aG + bG * (1.0 - aA);
          oB = aB + bB * (1.0 - aA);
          oA = aA + bA * (1.0 - aA);
      }

      // Linear interpolation with B according to mix slider and mask
      outData[i] = bR * (1.0 - blendFactor) + oR * blendFactor;
      outData[i + 1] = bG * (1.0 - blendFactor) + oG * blendFactor;
      outData[i + 2] = bB * (1.0 - blendFactor) + oB * blendFactor;
      outData[i + 3] = bA * (1.0 - blendFactor) + oA * blendFactor;
    }

    return result;
  }
}

