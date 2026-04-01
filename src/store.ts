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
import type { User as FirebaseUser } from 'firebase/auth';
import {
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  type ProviderCatalogId,
} from './lib/modelCatalog';
import { createStartNode } from './lib/startNode';
import {
  findCanvasById,
  mergeSidebarFolders,
  replaceCanvas,
  sanitizeCanvasForFirestore,
  shouldPersistNodeChanges,
  updateCanvasById,
  updateCurrentCanvas,
} from './lib/canvasStoreUtils';
import {
  deleteCanvasDocument,
  saveCanvasDocument,
  subscribeToCanvasDocuments,
} from './firebase';
import type {
  Canvas,
  CanvasNodeData,
  ConversationNodeData,
  DeletedNodesSnapshot,
  FolderNodeData,
  PendingBranch,
  ProviderConfig,
  SidebarFolder,
  SyncStatus,
} from './types/canvas';

export type {
  AttachmentPayload,
  Canvas,
  CanvasNodeData,
  ConversationNodeData,
  FolderNodeData,
  Message,
  PendingBranch,
  ProviderConfig,
  SidebarFolder,
  SyncStatus,
  DeletedNodesSnapshot,
} from './types/canvas';

export type RFState = {
  canvases: Canvas[];
  sidebarFolders: SidebarFolder[];
  currentCanvasId: string | null;
  pendingBranch: PendingBranch | null;
  deletedNodesSnapshot: DeletedNodesSnapshot | null;
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
  updateNodeDataForCanvas: (canvasId: string, nodeId: string, data: Partial<CanvasNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteNodes: (nodeIds: string[]) => void;
  undoDelete: () => void;
  restoreDeletedSnapshot: (snapshot: DeletedNodesSnapshot) => void;
  setPendingBranch: (branch: PendingBranch | null) => void;
  archiveNodes: (nodeIds: string[]) => void;
  unarchiveNode: (folderNodeId: string) => void;
  
  // Firestore Sync
  saveCanvasToFirestore: (canvas: Canvas) => Promise<void>;
  loadCanvasesFromFirestore: () => void;
};

const useStore = create<RFState>()(
  persist(
    (set, get) => {
      const persistCanvas = (canvas: Canvas | null | undefined) => {
        const { user } = get();
        if (user && canvas) {
          get().saveCanvasToFirestore(canvas);
        }
      };

      const commitCanvases = (
        canvases: Canvas[],
        options?: {
          currentCanvasId?: string | null;
          pendingBranch?: PendingBranch | null;
          persistedCanvas?: Canvas | null;
          sidebarFolders?: SidebarFolder[];
        }
      ) => {
        set({
          canvases,
          ...(options?.currentCanvasId !== undefined ? { currentCanvasId: options.currentCanvasId } : {}),
          ...(options?.pendingBranch !== undefined ? { pendingBranch: options.pendingBranch } : {}),
          ...(options?.sidebarFolders ? { sidebarFolders: options.sidebarFolders } : {}),
        });

        persistCanvas(options?.persistedCanvas);
      };

      const commitCanvasUpdate = (
        updatedCanvas: Canvas,
        options?: {
          currentCanvasId?: string | null;
          pendingBranch?: PendingBranch | null;
          sidebarFolders?: SidebarFolder[];
          shouldPersist?: boolean;
        }
      ) => {
        commitCanvases(replaceCanvas(get().canvases, updatedCanvas), {
          currentCanvasId: options?.currentCanvasId,
          pendingBranch: options?.pendingBranch,
          sidebarFolders: options?.sidebarFolders,
          persistedCanvas: options?.shouldPersist === false ? null : updatedCanvas,
        });
      };

      return {
      canvases: [],
      sidebarFolders: [],
      currentCanvasId: null,
      pendingBranch: null,
      deletedNodesSnapshot: null,
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
          const sanitizedCanvas = sanitizeCanvasForFirestore(canvas, user.uid);
          await saveCanvasDocument(user.uid, canvas.id, sanitizedCanvas);
          set({ syncStatus: 'synced' });
        } catch (error) {
          console.error('Error saving canvas to Firestore:', error);
          set({ syncStatus: 'error' });
        }
      },

      loadCanvasesFromFirestore: () => {
        const { user } = get();
        if (!user) return;

        void subscribeToCanvasDocuments(
          user.uid,
          (remoteCanvases) => {
            if (remoteCanvases.length > 0) {
              const sortedCanvases = remoteCanvases.sort((a, b) => b.lastModified - a.lastModified);

              set({
                canvases: sortedCanvases,
                sidebarFolders: mergeSidebarFolders(get().sidebarFolders, sortedCanvases),
                currentCanvasId: get().currentCanvasId || sortedCanvases[0].id,
              });
            }
          },
          (error) => {
            console.error('Firestore onSnapshot error:', error);
            set({ syncStatus: 'error' });
          }
        );
      },

      addCanvas: (options) => {
        const id = `canvas_${Date.now()}`;
        const isIncognito = Boolean(options?.incognito);
        const timestamp = Date.now();
        const newCanvas: Canvas = {
          id,
          name: isIncognito ? 'Private Chat' : `Untitled Canvas ${get().canvases.length + 1}`,
          nodes: [createStartNode(id)],
          edges: [],
          folderId: null,
          folderName: null,
          isIncognito,
          createdAt: timestamp,
          lastModified: timestamp,
        };

        commitCanvases([newCanvas, ...get().canvases], {
          currentCanvasId: id,
          pendingBranch: null,
        });
        persistCanvas(newCanvas);
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
          deletedNodesSnapshot: get().deletedNodesSnapshot?.canvasId === id ? null : get().deletedNodesSnapshot,
        });

        const { user } = get();
        if (user) {
          try {
            await deleteCanvasDocument(user.uid, id);
          } catch (error) {
            console.error('Error deleting canvas from Firestore:', error);
          }
        }
      },

      updateCanvasName: (id, name) => {
        const result = updateCanvasById(get().canvases, id, (canvas) => ({
          ...canvas,
          name,
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
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

        commitCanvases(updatedCanvases, { sidebarFolders: updatedFolders, persistedCanvas: null });
        updatedCanvases.filter((canvas) => canvas.folderId === id).forEach(persistCanvas);
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

        commitCanvases(updatedCanvases, { sidebarFolders: updatedFolders, persistedCanvas: null });
        updatedCanvases.filter((canvas) => affectedCanvasIds.includes(canvas.id)).forEach(persistCanvas);
      },

      moveCanvasToFolder: (canvasId, folderId) => {
        const targetCanvas = findCanvasById(get().canvases, canvasId);
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

        const result = updateCanvasById(get().canvases, canvasId, (canvas) => ({
          ...canvas,
          folderId: targetFolder?.id ?? null,
          folderName: targetFolder?.name ?? null,
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      onNodesChange: (changes: NodeChange[]) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => ({
          ...canvas,
          nodes: applyNodeChanges(changes, canvas.nodes),
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas, { shouldPersist: shouldPersistNodeChanges(changes) });
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => ({
          ...canvas,
          edges: applyEdgeChanges(changes, canvas.edges),
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      onConnect: (connection: Connection) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => ({
          ...canvas,
          edges: addEdge(connection, canvas.edges),
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      setNodes: (nodesOrUpdater) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => ({
          ...canvas,
          nodes: typeof nodesOrUpdater === 'function' ? nodesOrUpdater(canvas.nodes) : nodesOrUpdater,
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      setEdges: (edgesOrUpdater) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => ({
          ...canvas,
          edges: typeof edgesOrUpdater === 'function' ? edgesOrUpdater(canvas.edges) : edgesOrUpdater,
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      addNode: (node) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => ({
          ...canvas,
          nodes: [...canvas.nodes, node],
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      updateNodeData: (nodeId, data) => {
        const { currentCanvasId, canvases } = get();
        if (!currentCanvasId) return;

        get().updateNodeDataForCanvas(currentCanvasId, nodeId, data);
      },

      updateNodeDataForCanvas: (canvasId, nodeId, data) => {
        const result = updateCanvasById(get().canvases, canvasId, (canvas) => ({
          ...canvas,
          nodes: canvas.nodes.map((node) =>
            node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
          ),
          lastModified: Date.now(),
        }));
        if (!result) return;

        const shouldSync =
          !('isProcessing' in data) ||
          (typeof data.isProcessing === 'boolean' && data.isProcessing === false);

        if (shouldSync) {
          commitCanvasUpdate(result.updatedCanvas);
          return;
        }

        commitCanvasUpdate(result.updatedCanvas, { shouldPersist: false });
      },

      deleteNode: (nodeId) => {
        get().deleteNodes([nodeId]);
      },

      deleteNodes: (nodeIds) => {
        if (nodeIds.length === 0) return;

        const uniqueNodeIds = Array.from(new Set(nodeIds));
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (canvas) => {
          const deletedNodes = canvas.nodes.filter((node) => uniqueNodeIds.includes(node.id));
          if (deletedNodes.length === 0) {
            return canvas;
          }

          const deletedEdges = canvas.edges.filter(
            (edge) => uniqueNodeIds.includes(edge.source) || uniqueNodeIds.includes(edge.target)
          );

          return {
            ...canvas,
            nodes: canvas.nodes.filter((node) => !uniqueNodeIds.includes(node.id)),
            edges: canvas.edges.filter(
              (edge) => !uniqueNodeIds.includes(edge.source) && !uniqueNodeIds.includes(edge.target)
            ),
            lastModified: Date.now(),
          };
        });
        if (!result) return;
        if (result.updatedCanvas === result.currentCanvas) return;

        const deletedNodes = result.currentCanvas.nodes.filter((node) => uniqueNodeIds.includes(node.id));
        const deletedEdges = result.currentCanvas.edges.filter(
          (edge) => uniqueNodeIds.includes(edge.source) || uniqueNodeIds.includes(edge.target)
        );

        set({ deletedNodesSnapshot: {
          canvasId: result.currentCanvas.id,
          nodes: deletedNodes,
          edges: deletedEdges,
        }});

        commitCanvasUpdate(result.updatedCanvas);
      },

      undoDelete: () => {
        const snapshot = get().deletedNodesSnapshot;
        if (!snapshot) return;

        get().restoreDeletedSnapshot(snapshot);
        set({ deletedNodesSnapshot: null });
      },

      restoreDeletedSnapshot: (snapshot) => {
        const result = updateCanvasById(get().canvases, snapshot.canvasId, (canvas) => ({
          ...canvas,
          nodes: [
            ...canvas.nodes,
            ...snapshot.nodes.filter(
              (restoredNode) => !canvas.nodes.some((existingNode) => existingNode.id === restoredNode.id)
            ),
          ],
          edges: [
            ...canvas.edges,
            ...snapshot.edges.filter(
              (restoredEdge) => !canvas.edges.some((existingEdge) => existingEdge.id === restoredEdge.id)
            ),
          ],
          lastModified: Date.now(),
        }));
        if (!result) return;

        commitCanvasUpdate(result.updatedCanvas, { currentCanvasId: snapshot.canvasId });
      },

      archiveNodes: (nodeIds) => {
        if (nodeIds.length === 0) return;

        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (currentCanvas) => {
          const nodesToArchive = currentCanvas.nodes.filter((node) => nodeIds.includes(node.id)) as Node<ConversationNodeData>[];
          if (nodesToArchive.length === 0) {
            return currentCanvas;
          }

          const avgX = nodesToArchive.reduce((sum, node) => sum + node.position.x, 0) / nodesToArchive.length;
          const avgY = nodesToArchive.reduce((sum, node) => sum + node.position.y, 0) / nodesToArchive.length;

          const internalEdges = currentCanvas.edges.filter(
            (edge) => nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
          );
          const incomingEdges = currentCanvas.edges.filter(
            (edge) => !nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
          );
          const outgoingEdges = currentCanvas.edges.filter(
            (edge) => nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
          );

          const folderId = `folder_${Date.now()}`;
          const incomingConnections = incomingEdges.map((edge) => ({
            source: edge.source,
            targetNodeId: edge.target,
            label: edge.label as string,
          }));
          const outgoingConnections = outgoingEdges.map((edge) => ({
            target: edge.target,
            sourceNodeId: edge.source,
            label: edge.label as string,
          }));

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
            },
          };

          const newEdges: Edge[] = [
            ...Array.from(new Set(incomingEdges.map((edge) => edge.source))).map((source) => ({
              id: `edge_${source}_${folderId}`,
              source,
              target: folderId,
              label: 'to folder',
            })),
            ...Array.from(new Set(outgoingEdges.map((edge) => edge.target))).map((target) => ({
              id: `edge_${folderId}_${target}`,
              source: folderId,
              target,
              label: 'from folder',
            })),
          ];

          return {
            ...currentCanvas,
            nodes: [...currentCanvas.nodes.filter((node) => !nodeIds.includes(node.id)), folderNode],
            edges: [
              ...currentCanvas.edges.filter(
                (edge) => !nodeIds.includes(edge.source) && !nodeIds.includes(edge.target)
              ),
              ...newEdges,
            ],
            lastModified: Date.now(),
          };
        });
        if (!result) return;
        if (result.updatedCanvas === result.currentCanvas) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      unarchiveNode: (folderNodeId) => {
        const result = updateCurrentCanvas(get().canvases, get().currentCanvasId, (currentCanvas) => {
          const folderNode = currentCanvas.nodes.find((node) => node.id === folderNodeId) as Node<FolderNodeData>;
          if (!folderNode || folderNode.type !== 'folder') {
            return currentCanvas;
          }

          const { archivedNodes, archivedEdges, incomingConnections, outgoingConnections } = folderNode.data;
          const restoredIncoming = incomingConnections.map((connection) => ({
            id: `edge_${connection.source}_${connection.targetNodeId}`,
            source: connection.source,
            target: connection.targetNodeId,
            label: connection.label,
          }));
          const restoredOutgoing = outgoingConnections.map((connection) => ({
            id: `edge_${connection.sourceNodeId}_${connection.target}`,
            source: connection.sourceNodeId,
            target: connection.target,
            label: connection.label,
          }));

          return {
            ...currentCanvas,
            nodes: [...currentCanvas.nodes.filter((node) => node.id !== folderNodeId), ...archivedNodes],
            edges: [
              ...currentCanvas.edges.filter(
                (edge) => edge.source !== folderNodeId && edge.target !== folderNodeId
              ),
              ...archivedEdges,
              ...restoredIncoming,
              ...restoredOutgoing,
            ],
            lastModified: Date.now(),
          };
        });
        if (!result) return;
        if (result.updatedCanvas === result.currentCanvas) return;

        commitCanvasUpdate(result.updatedCanvas);
      },

      setPendingBranch: (branch) => {
        set({ pendingBranch: branch });
      },
    };
    },
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
