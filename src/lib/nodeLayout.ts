import { START_NODE_HEIGHT, START_NODE_WIDTH } from './startNode';

export type BranchDirection = 'top' | 'bottom' | 'left' | 'right';

export const CONVERSATION_NODE_WIDTH = 540;
export const CONVERSATION_NODE_HEIGHT = 320;
export const PENDING_NODE_WIDTH = 470;
export const PENDING_NODE_HEIGHT = 250;
export const NODE_GAP_X = 120;
export const NODE_GAP_Y = 120;

type PositionedNode = {
  type?: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
};

type NodeSize = {
  width: number;
  height: number;
};

const getSourceSize = (node: PositionedNode): NodeSize => ({
  width: node.width || (node.type === 'start' ? START_NODE_WIDTH : CONVERSATION_NODE_WIDTH),
  height: node.height || (node.type === 'start' ? START_NODE_HEIGHT : CONVERSATION_NODE_HEIGHT),
});

export const getConversationNodeSize = (sourceNode?: PositionedNode): NodeSize => ({
  width: CONVERSATION_NODE_WIDTH,
  height:
    sourceNode?.type === 'conversation'
      ? sourceNode.height || CONVERSATION_NODE_HEIGHT
      : CONVERSATION_NODE_HEIGHT,
});

export const getPendingNodeSize = (): NodeSize => ({
  width: PENDING_NODE_WIDTH,
  height: PENDING_NODE_HEIGHT,
});

export const getBranchedPosition = (
  sourceNode: PositionedNode,
  direction: BranchDirection,
  targetSize: NodeSize
) => {
  const sourceSize = getSourceSize(sourceNode);

  if (direction === 'right') {
    return {
      x: sourceNode.position.x + sourceSize.width + NODE_GAP_X,
      y: sourceNode.position.y + (sourceSize.height - targetSize.height) / 2,
    };
  }

  if (direction === 'left') {
    return {
      x: sourceNode.position.x - targetSize.width - NODE_GAP_X,
      y: sourceNode.position.y + (sourceSize.height - targetSize.height) / 2,
    };
  }

  if (direction === 'top') {
    return {
      x: sourceNode.position.x + (sourceSize.width - targetSize.width) / 2,
      y: sourceNode.position.y - targetSize.height - NODE_GAP_Y,
    };
  }

  return {
    x: sourceNode.position.x + (sourceSize.width - targetSize.width) / 2,
    y: sourceNode.position.y + sourceSize.height + NODE_GAP_Y,
  };
};

export const getNodeCenter = (position: { x: number; y: number }, size: NodeSize) => ({
  x: position.x + size.width / 2,
  y: position.y + size.height / 2,
});
