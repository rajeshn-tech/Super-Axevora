/**
 * OpenComp - Base Node Class
 * Represents a single node in the Directed Acyclic Graph (DAG)
 */

export class Node {
  /**
   * @param {string} id 
   * @param {string} type 
   * @param {string} category 
   * @param {number} x 
   * @param {number} y 
   */
  constructor(id, type, category = 'General', x = 0, y = 0) {
    this.id = id;
    this.name = id;
    this.type = type;
    this.category = category;
    this.x = x;
    this.y = y;
    this.width = 110;
    this.height = 36;
    
    // Nuke category colors
    this.color = Node.getCategoryColor(category);

    /** @type {Array<{id: string, name: string, label: string, connection: {nodeId: string, outputPortId: string}|null}>} */
    this.inputs = [];

    /** @type {Array<{id: string, name: string}>} */
    this.outputs = [{ id: 'out', name: 'Output' }];

    /** @type {Object.<string, {label: string, type: string, value: any, options?: any[], min?: number, max?: number, step?: number}>} */
    this.knobs = {};

    this.disabled = false;
    this.isDirty = true;
    this.cachedBuffer = null;
    this.graph = null;
  }

  static getCategoryColor(category) {
    switch (category) {
      case 'Image': return '#6d5335';      // Read, Write, Constant (Brown/Orange)
      case 'Color': return '#706b32';      // Grade, ColorCorrect (Olive Yellow)
      case 'Filter': return '#305575';     // Blur, Sharpen, Glow (Blue)
      case 'Merge': return '#2f663c';      // Merge, ChannelMerge (Green)
      case 'Transform': return '#6e3570';  // Transform, Crop, CornerPin (Magenta)
      case 'Keyer': return '#2b6363';      // ChromaKeyer, LumaKeyer (Teal)
      case 'Channel': return '#355b6e';    // Shuffle (Cyan)
      case 'Viewer': return '#595959';     // Viewer (Gray)
      default: return '#4a4a4a';
    }
  }

  addInput(id, name, label = '') {
    this.inputs.push({
      id,
      name,
      label: label || name,
      connection: null
    });
  }

  addKnob(key, label, type, defaultValue, options = {}) {
    this.knobs[key] = {
      label,
      type,
      value: defaultValue,
      ...options
    };
  }

  getKnobValue(key) {
    return this.knobs[key] ? this.knobs[key].value : undefined;
  }

  setKnobValue(key, val) {
    if (this.knobs[key] !== undefined) {
      if (this.knobs[key].value !== val) {
        this.knobs[key].value = val;
        this.markDirty();
      }
    }
  }

  markDirty() {
    this.isDirty = true;
    this.cachedBuffer = null;
    if (this.graph) {
      this.graph.markDependentsDirty(this.id);
    }
  }

  /**
   * Abstract execution method
   * @param {Object.<string, import('./PixelBuffer.js').PixelBuffer>} inputBuffers 
   * @param {Object} context 
   * @returns {import('./PixelBuffer.js').PixelBuffer|null}
   */
  compute(inputBuffers, context = {}) {
    // If disabled (Bypassed), pass through the primary input (usually index 0 or 'B')
    if (this.disabled) {
      const firstInput = this.inputs[0];
      if (firstInput && inputBuffers[firstInput.id]) {
        return inputBuffers[firstInput.id];
      }
      return null;
    }
    return null;
  }

  serialize() {
    const serializedKnobs = {};
    for (const [k, v] of Object.entries(this.knobs)) {
      serializedKnobs[k] = v.value;
    }
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      category: this.category,
      x: this.x,
      y: this.y,
      disabled: this.disabled,
      knobs: serializedKnobs,
      inputs: this.inputs.map(inp => ({
        id: inp.id,
        name: inp.name,
        connection: inp.connection ? { ...inp.connection } : null
      }))
    };
  }

  deserialize(data) {
    this.id = data.id || this.id;
    this.name = data.name || this.name;
    this.x = data.x ?? this.x;
    this.y = data.y ?? this.y;
    this.disabled = !!data.disabled;

    if (data.knobs) {
      for (const [k, v] of Object.entries(data.knobs)) {
        if (this.knobs[k]) {
          this.knobs[k].value = v;
        }
      }
    }

    if (data.inputs && Array.isArray(data.inputs)) {
      for (const inp of data.inputs) {
        const target = this.inputs.find(i => i.id === inp.id);
        if (target) {
          target.connection = inp.connection;
        }
      }
    }
    this.markDirty();
  }
}

