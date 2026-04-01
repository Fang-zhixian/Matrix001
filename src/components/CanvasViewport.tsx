import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from 'reactflow';
import { Hand, ScanSearch } from 'lucide-react';
import type { CanvasNodeData } from '../types/canvas';

export type CanvasInteractionMode = 'drag' | 'select';

interface CanvasViewportProps {
  edges: Edge[];
  hidden: boolean;
  interactionMode: CanvasInteractionMode;
  nodeTypes: NodeTypes;
  nodes: Node<CanvasNodeData>[];
  onConnect: (connection: Connection) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onNodeContextMenu: (event: React.MouseEvent, node: Node<CanvasNodeData>) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onPaneContextMenu: (event: React.MouseEvent) => void;
  setInteractionMode: (mode: CanvasInteractionMode) => void;
}

function getMiniMapNodeColor(node: { type?: string }) {
  if (node.type === 'start') return '#0f172a';
  if (node.type === 'folder') return '#94a3b8';
  return '#0071e3';
}

export default function CanvasViewport({
  edges,
  hidden,
  interactionMode,
  nodeTypes,
  nodes,
  onConnect,
  onEdgesChange,
  onNodeContextMenu,
  onNodesChange,
  onPaneContextMenu,
  setInteractionMode,
}: CanvasViewportProps) {
  const isSelectionMode = interactionMode === 'select';

  return (
    <div className={`absolute inset-0 transition-opacity duration-300 ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{
          animated: true,
        }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        selectionOnDrag={isSelectionMode}
        panOnDrag={!isSelectionMode}
        nodesDraggable
        selectionMode={SelectionMode.Partial}
        className="bg-canvas-bg"
      >
        <Background color="#e2e8f0" gap={20} size={1} />
        <Controls
          position="bottom-left"
          showFitView
          className="!flex !flex-row shadow-xl shadow-slate-200/20 rounded-xl overflow-hidden border border-slate-100 [&>button]:!w-6 [&>button]:!h-6 [&>button]:!border-b-0 [&>button]:!border-r [&>button:last-child]:!border-r-0 [&>button>svg]:!max-w-[10px] [&>button>svg]:!max-h-[10px] m-4"
        />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(255,255,255,0.78)"
          nodeColor={getMiniMapNodeColor}
          nodeStrokeWidth={3}
          className="!mb-6 !mr-6 !h-[150px] !w-[220px] !overflow-hidden !rounded-[1.4rem] !border !border-white/90 !bg-white/78 !shadow-[0_18px_48px_rgba(15,23,42,0.10)] !backdrop-blur-2xl"
        />
      </ReactFlow>

      <div className="pointer-events-none absolute bottom-[11.5rem] right-[1.55rem] z-20">
        <div className="pointer-events-auto mb-4 flex items-center gap-1 rounded-[1.1rem] border border-white/90 bg-white/72 p-1.5 shadow-[0_16px_42px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => setInteractionMode('drag')}
            className={`inline-flex items-center gap-2 rounded-[0.9rem] px-3.5 py-2.5 text-[13px] font-medium transition ${
              !isSelectionMode
                ? 'bg-slate-900 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)]'
                : 'text-slate-600 hover:bg-black/[0.04]'
            }`}
          >
            <Hand className="h-4 w-4" />
            <span>拖拽</span>
          </button>
          <button
            type="button"
            onClick={() => setInteractionMode('select')}
            className={`inline-flex items-center gap-2 rounded-[0.9rem] px-3.5 py-2.5 text-[13px] font-medium transition ${
              isSelectionMode
                ? 'bg-[#0071e3] text-white shadow-[0_10px_22px_rgba(0,113,227,0.22)]'
                : 'text-slate-600 hover:bg-black/[0.04]'
            }`}
          >
            <ScanSearch className="h-4 w-4" />
            <span>框选</span>
          </button>
        </div>
      </div>
    </div>
  );
}
