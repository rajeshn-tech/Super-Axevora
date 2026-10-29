/**
 * OpenComp - Dot Node
 * Nuke-style compact routing dot for clean DAG graph layout.
 */

import { Node } from '../core/Node.js';

export class DotNode extends Node {
  constructor(id, x = 0, y = 0) {
    super(id, 'Dot', 'Utility', x, y);
    this.width = 16;
    this.height = 16;
    this.color = '#737373';
    this.addInput('in', 'in');
  }

  compute(inputs, context = {}) {
    return inputs['in'] || null;
  }
}

