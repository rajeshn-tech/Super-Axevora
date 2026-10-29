/**
 * OpenComp - Node Registry & Factory
 */

import { ReadNode } from './ReadNode.js';
import { WriteNode } from './WriteNode.js';
import { ConstantNode } from './ConstantNode.js';
import { MergeNode } from './MergeNode.js';
import { GradeNode } from './GradeNode.js';
import { ColorCorrectNode } from './ColorCorrectNode.js';
import { InvertNode } from './InvertNode.js';
import { BlurNode } from './BlurNode.js';
import { TransformNode } from './TransformNode.js';
import { KeyerNode } from './KeyerNode.js';
import { RotoNode } from './RotoNode.js';
import { DotNode } from './DotNode.js';
import { ViewerNode } from './ViewerNode.js';

export const NODE_REGISTRY = {
  Read: ReadNode,
  Write: WriteNode,
  Constant: ConstantNode,
  Merge: MergeNode,
  Grade: GradeNode,
  ColorCorrect: ColorCorrectNode,
  Invert: InvertNode,
  Blur: BlurNode,
  Transform: TransformNode,
  Keyer: KeyerNode,
  Roto: RotoNode,
  Dot: DotNode,
  Viewer: ViewerNode
};

export const NODE_MENU = [
  {
    category: 'Image',
    items: [
      { type: 'Read', label: 'Read (Load / Generators)', shortcut: 'R' },
      { type: 'Constant', label: 'Constant (Solid Color)' },
      { type: 'Write', label: 'Write (Export Frame)' }
    ]
  },
  {
    category: 'Merge',
    items: [
      { type: 'Merge', label: 'Merge (A/B Composite)', shortcut: 'M' }
    ]
  },
  {
    category: 'Color',
    items: [
      { type: 'Grade', label: 'Grade (Nuke Math)', shortcut: 'G' },
      { type: 'ColorCorrect', label: 'ColorCorrect', shortcut: 'C' },
      { type: 'Invert', label: 'Invert' }
    ]
  },
  {
    category: 'Filter',
    items: [
      { type: 'Blur', label: 'Blur (Gaussian 2-Pass)', shortcut: 'B' }
    ]
  },
  {
    category: 'Transform',
    items: [
      { type: 'Transform', label: 'Transform (2D / Rotate / Scale)', shortcut: 'T' }
    ]
  },
  {
    category: 'Keyer',
    items: [
      { type: 'Keyer', label: 'Keyer (Chroma / Despill / Luma)', shortcut: 'K' }
    ]
  },
  {
    category: 'Channel / Draw',
    items: [
      { type: 'Roto', label: 'Roto (Vector Shape / Matte)', shortcut: 'O' },
      { type: 'Dot', label: 'Dot (Routing)', shortcut: '.' }
    ]
  },
  {
    category: 'Viewer',
    items: [
      { type: 'Viewer', label: 'Viewer', shortcut: '1-9' }
    ]
  }
];

let nodeCounter = {};

export function createNode(type, customId = null, x = 0, y = 0) {
  const NodeClass = NODE_REGISTRY[type];
  if (!NodeClass) {
    console.error(`Unknown node type: ${type}`);
    return null;
  }

  if (!customId) {
    if (!nodeCounter[type]) nodeCounter[type] = 1;
    customId = `${type}${nodeCounter[type]++}`;
  }

  return new NodeClass(customId, x, y);
}

