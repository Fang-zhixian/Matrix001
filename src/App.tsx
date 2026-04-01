import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'motion/react';
import { Undo2 } from 'lucide-react';
import useStore from './store';
import type { AttachmentPayload, ConversationNodeData, DeletedNodesSnapshot, FolderNodeData, Message } from './types/canvas';
import type { AIMessage } from './lib/ai';
import CanvasViewport, { type CanvasInteractionMode } from './components/CanvasViewport';
import ChatComposer from './components/ChatComposer';
import ConversationNode from './components/ConversationNode';
import FolderNode from './components/FolderNode';
import StartNode from './components/StartNode';
import Sidebar from './components/Sidebar';
import AccountPanel from './components/AccountPanel';
import ContextMenu from './components/ContextMenu';
import { getProviderCatalogEntry, PROVIDER_CATALOG } from './lib/modelCatalog';
import {
  inferMimeType,
  readFileAsDataUrl,
  stripAttachmentPayload,
} from './lib/attachmentUtils';
import { createStandaloneStartNode, createStartNode, isRootStartNode } from './lib/startNode';
import {
  CONVERSATION_NODE_HEIGHT,
  CONVERSATION_NODE_WIDTH,
  type BranchDirection,
  getBranchedPosition,
  getConversationNodeSize,
  getNodeCenter,
  getPendingNodeSize,
} from './lib/nodeLayout';

const nodeTypes = {
  conversation: ConversationNode,
  folder: FolderNode,
  start: StartNode,
};

const ModelSettingsPanel = React.lazy(() => import('./components/ModelSettingsPanel'));

const Canvas = () => {
  const { 
    canvases, 
    currentCanvasId, 
    setCurrentCanvas, 
    addCanvas, 
    deleteCanvas,
    pendingBranch, 
    setPendingBranch,
    onNodesChange,
    onEdgesChange,
    onConnect,
    updateNodeDataForCanvas,
    setNodes,
    setEdges,
    bootstrapWorkspace,
    selectedProviderId,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    providerConfigs,
    providerStatus,
    currentUser,
    billingSummary,
    plans,
    deploymentMode,
    byokEnabled,
    allowGuest,
    requiresLogin,
    updateProviderConfig,
    loginAccount,
    registerAccount,
    logoutAccount,
    changePlan,
    archiveNodes,
    unarchiveNode,
    deleteNode,
    deleteNodes,
    deletedNodesSnapshot,
    undoDelete,
    restoreDeletedSnapshot,
    isWorkspaceReady,
  } = useStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; isFolder: boolean; isPane: boolean; nodeId: string | null } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<DeletedNodesSnapshot | null>(null);
  const [isAccountPanelOpen, setIsAccountPanelOpen] = useState(false);
  const [accountPanelView, setAccountPanelView] = useState<'account' | 'billing' | 'login' | 'register'>('login');

  useEffect(() => {
    void bootstrapWorkspace();
  }, [bootstrapWorkspace]);

  const currentCanvas = useMemo(() => 
    canvases.find(c => c.id === currentCanvasId) || null
  , [canvases, currentCanvasId]);

  const nodes = currentCanvas?.nodes || [];
  const edges = currentCanvas?.edges || [];
  const rootStartNode = currentCanvasId
    ? nodes.find((node) => node.type === 'start' && isRootStartNode(node.id, currentCanvasId)) ?? null
    : null;
  const conversationNodes = nodes.filter((node) => node.type === 'conversation');

  const { fitView, setCenter, project } = useReactFlow();
  const [globalInput, setGlobalInput] = useState('');
  const [composerAttachments, setComposerAttachments] = useState<AttachmentPayload[]>([]);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [canvasInteractionMode, setCanvasInteractionMode] = useState<CanvasInteractionMode>('drag');
  const selectedProvider = getProviderCatalogEntry(selectedProviderId);
  const selectedProviderConfig = providerConfigs[selectedProviderId];
  const selectedProviderStatus = providerStatus[selectedProviderId];
  const selectedModelOption = selectedProvider.models.find((model) => model.id === selectedModel) ?? selectedProvider.models[0];
  const selectedModelCapabilities = selectedModelOption?.capabilities ?? {};
  const supportsImageUpload = Boolean(selectedModelCapabilities.image);
  const supportsPdfUpload = Boolean(selectedModelCapabilities.pdf);
  const supportsAnyUpload = supportsImageUpload || supportsPdfUpload;
  const modelMenuItems = PROVIDER_CATALOG.flatMap((provider) =>
    provider.models.map((model) => {
      const config = providerConfigs[provider.id];
      const status = providerStatus[provider.id];
      const isConfigured = Boolean(status?.available || config.apiKey.trim());

      return { provider, model, isConfigured };
    })
  );
  const isProviderConfigured = Boolean(selectedProviderStatus?.available || selectedProviderConfig.apiKey.trim());
  const canUseCurrentWorkspace = !requiresLogin || Boolean(currentUser);
  const isProviderReadyForComposer = isProviderConfigured && canUseCurrentWorkspace;

  const openAccountPanel = useCallback((view: 'account' | 'billing' | 'login' | 'register') => {
    setAccountPanelView(view);
    setIsAccountPanelOpen(true);
  }, []);

  // Ensure at least one canvas exists
  useEffect(() => {
    if (!isWorkspaceReady) {
      return;
    }

    if (requiresLogin && !currentUser) {
      return;
    }

    if (canvases.length === 0) {
      addCanvas();
    } else if (!currentCanvasId) {
      setCurrentCanvas(canvases[0].id);
    }
  }, [addCanvas, canvases, currentCanvasId, currentUser, isWorkspaceReady, requiresLogin, setCurrentCanvas]);

  useEffect(() => {
    if (isWorkspaceReady && requiresLogin && !currentUser) {
      openAccountPanel('login');
    }
  }, [currentUser, isWorkspaceReady, openAccountPanel, requiresLogin]);

  useEffect(() => {
    if (!currentCanvasId || rootStartNode) return;

    const nextStartNode = createStartNode(currentCanvasId);
    const rootTargets = nodes.filter((node) => {
      if (node.type === 'start') return false;
      return !edges.some((edge) => edge.target === node.id);
    });

    setNodes((currentNodes) => [nextStartNode, ...currentNodes]);

    if (rootTargets.length > 0) {
      setEdges((currentEdges) => [
        ...currentEdges,
        ...rootTargets.map((node) => ({
          id: `edge_${nextStartNode.id}_${node.id}`,
          source: nextStartNode.id,
          target: node.id,
          sourceHandle: 'bottom',
          targetHandle: node.type === 'conversation' ? 'target-top' : undefined,
        })),
      ]);
    }
  }, [currentCanvasId, rootStartNode, nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    if (!currentCanvasId) return;

    const needsManualStartNormalization = nodes.some(
      (node) =>
        node.type === 'start' &&
        !isRootStartNode(node.id, currentCanvasId) &&
        (!node.draggable || !node.selectable)
    );

    if (!needsManualStartNormalization) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.type === 'start' && !isRootStartNode(node.id, currentCanvasId)
          ? { ...node, draggable: true, selectable: true, deletable: true }
          : node
      )
    );
  }, [currentCanvasId, nodes, setNodes]);

  const getContextMessages = useCallback((nodeId: string) => {
    const context: Message[] = [];
    let currentNodeId: string | null = nodeId;
    const currentNodes = nodes;
    const currentEdges = edges;

    while (currentNodeId) {
      const node = currentNodes.find((n) => n.id === currentNodeId);
      if (node && node.type === 'conversation') {
        const data = node.data as ConversationNodeData;
        if (!data.isPending) {
          context.unshift(...data.messages);
        }
      }

      const parentEdge = currentEdges.find((e) => e.target === currentNodeId);
      currentNodeId = parentEdge ? parentEdge.source : null;
    }

    return context;
  }, [nodes, edges]);

  const getAnchorNode = useCallback(
    () =>
      nodes.find((node) => node.selected && (node.type === 'conversation' || node.type === 'start')) ||
      [...nodes].reverse().find((node) => node.type === 'conversation') ||
      rootStartNode,
    [nodes, rootStartNode]
  );

  const buildModelMessage = useCallback(
    (content: string, reasoningContent = ''): Message => ({
      role: 'model',
      content,
      reasoningContent: reasoningContent || undefined,
    }),
    []
  );

  const streamResponseToNode = useCallback(async ({
    canvasId,
    nodeId,
    requestMessages,
    messagesBeforeModel,
    focusPosition,
    errorFallback,
    systemInstruction,
  }: {
    canvasId: string;
    nodeId: string;
    requestMessages: AIMessage[];
    messagesBeforeModel: Message[];
    focusPosition?: { x: number; y: number };
    errorFallback: string;
    systemInstruction?: string;
  }) => {
    const { streamText } = await import('./lib/ai');
    let fullText = '';
    let fullReasoningText = '';

    updateNodeDataForCanvas(canvasId, nodeId, {
      messages: [...messagesBeforeModel, buildModelMessage('')],
      isProcessing: true,
    });

    if (focusPosition) {
      setTimeout(() => {
        const center = getNodeCenter(focusPosition, getConversationNodeSize());
        setCenter(center.x, center.y, { zoom: 1, duration: 800 });
      }, 100);
    }

    try {
      for await (const chunk of streamText({
        providerId: selectedProviderId,
        model: selectedModel,
        messages: requestMessages,
        systemInstruction,
      })) {
        if (chunk.type === 'reasoning') {
          fullReasoningText += chunk.text;
        } else {
          fullText += chunk.text;
        }

        updateNodeDataForCanvas(canvasId, nodeId, {
          messages: [...messagesBeforeModel, buildModelMessage(fullText, fullReasoningText)],
          isProcessing: true,
        });
      }

      updateNodeDataForCanvas(canvasId, nodeId, {
        messages: [...messagesBeforeModel, buildModelMessage(fullText || 'No response', fullReasoningText)],
        isProcessing: false,
      });
    } catch (error) {
      console.error('Model stream error:', error);
      updateNodeDataForCanvas(canvasId, nodeId, {
        messages: [
          ...messagesBeforeModel,
          {
            role: 'model',
            content: `Error: ${error instanceof Error ? error.message : errorFallback}`,
          },
        ],
        isProcessing: false,
      });
    }
  }, [
    buildModelMessage,
    selectedModel,
    selectedProviderId,
    setCenter,
    updateNodeDataForCanvas,
  ]);

  const handleSendMessage = useCallback(async (nodeId: string, text: string) => {
    if (!currentCanvasId) return;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'conversation') return;

    const activeCanvasId = currentCanvasId;
    const data = node.data as ConversationNodeData;
    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...data.messages, userMessage];

    updateNodeDataForCanvas(activeCanvasId, nodeId, {
      messages: updatedMessages,
      isProcessing: true,
    });

    await streamResponseToNode({
      canvasId: activeCanvasId,
      nodeId,
      requestMessages: updatedMessages.map((message) => ({
        role: message.role,
        content: message.content,
        attachments: message.attachments,
      })),
      messagesBeforeModel: updatedMessages,
      errorFallback: 'Failed to get response from provider.',
      systemInstruction: 'You are a helpful assistant. Keep responses concise but informative.',
    });
  }, [currentCanvasId, streamResponseToNode, updateNodeDataForCanvas, nodes]);

  // Inject handlers into nodes
  const nodesWithHandlers = useMemo(() => {
    return nodes.map(node => {
      if (node.type === 'folder') {
        return {
          ...node,
          data: {
            ...node.data,
            onExpand: unarchiveNode
          }
        };
      }
      return {
        ...node,
        data: {
          ...node.data,
          onSendMessage: handleSendMessage,
          globalInput: globalInput
        }
      };
    });
  }, [nodes, handleSendMessage, unarchiveNode, globalInput]);

  // Auto-create pending branch when typing
  useEffect(() => {
    if (globalInput.trim().length > 0 && !pendingBranch && conversationNodes.length > 0) {
      const targetNode = getAnchorNode();

      if (targetNode) {
        if (targetNode.type === 'conversation') {
          const data = targetNode.data as ConversationNodeData;
          if (data.isProcessing) {
            return;
          }
        }

        const id = targetNode.id;
        const direction = 'bottom' as 'top' | 'bottom' | 'left' | 'right';
        const pendingNodeId = `pending_${id}_${Date.now()}`;
        const pendingSize = getPendingNodeSize();
        const nextPosition = getBranchedPosition(targetNode, direction, pendingSize);

        setPendingBranch({ sourceNodeId: id, direction, pendingNodeId, isAutoCreated: true });
        setNodes((nds) => nds.filter(n => !(n.data as ConversationNodeData).isPending).concat({
          id: pendingNodeId,
          type: 'conversation',
          position: nextPosition,
          data: {
            label: 'New Branch',
            messages: [],
            isPending: true,
            onSendMessage: handleSendMessage,
          },
        }));

        setEdges((eds) => eds.filter(e => e.id !== `edge_${pendingNodeId}`).concat({
          id: `edge_${pendingNodeId}`,
          source: id,
          target: pendingNodeId,
          sourceHandle: direction,
          targetHandle: direction === 'right' ? 'target-left' : direction === 'left' ? 'target-right' : direction === 'bottom' ? 'target-top' : 'target-bottom',
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5,5' },
        }));

        setTimeout(() => {
          const center = getNodeCenter(nextPosition, pendingSize);
          setCenter(center.x, center.y, { zoom: 1, duration: 800 });
        }, 100);
      }
    }
  }, [conversationNodes.length, getAnchorNode, globalInput, pendingBranch, setPendingBranch, setNodes, setEdges, handleSendMessage, setCenter]);

  useEffect(() => {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const repositionTargets = nodes
      .filter((node) => node.type === 'conversation')
      .map((node) => {
        const data = node.data as ConversationNodeData;
        if (!data.isProcessing) return null;

        const parentEdge = edges.find((edge) => edge.target === node.id);
        if (!parentEdge) return null;

        const parentNode = nodesById.get(parentEdge.source);
        if (!parentNode) return null;

        const direction = (parentEdge.sourceHandle as BranchDirection | undefined) ?? 'bottom';
        const nextPosition = getBranchedPosition(parentNode, direction, {
          width: node.width || CONVERSATION_NODE_WIDTH,
          height: node.height || CONVERSATION_NODE_HEIGHT,
        });

        if (
          Math.abs(nextPosition.x - node.position.x) < 0.5 &&
          Math.abs(nextPosition.y - node.position.y) < 0.5
        ) {
          return null;
        }

        return { id: node.id, position: nextPosition };
      })
      .filter((item): item is { id: string; position: { x: number; y: number } } => Boolean(item));

    if (repositionTargets.length === 0) return;

    const positionMap = new Map(repositionTargets.map((item) => [item.id, item.position]));
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const nextPosition = positionMap.get(node.id);
        return nextPosition ? { ...node, position: nextPosition } : node;
      })
    );
  }, [nodes, edges, setNodes]);

  // Clear pending branch when input is empty
  useEffect(() => {
    if (globalInput.trim().length === 0 && pendingBranch && pendingBranch.isAutoCreated) {
      setNodes(nds => nds.filter(n => n.id !== pendingBranch.pendingNodeId));
      setEdges(eds => eds.filter(e => e.id !== `edge_${pendingBranch.pendingNodeId}`));
      setPendingBranch(null);
    }
  }, [globalInput, pendingBranch, setNodes, setEdges, setPendingBranch]);

  const onGlobalSubmit = async () => {
    if ((!globalInput.trim() && composerAttachments.length === 0) || isCurrentCanvasProcessing) return;

    if (!canUseCurrentWorkspace) {
      openAccountPanel('login');
      return;
    }

    if (!currentCanvasId) return;
    if (!isProviderConfigured) return;

    const hasUnsupportedAttachments = composerAttachments.some((attachment) =>
      attachment.kind === 'image' ? !supportsImageUpload : !supportsPdfUpload
    );

    if (hasUnsupportedAttachments) {
      setComposerNotice('当前模型不支持你上传的文件类型。请切换到支持图片/PDF 的模型，例如 Gemini 2.5 Flash。');
      return;
    }

    const text = globalInput;
    const activeCanvasId = currentCanvasId;
    setGlobalInput('');
    const attachments = composerAttachments;
    setComposerAttachments([]);
    setComposerNotice(null);

    let targetNodeId = `node_${Date.now()}`;
    let position = { x: 0, y: 0 };
    let parentNodeId: string | null = null;
    let direction: BranchDirection = 'bottom';

    const isBranching = !!pendingBranch;
    if (pendingBranch) {
      const sourceNode = nodes.find(n => n.id === pendingBranch.sourceNodeId);
      if (sourceNode) {
        parentNodeId = sourceNode.id;
        direction = pendingBranch.direction;
        position = getBranchedPosition(sourceNode, direction, getConversationNodeSize(sourceNode));
        
        targetNodeId = pendingBranch.pendingNodeId;
      }
      setPendingBranch(null);
    } else if (nodes.length > 0) {
      const lastNode = getAnchorNode();
      
      if (lastNode && lastNode.type === 'conversation') {
        const data = lastNode.data as ConversationNodeData;
        if (data.isProcessing) {
          setGlobalInput(text);
          setComposerAttachments(attachments);
          return;
        }
      }

      if (lastNode) {
        parentNodeId = lastNode.id;
      
        // Always default to bottom for auto-created branches
        const dir: BranchDirection = 'bottom';
        direction = dir;
        position = getBranchedPosition(lastNode, dir, getConversationNodeSize(lastNode));
      }
    } else {
      position = { x: 0, y: 50 };
    }

    const context = parentNodeId ? getContextMessages(parentNodeId) : [];
    const requestAttachments = attachments;
    const storedAttachments = attachments.map(stripAttachmentPayload);
    const userMessage: Message = { role: 'user', content: text, attachments: storedAttachments };
    const newNodeData = {
      label: '',
      messages: [userMessage],
      isProcessing: true,
      onSendMessage: handleSendMessage,
      isPending: false,
    };

    if (isBranching) {
      updateNodeDataForCanvas(activeCanvasId, targetNodeId, newNodeData);
      setEdges(edges.map(e => {
        if (e.id === `edge_${targetNodeId}`) {
          const { style, ...rest } = e;
          return { ...rest, animated: true };
        }
        return e;
      }));
      setNodes(nds => nds.map(n => ({
        ...n,
        selected: n.id === targetNodeId
      })));
    } else {
      const newNode: any = {
        id: targetNodeId,
        type: 'conversation',
        position,
        data: newNodeData,
        draggable: true,
        selected: true,
      };
      setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNode));

      if (parentNodeId) {
        const newEdge = {
          id: `edge_${parentNodeId}_${targetNodeId}`,
          source: parentNodeId,
          target: targetNodeId,
          sourceHandle: direction,
          targetHandle: direction === 'right' ? 'target-left' : direction === 'left' ? 'target-right' : direction === 'bottom' ? 'target-top' : 'target-bottom',
        };
        setEdges([...edges, newEdge]);
      }
    }

    const requestMessages: AIMessage[] = [
      ...context,
      { role: 'user' as const, content: text, attachments: requestAttachments },
    ].map((message) => ({
      role: message.role,
      content: message.content,
      attachments: message.attachments,
    }));

    await streamResponseToNode({
      canvasId: activeCanvasId,
      nodeId: targetNodeId,
      requestMessages,
      messagesBeforeModel: [userMessage],
      focusPosition: position,
      errorFallback: 'Failed to get response.',
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUseCurrentWorkspace) {
      setComposerNotice('请先登录，再上传文件并开始对话。');
      openAccountPanel('login');
      event.target.value = '';
      return;
    }

    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const supportedFiles = files.filter((file) =>
      file.type === 'application/pdf' || file.type.startsWith('image/')
    );

    const hasUnsupportedByModel = supportedFiles.some((file) =>
      file.type.startsWith('image/') ? !supportsImageUpload : !supportsPdfUpload
    );

    if (hasUnsupportedByModel) {
      setComposerNotice('当前模型暂未启用图片/PDF理解能力。请先切换到 Gemini 2.5 Flash 或 Gemini 2.5 Pro。');
      event.target.value = '';
      return;
    }

    const nextAttachments = await Promise.all(
      supportedFiles.map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        const base64Data = dataUrl.split(',')[1] ?? '';
        return {
          id: `${file.name}_${file.lastModified}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          mimeType: file.type || inferMimeType(file.name),
          kind: file.type.startsWith('image/') ? 'image' : 'document',
          previewUrl: URL.createObjectURL(file),
          dataUrl,
          base64Data,
        } satisfies AttachmentPayload;
      })
    );

    setComposerAttachments((current) => [...current, ...nextAttachments]);
    setComposerNotice(null);
    event.target.value = '';
  };

  const removeAttachment = (attachmentId: string) => {
    setComposerAttachments((current) => {
      const attachment = current.find((item) => item.id === attachmentId);
      if (attachment?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return current.filter((item) => item.id !== attachmentId);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      if (isCurrentCanvasProcessing) {
        // Allow default behavior (newline) when processing
        return;
      }
      e.preventDefault();
      onGlobalSubmit();
    }
  };

  const handleArchiveSelected = () => {
    const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
    if (selectedNodeIds.length > 0) {
      archiveNodes(selectedNodeIds);
    }
  };

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      event.preventDefault();
      
      // If node is not selected, select it (and deselect others unless shift is held)
      if (!node.selected) {
        setNodes((nds) => nds.map((n) => ({
          ...n,
          selected: n.id === node.id,
        })));
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        isFolder: node.type === 'folder',
        isPane: false,
        nodeId: node.id,
      });
    },
    [setNodes]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        isFolder: false,
        isPane: true,
        nodeId: null,
      });
    },
    []
  );

  const handleInsertNode = useCallback(() => {
    if (!contextMenu) return;
    const timestamp = Date.now();
    const startNodeId = `start_manual_${timestamp}`;
    const startPosition = project({ x: contextMenu.x, y: contextMenu.y });
    const startNode = createStandaloneStartNode(startNodeId, startPosition);
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      { ...startNode, selected: true },
    ]);
    setTimeout(() => {
      document.getElementById('global-input')?.focus();
    }, 50);
  }, [contextMenu, project, setNodes]);

  const handleCopyContent = useCallback(() => {
    if (!contextMenu?.nodeId) return;
    const node = nodes.find(n => n.id === contextMenu.nodeId);
    if (!node || node.type !== 'conversation') return;
    
    const data = node.data as ConversationNodeData;
    const markdown = data.messages.map(m => `**${m.role === 'user' ? 'User' : 'Gemini'}:**\n${m.content}`).join('\n\n');
    
    navigator.clipboard.writeText(markdown).then(() => {
      // Optional: show toast
    });
  }, [contextMenu, nodes]);

  const handleReferenceContent = useCallback(() => {
    if (!contextMenu?.nodeId) return;
    const node = nodes.find(n => n.id === contextMenu.nodeId);
    if (!node || node.type !== 'conversation') return;
    
    const data = node.data as ConversationNodeData;
    const lastResponse = data.messages.filter(m => m.role === 'model').pop()?.content || '';
    
    if (lastResponse) {
      setGlobalInput(prev => `${prev}\n> ${lastResponse}\n\n`.trimStart());
    }
  }, [contextMenu, nodes]);

  const handleDeleteSelected = () => {
    const selectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
    if (selectedNodeIds.length === 0) return;
    if (!currentCanvasId) return;

    setUndoSnapshot({
      canvasId: currentCanvasId,
      nodes: nodes.filter((node) => selectedNodeIds.includes(node.id)),
      edges: edges.filter((edge) => selectedNodeIds.includes(edge.source) || selectedNodeIds.includes(edge.target)),
    });
    deleteNodes(selectedNodeIds);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    if (!currentCanvasId) return;

    setUndoSnapshot({
      canvasId: currentCanvasId,
      nodes: nodes.filter((node) => node.id === nodeId),
      edges: edges.filter((edge) => edge.source === nodeId || edge.target === nodeId),
    });
    deleteNode(nodeId);
  }, [currentCanvasId, deleteNode, edges, nodes]);

  useEffect(() => {
    const handleUndoDelete = (event: KeyboardEvent) => {
      const isUndoShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
      if (!isUndoShortcut) return;

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        Boolean(target?.isContentEditable);

      if (isEditableTarget) return;
      if (!undoSnapshot) return;

      event.preventDefault();
      restoreDeletedSnapshot(undoSnapshot);
      setUndoSnapshot(null);
    };

    window.addEventListener('keydown', handleUndoDelete);
    return () => window.removeEventListener('keydown', handleUndoDelete);
  }, [restoreDeletedSnapshot, undoSnapshot]);

  useEffect(() => {
    if (deletedNodesSnapshot) return;
    if (undoSnapshot && undoSnapshot.nodes.length === 0) {
      setUndoSnapshot(null);
    }
  }, [deletedNodesSnapshot, undoSnapshot]);

  const selectedCount = nodes.filter(n => n.selected).length;
  const isCurrentCanvasProcessing = conversationNodes.some((node) =>
    Boolean((node.data as ConversationNodeData).isProcessing)
  );
  const shouldShowReadyScreen =
    conversationNodes.length === 0 &&
    !isCurrentCanvasProcessing;
  const activeComposerNotice =
    requiresLogin && !currentUser
      ? '请先登录，再创建工作区并开始对话。'
      : composerNotice;

  return (
    <div className="relative flex w-full h-screen bg-canvas-bg overflow-hidden font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.96)_0%,_rgba(255,255,255,0)_72%)] opacity-95" />
        <div className="absolute right-[-8%] top-[14%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,_rgba(0,113,227,0.08)_0%,_rgba(0,113,227,0)_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_100%)]" />
      </div>
      <Sidebar
        billingSummary={billingSummary}
        currentUser={currentUser}
        onLogout={() => {
          void logoutAccount();
        }}
        onOpenAccount={() => openAccountPanel('account')}
        onOpenAuth={(mode) => openAccountPanel(mode)}
        onOpenBilling={() => openAccountPanel('billing')}
        onOpenSettings={() => setIsSettingsOpen(true)}
        plans={plans}
      />

      <main className="flex-1 relative flex flex-col min-w-0">
        <div className="flex-1 relative">
          <CanvasViewport
            edges={edges}
            hidden={shouldShowReadyScreen}
            interactionMode={canvasInteractionMode}
            nodeTypes={nodeTypes}
            nodes={nodesWithHandlers}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onNodeContextMenu={onNodeContextMenu}
            onNodesChange={onNodesChange}
            onPaneContextMenu={onPaneContextMenu}
            setInteractionMode={setCanvasInteractionMode}
          />
        </div>

        {undoSnapshot ? (
          <div className="pointer-events-none fixed bottom-7 left-1/2 z-[120] -translate-x-1/2">
            <motion.div
              key={undoSnapshot.nodes.map((node) => node.id).join('_')}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="pointer-events-auto flex items-center gap-3 rounded-[1.1rem] border border-white/90 bg-white/90 px-3.5 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-2xl"
            >
              <div className="text-[12px] text-slate-500">
                {undoSnapshot.nodes.length > 1 ? `${undoSnapshot.nodes.length} nodes deleted` : 'Node deleted'}
              </div>
              <button
                type="button"
                onClick={() => {
                  restoreDeletedSnapshot(undoSnapshot);
                  setUndoSnapshot(null);
                }}
                className="inline-flex items-center gap-2 rounded-[0.9rem] bg-slate-900 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-[#0071e3]"
              >
                <Undo2 className="h-4 w-4" />
                <span>撤回</span>
              </button>
            </motion.div>
          </div>
        ) : null}

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onMerge={selectedCount > 1 ? handleArchiveSelected : undefined}
            onExtract={contextMenu.isFolder && contextMenu.nodeId ? () => unarchiveNode(contextMenu.nodeId!) : undefined}
            onDelete={selectedCount > 0 ? handleDeleteSelected : (contextMenu.nodeId ? () => handleDeleteNode(contextMenu.nodeId!) : undefined)}
            onInsert={handleInsertNode}
            onCenter={() => fitView({ duration: 800 })}
            onCopyContent={handleCopyContent}
            onReferenceContent={handleReferenceContent}
            selectedCount={selectedCount}
            isFolder={contextMenu.isFolder}
            isPane={contextMenu.isPane}
          />
        )}

        <Suspense fallback={null}>
          {isSettingsOpen ? (
            <ModelSettingsPanel
              isOpen={isSettingsOpen}
              selectedProviderId={selectedProviderId}
              selectedModel={selectedModel}
              providerConfigs={providerConfigs}
              onClose={() => setIsSettingsOpen(false)}
              onSelectProvider={setSelectedProvider}
              onSelectModel={setSelectedModel}
              onUpdateProviderConfig={updateProviderConfig}
            />
          ) : null}
        </Suspense>

        <AccountPanel
          allowGuest={allowGuest}
          billingSummary={billingSummary}
          byokEnabled={byokEnabled}
          currentUser={currentUser}
          deploymentMode={deploymentMode}
          isOpen={isAccountPanelOpen}
          onChangePlan={changePlan}
          onClose={() => {
            if (requiresLogin && !currentUser) {
              return;
            }
            setIsAccountPanelOpen(false);
          }}
          onLogin={loginAccount}
          onLogout={logoutAccount}
          onRegister={registerAccount}
          plans={plans}
          requiresLogin={requiresLogin}
          view={currentUser && (accountPanelView === 'login' || accountPanelView === 'register') ? 'account' : accountPanelView}
        />

        <ChatComposer
          attachments={composerAttachments}
          composerNotice={activeComposerNotice}
          isCurrentCanvasProcessing={isCurrentCanvasProcessing}
          isProviderConfigured={isProviderReadyForComposer}
          modelMenuItems={modelMenuItems}
          onChange={setGlobalInput}
          onFileChange={handleFileChange}
          onKeyDown={handleKeyDown}
          onModelSelect={(providerId, modelId) => {
            setSelectedProvider(providerId);
            setSelectedModel(modelId);
          }}
          onRemoveAttachment={removeAttachment}
          onSubmit={onGlobalSubmit}
          onUnsupportedUpload={() => {
            if (!canUseCurrentWorkspace) {
              openAccountPanel('login');
              return;
            }

            setComposerNotice('当前模型不支持上传图片/PDF。请切换到支持视觉的模型，例如 Qwen 3.5 Plus 或 Gemini 2.5 Flash。');
          }}
          pendingBranch={pendingBranch}
          readyMode={shouldShowReadyScreen}
          selectedModel={selectedModel}
          selectedModelOption={selectedModelOption}
          selectedProvider={selectedProvider}
          selectedProviderId={selectedProviderId}
          supportsAnyUpload={supportsAnyUpload}
          placeholderOverride={requiresLogin && !currentUser ? 'Sign in to create a workspace...' : undefined}
          value={globalInput}
        />

        {pendingBranch && (
          <div className="pointer-events-none absolute left-1/2 bottom-4 z-50 w-full max-w-2xl -translate-x-1/2 px-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-auto flex justify-center"
            >
              <button
                onClick={() => {
                  setPendingBranch(null);
                  setNodes((nds) => nds.filter(n => !(n.data as ConversationNodeData).isPending));
                  setEdges((eds) => eds.filter(e => e.id !== `edge_${pendingBranch.pendingNodeId}`));
                }}
                className="px-4 py-2 bg-white/50 backdrop-blur-md rounded-full text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100 shadow-sm"
              >
                Cancel Branching
              </button>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
};

export default function App() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
