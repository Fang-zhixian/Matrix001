import type { Edge, Node } from 'reactflow';
import type { StartNodeData } from '../lib/startNode';

export interface Message {
  role: 'user' | 'model';
  content: string;
  reasoningContent?: string;
  attachments?: AttachmentPayload[];
}

export interface AttachmentPayload {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'document';
  previewUrl?: string;
  dataUrl?: string;
  base64Data?: string;
}

export interface PendingBranch {
  sourceNodeId: string;
  direction: 'top' | 'bottom' | 'left' | 'right';
  pendingNodeId: string;
  isAutoCreated?: boolean;
}

export interface ConversationNodeData {
  label: string;
  messages: Message[];
  isProcessing?: boolean;
  isPending?: boolean;
  globalInput?: string;
  onSendMessage?: (nodeId: string, message: string) => void;
}

export interface FolderNodeData {
  label: string;
  archivedNodes: Node<ConversationNodeData>[];
  archivedEdges: Edge[];
  incomingConnections: { source: string; targetNodeId: string; label?: string }[];
  outgoingConnections: { target: string; sourceNodeId: string; label?: string }[];
  onExpand?: (nodeId: string) => void;
}

export type CanvasNodeData = ConversationNodeData | FolderNodeData | StartNodeData;

export interface Canvas {
  id: string;
  name: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  folderId?: string | null;
  folderName?: string | null;
  isIncognito?: boolean;
  createdAt: number;
  lastModified: number;
  ownerId?: string;
}

export interface SidebarFolder {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
}

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export interface DeletedNodesSnapshot {
  canvasId: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
}
