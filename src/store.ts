import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  OnNodesChange,
  OnEdgesChange,
} from 'reactflow';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import {
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  type ProviderCatalogId,
} from './lib/modelCatalog';
import { createStartNode, type StartNodeData } from './lib/startNode';

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
  incomingConnections: { source: string, targetNodeId: string, label?: string }[];
  outgoingConnections: { target: string, sourceNodeId: string, label?: string }[];
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

export type RFState = {
  canvases: Canvas[];
  sidebarFolders: SidebarFolder[];
  currentCanvasId: string | null;
  pendingBranch: PendingBranch | null;
  selectedProviderId: ProviderCatalogId;
  selectedModel: string;
  providerConfigs: Record<ProviderCatalogId, ProviderConfig>;
  
  // Auth State
  user: FirebaseUser | null;
  isAuthReady: boolean;
  syncStatus: SyncStatus;
  
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setAuthReady: (ready: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setCurrentCanvas: (id: string) => void;
  setSelectedProvider: (providerId: ProviderCatalogId) => void;
  setSelectedModel: (model: string) => void;
  updateProviderConfig: (providerId: ProviderCatalogId, patch: Partial<ProviderConfig>) => void;
  addCanvas: (options?: { incognito?: boolean }) => void;
  deleteCanvas: (id: string) => void;
  updateCanvasName: (id: string, name: string) => void;
  createSidebarFolder: (name?: string) => string;
  renameSidebarFolder: (id: string, name: string) => void;
  deleteSidebarFolder: (id: string) => void;
  moveCanvasToFolder: (canvasId: string, folderId: string | null) => void;
  
  // React Flow Actions (operate on current canvas)
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node<CanvasNodeData>[] | ((nodes: Node<CanvasNodeData>[]) => Node<CanvasNodeData>[])) => void;
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void;
  addNode: (node: Node<CanvasNodeData>) => void;
  updateNodeData: (nodeId: string, data: Partial<CanvasNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  setPendingBranch: (branch: PendingBranch | null) => void;
  archiveNodes: (nodeIds: string[]) => void;
  unarchiveNode: (folderNodeId: string) => void;
  
  // Firestore Sync
  saveCanvasToFirestore: (canvas: Canvas) => Promise<void>;
  loadCanvasesFromFirestore: () => void;
};

const useStore = create<RFState>()(
  persist(
    (set, get) => ({
      canvases: [],
      sidebarFolders: [],
      currentCanvasId: null,
      pendingBranch: null,
      selectedProviderId: 'gemini',
      selectedModel: getDefaultModelForProvider('gemini'),
      providerConfigs: {
        gemini: {
          apiKey: process.env.GEMINI_API_KEY || '',
          baseUrl: '',
        },
        deepseek: {
          apiKey: '',
          baseUrl: getDefaultBaseUrlForProvider('deepseek'),
        },
        qwen: {
          apiKey: '',
          baseUrl: getDefaultBaseUrlForProvider('qwen'),
        },
        moonshot: {
          apiKey: '',
          baseUrl: getDefaultBaseUrlForProvider('moonshot'),
        },
        zhipu: {
          apiKey: '',
          baseUrl: getDefaultBaseUrlForProvider('zhipu'),
        },
      },
      user: null,
      isAuthReady: false,
      syncStatus: 'synced',

      setUser: (user) => set({ user }),
      setAuthReady: (ready) => set({ isAuthReady: ready }),
      setSyncStatus: (status) => set({ syncStatus: status }),

      setCurrentCanvas: (id) => {
        set({ currentCanvasId: id, pendingBranch: null });
      },

      setSelectedProvider: (providerId) => {
        set({
          selectedProviderId: providerId,
          selectedModel: getDefaultModelForProvider(providerId),
        });
      },

      setSelectedModel: (model) => {
        set({ selectedModel: model });
      },

      updateProviderConfig: (providerId, patch) => {
        const currentConfig = get().providerConfigs[providerId];
        set({
          providerConfigs: {
            ...get().providerConfigs,
            [providerId]: {
              ...currentConfig,
              ...patch,
            },
          },
        });
      },

      saveCanvasToFirestore: async (canvas) => {
        const { user } = get();
        if (!user) return;

        set({ syncStatus: 'syncing' });
        try {
          const canvasRef = doc(db, 'users', user.uid, 'canvases', canvas.id);
          
          // Deep clone and sanitize to remove functions, DOM elements, and circular references
          const sanitizeData = (obj: any, seen = new WeakSet()): any => {
            if (obj === null || typeof obj !== 'object') {
              // Keep primitives, but remove functions
              return typeof obj === 'function' ? undefined : obj;
            }
            
            if (obj instanceof HTMLElement || (obj.constructor && obj.constructor.name === 'HTMLElement')) {
              return undefined; // Strip DOM elements
            }

            if (seen.has(obj)) {
              return undefined; // Break circular references
            }
            seen.add(obj);

            if (Array.isArray(obj)) {
              return obj.map(item => sanitizeData(item, seen)).filter(item => item !== undefined);
            }

            const result: any = {};
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Explicitly skip known function properties just in case
                if (key === 'onSendMessage' || key === 'onExpand') continue;
                
                const value = sanitizeData(obj[key], seen);
                if (value !== undefined) {
                  result[key] = value;
                }
              }
            }
            return result;
          };

          const sanitizedCanvas = sanitizeData({
            id: canvas.id,
            name: canvas.name,
            createdAt: canvas.createdAt,
            lastModified: Date.now(),
            nodes: canvas.nodes,
            edges: canvas.edges,
            ownerId: user.uid,
          });

          await setDoc(canvasRef, sanitizedCanvas);
          set({ syncStatus: 'synced' });
        } catch (error) {
          console.error('Error saving canvas to Firestore:', error);
          set({ syncStatus: 'error' });
        }
      },

      loadCanvasesFromFirestore: () => {
        const { user } = get();
        if (!user) return;

        const canvasesRef = collection(db, 'users', user.uid, 'canvases');
        const q = query(canvasesRef);

        return onSnapshot(q, (snapshot) => {
          const remoteCanvases: Canvas[] = [];
          snapshot.forEach((doc) => {
            remoteCanvases.push(doc.data() as Canvas);
          });

          if (remoteCanvases.length > 0) {
            const sortedCanvases = remoteCanvases.sort((a, b) => b.lastModified - a.lastModified);
            const remoteFolders = Array.from(
              new Map(
                sortedCanvases
                  .filter((canvas) => canvas.folderId && canvas.folderName)
                  .map((canvas) => [
                    canvas.folderId!,
                    {
                      id: canvas.folderId!,
                      name: canvas.folderName!,
                      createdAt: canvas.createdAt,
                      lastModified: canvas.lastModified,
                    } satisfies SidebarFolder,
                  ])
              ).values()
            );

            set({ 
              canvases: sortedCanvases,
              sidebarFolders: Array.from(
                new Map(
                  [...get().sidebarFolders, ...remoteFolders].map((folder) => [folder.id, folder])
                ).values()
              ).sort((a, b) => b.lastModified - a.lastModified),
              currentCanvasId: get().currentCanvasId || sortedCanvases[0].id
            });
          }
        }, (error) => {
          console.error('Firestore onSnapshot error:', error);
          set({ syncStatus: 'error' });
        });
      },

      addCanvas: (options) => {
        const id = `canvas_${Date.now()}`;
        const isIncognito = Boolean(options?.incognito);
        const newCanvas: Canvas = {
          id,
          name: isIncognito ? 'Private Chat' : `Untitled Canvas ${get().canvases.length + 1}`,
          nodes: [createStartNode(id)],
          edges: [],
          folderId: null,
          folderName: null,
          isIncognito,
          createdAt: Date.now(),
          lastModified: Date.now(),
        };
        
        const updatedCanvases = [newCanvas, ...get().canvases];
        set({
          canvases: updatedCanvases,
          currentCanvasId: id,
          pendingBranch: null,
        });

        const { user } = get();
        if (user) {
          get().saveCanvasToFirestore(newCanvas);
        }
      },

      deleteCanvas: async (id) => {
        const newCanvases = get().canvases.filter((c) => c.id !== id);
        let nextCanvasId = get().currentCanvasId;
        if (nextCanvasId === id) {
          nextCanvasId = newCanvases.length > 0 ? newCanvases[0].id : null;
        }
        set({
          canvases: newCanvases,
          currentCanvasId: nextCanvasId,
          pendingBranch: null,
        });

        const { user } = get();
        if (user) {
          try {
            await deleteDoc(doc(db, 'users', user.uid, 'canvases', id));
          } catch (error) {
            console.error('Error deleting canvas from Firestore:', error);
          }
        }
      },

      updateCanvasName: (id, name) => {
        const updatedCanvases = get().canvases.map((c) =>
          c.id === id ? { ...c, name, lastModified: Date.now() } : c
        );
        set({ canvases: updatedCanvases });

        const { user } = get();
        if (user) {
          const updatedCanvas = updatedCanvases.find(c => c.id === id);
          if (updatedCanvas) get().saveCanvasToFirestore(updatedCanvas);
        }
      },

      createSidebarFolder: (name) => {
        const timestamp = Date.now();
        const folderId = `sidebar_folder_${timestamp}`;
        const nextFolderCount = get().sidebarFolders.length + 1;
        const newFolder: SidebarFolder = {
          id: folderId,
          name: name?.trim() || `Archive ${nextFolderCount}`,
          createdAt: timestamp,
          lastModified: timestamp,
        };

        set({
          sidebarFolders: [newFolder, ...get().sidebarFolders],
        });

        return folderId;
      },

      renameSidebarFolder: (id, name) => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        const updatedFolders = get().sidebarFolders.map((folder) =>
          folder.id === id ? { ...folder, name: trimmedName, lastModified: Date.now() } : folder
        );

        const updatedCanvases = get().canvases.map((canvas) =>
          canvas.folderId === id
            ? { ...canvas, folderName: trimmedName, lastModified: Date.now() }
            : canvas
        );

        set({
          sidebarFolders: updatedFolders,
          canvases: updatedCanvases,
        });

        const { user } = get();
        if (user) {
          updatedCanvases
            .filter((canvas) => canvas.folderId === id)
            .forEach((canvas) => {
              get().saveCanvasToFirestore(canvas);
            });
        }
      },

      deleteSidebarFolder: (id) => {
        const updatedFolders = get().sidebarFolders.filter((folder) => folder.id !== id);
        const affectedCanvasIds = get().canvases
          .filter((canvas) => canvas.folderId === id)
          .map((canvas) => canvas.id);
        const updatedCanvases = get().canvases.map((canvas) =>
          canvas.folderId === id
            ? { ...canvas, folderId: null, folderName: null, lastModified: Date.now() }
            : canvas
        );

        set({
          sidebarFolders: updatedFolders,
          canvases: updatedCanvases,
        });

        const { user } = get();
        if (user) {
          updatedCanvases
            .filter((canvas) => affectedCanvasIds.includes(canvas.id))
            .forEach((canvas) => {
              get().saveCanvasToFirestore(canvas);
            });
        }
      },

      moveCanvasToFolder: (canvasId, folderId) => {
        const targetCanvas = get().canvases.find((canvas) => canvas.id === canvasId);
        if (!targetCanvas) return;

        const targetFolder = folderId
          ? get().sidebarFolders.find((folder) => folder.id === folderId) ??
            (targetCanvas.folderId === folderId && targetCanvas.folderName
              ? {
                  id: folderId,
                  name: targetCanvas.folderName,
                  createdAt: Date.now(),
                  lastModified: Date.now(),
                }
              : null)
          : null;

        const updatedCanvases = get().canvases.map((canvas) =>
          canvas.id === canvasId
            ? {
                ...canvas,
                folderId: targetFolder?.id ?? null,
                folderName: targetFolder?.name ?? null,
                lastModified: Date.now(),
              }
            : canvas
        );

        set({
          canvases: updatedCanvases,
        });

        const { user } = get();
        if (user) {
          const updatedCanvas = updatedCanvases.find((canvas) => canvas.id === canvasId);
          if (updatedCanvas) get().saveCanvasToFirestore(updatedCanvas);
        }
      },

      onNodesChange: (changes: NodeChange[]) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedNodes = applyNodeChanges(changes, currentCanvas.nodes);
        const updatedCanvas = { ...currentCanvas, nodes: updatedNodes, lastModified: Date.now() };
        
        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        // Only save to firestore if the change is NOT a continuous drag
        // We check if it's a position change that is NOT dragging
        const shouldSave = changes.some(c => {
          if (c.type === 'position') {
            return c.dragging === false || c.dragging === undefined; // Only save when drag stops or programmatic
          }
          if (c.type === 'dimensions' || c.type === 'remove' || c.type === 'add') {
            return true;
          }
          return false;
        });

        if (user && shouldSave) {
           get().saveCanvasToFirestore(updatedCanvas);
        }
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedEdges = applyEdgeChanges(changes, currentCanvas.edges);
        const updatedCanvas = { ...currentCanvas, edges: updatedEdges, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      onConnect: (connection: Connection) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedEdges = addEdge(connection, currentCanvas.edges);
        const updatedCanvas = { ...currentCanvas, edges: updatedEdges, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      setNodes: (nodesOrUpdater) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedNodes = typeof nodesOrUpdater === 'function' 
          ? nodesOrUpdater(currentCanvas.nodes) 
          : nodesOrUpdater;

        const updatedCanvas = { ...currentCanvas, nodes: updatedNodes, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      setEdges: (edgesOrUpdater) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedEdges = typeof edgesOrUpdater === 'function' 
          ? edgesOrUpdater(currentCanvas.edges) 
          : edgesOrUpdater;

        const updatedCanvas = { ...currentCanvas, edges: updatedEdges, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      addNode: (node) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedCanvas = { ...currentCanvas, nodes: [...currentCanvas.nodes, node], lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      updateNodeData: (nodeId, data) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedNodes = currentCanvas.nodes.map((node) => {
          if (node.id === nodeId) {
            return { ...node, data: { ...node.data, ...data } };
          }
          return node;
        });

        const updatedCanvas = { ...currentCanvas, nodes: updatedNodes, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        // Only sync if not just a processing state change to avoid excessive writes
        if (user && !('isProcessing' in data)) {
          get().saveCanvasToFirestore(updatedCanvas);
        }
      },

      deleteNode: (nodeId) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const updatedNodes = currentCanvas.nodes.filter((node) => node.id !== nodeId);
        const updatedEdges = currentCanvas.edges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        );

        const updatedCanvas = { ...currentCanvas, nodes: updatedNodes, edges: updatedEdges, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      archiveNodes: (nodeIds) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId || nodeIds.length === 0) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const nodesToArchive = currentCanvas.nodes.filter(n => nodeIds.includes(n.id)) as Node<ConversationNodeData>[];
        if (nodesToArchive.length === 0) return;

        // Calculate average position
        const avgX = nodesToArchive.reduce((sum, n) => sum + n.position.x, 0) / nodesToArchive.length;
        const avgY = nodesToArchive.reduce((sum, n) => sum + n.position.y, 0) / nodesToArchive.length;

        const internalEdges = currentCanvas.edges.filter(e => nodeIds.includes(e.source) && nodeIds.includes(e.target));
        const incomingEdges = currentCanvas.edges.filter(e => !nodeIds.includes(e.source) && nodeIds.includes(e.target));
        const outgoingEdges = currentCanvas.edges.filter(e => nodeIds.includes(e.source) && !nodeIds.includes(e.target));

        const folderId = `folder_${Date.now()}`;
        
        const incomingConnections = incomingEdges.map(e => ({ source: e.source, targetNodeId: e.target, label: e.label as string }));
        const outgoingConnections = outgoingEdges.map(e => ({ target: e.target, sourceNodeId: e.source, label: e.label as string }));

        const folderNode: Node<FolderNodeData> = {
          id: folderId,
          type: 'folder',
          position: { x: avgX, y: avgY },
          data: {
            label: `Archived Group (${nodesToArchive.length})`,
            archivedNodes: nodesToArchive,
            archivedEdges: internalEdges,
            incomingConnections,
            outgoingConnections,
          }
        };

        // Create new edges for the folder
        const newEdges: Edge[] = [];
        
        // Map incoming edges to the folder (unique sources)
        const uniqueSources = Array.from(new Set(incomingEdges.map(e => e.source)));
        uniqueSources.forEach(source => {
          newEdges.push({
            id: `edge_${source}_${folderId}`,
            source: source,
            target: folderId,
            label: 'to folder'
          });
        });

        // Map outgoing edges from the folder (unique targets)
        const uniqueTargets = Array.from(new Set(outgoingEdges.map(e => e.target)));
        uniqueTargets.forEach(target => {
          newEdges.push({
            id: `edge_${folderId}_${target}`,
            source: folderId,
            target: target,
            label: 'from folder'
          });
        });

        const updatedNodes = [
          ...currentCanvas.nodes.filter(n => !nodeIds.includes(n.id)),
          folderNode
        ];

        const updatedEdges = [
          ...currentCanvas.edges.filter(e => !nodeIds.includes(e.source) && !nodeIds.includes(e.target)),
          ...newEdges
        ];

        const updatedCanvas = { ...currentCanvas, nodes: updatedNodes, edges: updatedEdges, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      unarchiveNode: (folderNodeId) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        const currentCanvas = canvases.find((c) => c.id === currentCanvasId);
        if (!currentCanvas) return;

        const folderNode = currentCanvas.nodes.find(n => n.id === folderNodeId) as Node<FolderNodeData>;
        if (!folderNode || folderNode.type !== 'folder') return;

        const { archivedNodes, archivedEdges, incomingConnections, outgoingConnections } = folderNode.data;

        // Restore original edges
        const restoredIncoming = incomingConnections.map(conn => ({
          id: `edge_${conn.source}_${conn.targetNodeId}`,
          source: conn.source,
          target: conn.targetNodeId,
          label: conn.label
        }));

        const restoredOutgoing = outgoingConnections.map(conn => ({
          id: `edge_${conn.sourceNodeId}_${conn.target}`,
          source: conn.sourceNodeId,
          target: conn.target,
          label: conn.label
        }));

        const updatedNodes = [
          ...currentCanvas.nodes.filter(n => n.id !== folderNodeId),
          ...archivedNodes
        ];

        const updatedEdges = [
          ...currentCanvas.edges.filter(e => e.source !== folderNodeId && e.target !== folderNodeId),
          ...archivedEdges,
          ...restoredIncoming,
          ...restoredOutgoing
        ];

        const updatedCanvas = { ...currentCanvas, nodes: updatedNodes, edges: updatedEdges, lastModified: Date.now() };

        set({
          canvases: canvases.map((c) =>
            c.id === currentCanvasId ? updatedCanvas : c
          ),
        });

        const { user } = get();
        if (user) get().saveCanvasToFirestore(updatedCanvas);
      },

      setPendingBranch: (branch) => {
        set({ pendingBranch: branch });
      },
    }),
    {
      name: 'gemini-canvas-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        canvases: state.canvases,
        sidebarFolders: state.sidebarFolders,
        currentCanvasId: state.currentCanvasId,
        selectedProviderId: state.selectedProviderId,
        selectedModel: state.selectedModel,
        providerConfigs: state.providerConfigs,
      }),
    }
  )
);

export default useStore;
