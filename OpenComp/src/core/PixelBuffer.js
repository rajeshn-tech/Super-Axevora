/**
 * OpenComp - Core 32-bit Float Pixel Buffer
 * Industry-standard 32-bit linear floating point image buffer (similar to Foundry Nuke)
 */

export class PixelBuffer {
  /**
   * @param {number} width 
   * @param {number} height 
   * @param {Float32Array} [data] Optional existing buffer
   */
  constructor(width, height, data = null) {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.channels = 4; // R, G, B, A
    const length = this.width * this.height * 4;
    
    if (data && data.length === length) {
      this.data = data;
    } else {
      this.data = new Float32Array(length);
    }
  }

  /**
   * Clone current buffer
   * @returns {PixelBuffer}
   */
  clone() {
    const copy = new PixelBuffer(this.width, this.height);
    copy.data.set(this.data);
    return copy;
  }

  /**
   * Clear buffer with transparent black (0, 0, 0, 0)
   */
  clear() {
    this.data.fill(0);
  }

  /**
   * Fill buffer with a solid float color
   * @param {number} r 0.0 - 1.0+
   * @param {number} g 0.0 - 1.0+
   * @param {number} b 0.0 - 1.0+
   * @param {number} a 0.0 - 1.0
   */
  fill(r, g, b, a = 1.0) {
    const d = this.data;
    const len = d.length;
    for (let i = 0; i < len; i += 4) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a;
    }
  }

  /**
   * Get pixel values at (x, y)
   * @param {number} x 
   * @param {number} y 
   * @returns {[number, number, number, number]} [r, g, b, a]
   */
  getPixel(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0, 0];
    }
    const idx = (y * this.width + x) * 4;
    return [
      this.data[idx],
      this.data[idx + 1],
      this.data[idx + 2],
      this.data[idx + 3]
    ];
  }

  /**
   * Set pixel values at (x, y)
   * @param {number} x 
   * @param {number} y 
   * @param {number} r 
   * @param {number} g 
   * @param {number} b 
   * @param {number} a 
   */
  setPixel(x, y, r, g, b, a = 1.0) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    this.data[idx] = r;
    this.data[idx + 1] = g;
    this.data[idx + 2] = b;
    this.data[idx + 3] = a;
  }

  /**
   * Convert sRGB 8-bit integer Uint8ClampedArray (HTML ImageData) to Linear Float32Array
   * @param {ImageData} imageData 
   * @returns {PixelBuffer}
   */
  static fromImageData(imageData) {
    const buf = new PixelBuffer(imageData.width, imageData.height);
    const src = imageData.data;
    const dst = buf.data;
    const len = src.length;

    for (let i = 0; i < len; i += 4) {
      // Convert sRGB 0-255 to Linear Float 0.0 - 1.0
      dst[i] = Math.pow(src[i] / 255.0, 2.2);
      dst[i + 1] = Math.pow(src[i + 1] / 255.0, 2.2);
      dst[i + 2] = Math.pow(src[i + 2] / 255.0, 2.2);
      dst[i + 3] = src[i + 3] / 255.0; // Alpha is linear
    }
    return buf;
  }

  /**
   * Convert Linear Float32Array to sRGB ImageData for display
   * @param {number} exposure EV stop offset (-5.0 to +5.0)
   * @param {number} gamma Display gamma (e.g. 2.2 or slider 0.2 to 3.0)
   * @param {string} channelMode 'RGBA' | 'RED' | 'GREEN' | 'BLUE' | 'ALPHA' | 'LUMA'
   * @param {ImageData} [targetImageData] Optional recycled ImageData
   * @returns {ImageData}
   */
  toImageData(exposure = 0.0, gamma = 1.0, channelMode = 'RGBA', targetImageData = null) {
    const imgData = targetImageData || new ImageData(this.width, this.height);
    const dst = imgData.data;
    const src = this.data;
    const len = src.length;
    
    const exposureMult = Math.pow(2.0, exposure);
    const invGamma = 1.0 / Math.max(0.001, gamma);

    for (let i = 0; i < len; i += 4) {
      let r = src[i] * exposureMult;
      let g = src[i + 1] * exposureMult;
      let b = src[i + 2] * exposureMult;
      let a = src[i + 3];

      // Channel isolation modes
      if (channelMode === 'RED') {
        g = r;
        b = r;
        a = 1.0;
      } else if (channelMode === 'GREEN') {
        r = g;
        b = g;
        a = 1.0;
      } else if (channelMode === 'BLUE') {
        r = b;
        g = b;
        a = 1.0;
      } else if (channelMode === 'ALPHA') {
        r = a;
        g = a;
        b = a;
        a = 1.0;
      } else if (channelMode === 'LUMA') {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = luma;
        g = luma;
        b = luma;
        a = 1.0;
      }

      // Linear -> Display Gamma correction & clamp
      r = Math.min(255, Math.max(0, Math.pow(Math.max(0, r), invGamma) * 255.0));
      g = Math.min(255, Math.max(0, Math.pow(Math.max(0, g), invGamma) * 255.0));
      b = Math.min(255, Math.max(0, Math.pow(Math.max(0, b), invGamma) * 255.0));
      a = Math.min(255, Math.max(0, a * 255.0));

      dst[i] = r;
      dst[i + 1] = g;
      dst[i + 2] = b;
      dst[i + 3] = a;
    }

    return imgData;
  }

  /**
   * Resample/resize image using Bilinear filtering
   * @param {number} newWidth 
   * @param {number} newHeight 
   * @returns {PixelBuffer}
   */
  resample(newWidth, newHeight) {
    newWidth = Math.max(1, Math.floor(newWidth));
    newHeight = Math.max(1, Math.floor(newHeight));
    if (newWidth === this.width && newHeight === this.height) return this.clone();

    const result = new PixelBuffer(newWidth, newHeight);
    const src = this.data;
    const dst = result.data;
    const w = this.width;
    const h = this.height;

    const xRatio = (w - 1) / Math.max(1, newWidth - 1);
    const yRatio = (h - 1) / Math.max(1, newHeight - 1);

    for (let y = 0; y < newHeight; y++) {
      const srcY = y * yRatio;
      const y0 = Math.floor(srcY);
      const y1 = Math.min(h - 1, y0 + 1);
      const yWeight = srcY - y0;

      for (let x = 0; x < newWidth; x++) {
        const srcX = x * xRatio;
        const x0 = Math.floor(srcX);
        const x1 = Math.min(w - 1, x0 + 1);
        const xWeight = srcX - x0;

        const idx00 = (y0 * w + x0) * 4;
        const idx01 = (y0 * w + x1) * 4;
        const idx10 = (y1 * w + x0) * 4;
        const idx11 = (y1 * w + x1) * 4;

        const outIdx = (y * newWidth + x) * 4;

        for (let c = 0; c < 4; c++) {
          const top = src[idx00 + c] * (1 - xWeight) + src[idx01 + c] * xWeight;
          const bottom = src[idx10 + c] * (1 - xWeight) + src[idx11 + c] * xWeight;
          dst[outIdx + c] = top * (1 - yWeight) + bottom * yWeight;
        }
      }
    }

    return result;
  }
}

