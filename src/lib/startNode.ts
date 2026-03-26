import type { Node } from 'reactflow';

export interface StartNodeData {
  label: string;
}

export const START_NODE_WIDTH = 220;
export const START_NODE_HEIGHT = 92;

type StartNodePosition = {
  x: number;
  y: number;
};

export function createStartNode(canvasId: string): Node<StartNodeData> {
  return createStandaloneStartNode(
    `start_${canvasId}`,
    {
      x: 0,
      y: -170,
    },
    {
      draggable: false,
      selectable: false,
      deletable: false,
    }
  );
}

type StartNodeOptions = {
  draggable: boolean;
  selectable: boolean;
  deletable: boolean;
};

export function createStandaloneStartNode(
  nodeId: string,
  position: StartNodePosition,
  options: StartNodeOptions = {
    draggable: true,
    selectable: true,
    deletable: true,
  }
): Node<StartNodeData> {
  return {
    id: nodeId,
    type: 'start',
    position,
    data: {
      label: 'Conversation Start',
    },
    draggable: options.draggable,
    selectable: options.selectable,
    deletable: options.deletable,
    selected: false,
  };
}

export function isRootStartNode(nodeId: string, canvasId: string) {
  return nodeId === `start_${canvasId}`;
}

export function isStartNodeId(nodeId: string) {
  return nodeId.startsWith('start_');
}
