/**
 * OpenComp - Read Node
 * Loads images from file or generates procedural VFX test assets (e.g. Greenscreen, Checkerboard, Ramp)
 */

import { Node } from '../core/Node.js';
import { PixelBuffer } from '../core/PixelBuffer.js';

export class ReadNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Read', 'Image', x, y);
    this.width = 120;
    this.height = 42;

    this.addKnob('sourceType', 'Source', 'select', 'greenscreen', {
      options: [
        { label: 'Greenscreen VFX Footage', value: 'greenscreen' },
        { label: 'Cyberpunk City Background', value: 'background' },
        { label: 'Nuke Checkerboard', value: 'checkerboard' },
        { label: 'Color Ramp Gradient', value: 'ramp' },
        { label: 'Color Wheel', value: 'wheel' },
        { label: 'Custom File Upload', value: 'file' }
      ]
    });

    this.addKnob('format', 'Format', 'select', '1920x1080', {
      options: [
        { label: '1920 x 1080 (HD)', value: '1920x1080' },
        { label: '1280 x 720 (720p)', value: '1280x720' },
        { label: '2048 x 1080 (2K DCI)', value: '2048x1080' },
        { label: '3840 x 2160 (4K UHD)', value: '3840x2160' }
      ]
    });

    this.uploadedImageBuffer = null;
  }

  setUploadedImage(pixelBuffer) {
    this.uploadedImageBuffer = pixelBuffer;
    this.setKnobValue('sourceType', 'file');
    this.markDirty();
  }

  compute(inputs, context = {}) {
    const format = this.getKnobValue('format') || '1920x1080';
    const [targetW, targetH] = format.split('x').map(Number);
    const sourceType = this.getKnobValue('sourceType');

    if (sourceType === 'file' && this.uploadedImageBuffer) {
      return this.uploadedImageBuffer.resample(targetW, targetH);
    }

    const buf = new PixelBuffer(targetW, targetH);
    const d = buf.data;
    const len = d.length;

    if (sourceType === 'greenscreen') {
      // Procedural synthetic green screen scene: VFX Subject (character silhouette with hair strands, clothing, lighting)
      const cx = targetW * 0.5;
      const cy = targetH * 0.55;
      const bodyRadius = Math.min(targetW, targetH) * 0.28;

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const idx = (y * targetW + x) * 4;
          
          // Background is studio VFX green with slight light gradient
          const bgGrad = 0.85 + 0.15 * (1.0 - (y / targetH));
          const greenR = 0.05 * bgGrad;
          const greenG = 0.95 * bgGrad;
          const greenB = 0.12 * bgGrad;

          // Distance to subject center
          const dx = (x - cx) / 0.8;
          const dy = (y - cy);
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Head and shoulders profile
          const headDist = Math.sqrt((x - cx) * (x - cx) + (y - (cy - bodyRadius * 0.6)) * (y - (cy - bodyRadius * 0.6)));
          const isHead = headDist < bodyRadius * 0.45;
          const isBody = (dist < bodyRadius * 1.1) && (y > cy - bodyRadius * 0.3);

          if (isHead || isBody) {
            // Subject skin & clothing tones with green spill light on the rim
            const rimFactor = Math.max(0, 1.0 - (dist / bodyRadius));
            const rimSpill = Math.pow(1.0 - rimFactor, 3.0) * 0.3; // Green reflection on edges

            if (isHead) {
              // Warm skin tone
              d[idx] = 0.72 + rimSpill * 0.1;
              d[idx + 1] = 0.48 + rimSpill * 0.4; // Green spill
              d[idx + 2] = 0.35;
              d[idx + 3] = 1.0;
            } else {
              // Jacket / Suit color (cool dark charcoal navy)
              d[idx] = 0.12 + rimSpill * 0.1;
              d[idx + 1] = 0.16 + rimSpill * 0.5; // Green spill
              d[idx + 2] = 0.25;
              d[idx + 3] = 1.0;
            }
          } else {
            // Pure VFX green screen background
            d[idx] = greenR;
            d[idx + 1] = greenG;
            d[idx + 2] = greenB;
            d[idx + 3] = 1.0;
          }
        }
      }
      return buf;
    }

    if (sourceType === 'background') {
      // Cinematic Cyberpunk City Skyline with glowing sky and lights
      for (let y = 0; y < targetH; y++) {
        const v = y / targetH;
        for (let x = 0; x < targetW; x++) {
          const u = x / targetW;
          const idx = (y * targetW + x) * 4;

          // Sky gradient (deep purple night to orange horizon glow)
          const horizon = Math.exp(-Math.pow((v - 0.6) * 5.0, 2.0));
          const skyR = 0.08 * (1.0 - v) + 0.85 * horizon;
          const skyG = 0.04 * (1.0 - v) + 0.32 * horizon;
          const skyB = 0.28 * (1.0 - v) + 0.12 * horizon;

          // Building silhouettes
          const bldgCol = Math.floor(u * 28);
          const bldgHeight = 0.4 + 0.35 * Math.sin(bldgCol * 123.45);
          if (v > 1.0 - bldgHeight) {
            // Building interior / window lights
            const winX = Math.floor(x / 14) % 2 === 0;
            const winY = Math.floor(y / 18) % 2 === 0;
            const isWindow = winX && winY && Math.sin(bldgCol * 50 + winX * 10 + winY) > 0.3;

            if (isWindow) {
              d[idx] = 1.2; // Glowing warm yellow/cyan HDR windows
              d[idx + 1] = 0.9;
              d[idx + 2] = 0.4;
              d[idx + 3] = 1.0;
            } else {
              d[idx] = 0.03;
              d[idx + 1] = 0.04;
              d[idx + 2] = 0.06;
              d[idx + 3] = 1.0;
            }
          } else {
            d[idx] = skyR;
            d[idx + 1] = skyG;
            d[idx + 2] = skyB;
            d[idx + 3] = 1.0;
          }
        }
      }
      return buf;
    }

    if (sourceType === 'checkerboard') {
      const boxSize = 64;
      for (let y = 0; y < targetH; y++) {
        const by = Math.floor(y / boxSize);
        for (let x = 0; x < targetW; x++) {
          const bx = Math.floor(x / boxSize);
          const idx = (y * targetW + x) * 4;
          const isWhite = (bx + by) % 2 === 0;
          const val = isWhite ? 0.8 : 0.2;
          d[idx] = val;
          d[idx + 1] = val;
          d[idx + 2] = val;
          d[idx + 3] = 1.0;
        }
      }
      return buf;
    }

    if (sourceType === 'ramp') {
      for (let y = 0; y < targetH; y++) {
        const v = y / targetH;
        for (let x = 0; x < targetW; x++) {
          const u = x / targetW;
          const idx = (y * targetW + x) * 4;
          d[idx] = u;
          d[idx + 1] = v;
          d[idx + 2] = 0.5 * (u + v);
          d[idx + 3] = 1.0;
        }
      }
      return buf;
    }

    if (sourceType === 'wheel') {
      const cx = targetW * 0.5;
      const cy = targetH * 0.5;
      const radius = Math.min(targetW, targetH) * 0.4;

      for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const idx = (y * targetW + x) * 4;

          if (dist <= radius) {
            let angle = Math.atan2(dy, dx);
            if (angle < 0) angle += Math.PI * 2;
            const hue = angle / (Math.PI * 2);
            const sat = dist / radius;

            // HSV to Linear RGB
            const r = Math.max(0, Math.min(1, Math.abs(hue * 6 - 3) - 1));
            const g = Math.max(0, Math.min(1, 2 - Math.abs(hue * 6 - 2)));
            const b = Math.max(0, Math.min(1, 2 - Math.abs(hue * 6 - 4)));

            d[idx] = (1.0 + (r - 1.0) * sat);
            d[idx + 1] = (1.0 + (g - 1.0) * sat);
            d[idx + 2] = (1.0 + (b - 1.0) * sat);
            d[idx + 3] = 1.0;
          } else {
            d[idx] = 0;
            d[idx + 1] = 0;
            d[idx + 2] = 0;
            d[idx + 3] = 0;
          }
        }
      }
      return buf;
    }

    return buf;
  }
}

