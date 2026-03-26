import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Send, Loader2, Sparkles, Lock, ChevronDown, Check, Paperclip, FileText, Image as ImageIcon, X, Plus, Hand, ScanSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import useStore, { Message, FolderNodeData, ConversationNodeData, AttachmentPayload } from './store';
import ConversationNode from './components/ConversationNode';
import FolderNode from './components/FolderNode';
import StartNode from './components/StartNode';
import Sidebar from './components/Sidebar';
import ContextMenu from './components/ContextMenu';
import ModelSettingsPanel from './components/ModelSettingsPanel';
import ProviderMark from './components/ProviderMark';
import { auth, db } from './firebase';
import { streamText, type AIMessage } from './lib/ai';
import { getProviderCatalogEntry, PROVIDER_CATALOG } from './lib/modelCatalog';
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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function inferMimeType(filename: string) {
  if (filename.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (filename.toLowerCase().endsWith('.png')) return 'image/png';
  if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) return 'image/jpeg';
  if (filename.toLowerCase().endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function stripAttachmentPayload(attachment: AttachmentPayload): AttachmentPayload {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType,
    kind: attachment.kind,
    previewUrl: attachment.previewUrl,
  };
}

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
    updateNodeData,
    setNodes,
    setEdges,
    setUser,
    setAuthReady,
    selectedProviderId,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
    providerConfigs,
    updateProviderConfig,
    loadCanvasesFromFirestore,
    archiveNodes,
    unarchiveNode,
    deleteNode
  } = useStore();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; isFolder: boolean; isPane: boolean; nodeId: string | null } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setAuthReady(true);
      
      if (user) {
        // Sync user profile to Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLogin: Date.now()
        }, { merge: true });

        // Load canvases from Firestore
        loadCanvasesFromFirestore();
      }
    });

    return () => unsubscribe();
  }, [setUser, setAuthReady, loadCanvasesFromFirestore]);

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentPayload | null>(null);
  const [canvasInteractionMode, setCanvasInteractionMode] = useState<'drag' | 'select'>('drag');
  const selectedProvider = getProviderCatalogEntry(selectedProviderId);
  const selectedProviderConfig = providerConfigs[selectedProviderId];
  const selectedModelOption = selectedProvider.models.find((model) => model.id === selectedModel) ?? selectedProvider.models[0];
  const selectedModelCapabilities = selectedModelOption?.capabilities ?? {};
  const supportsImageUpload = Boolean(selectedModelCapabilities.image);
  const supportsPdfUpload = Boolean(selectedModelCapabilities.pdf);
  const supportsAnyUpload = supportsImageUpload || supportsPdfUpload;
  const modelMenuItems = PROVIDER_CATALOG.flatMap((provider) =>
    provider.models.map((model) => {
      const config = providerConfigs[provider.id];
      const isConfigured = provider.protocol === 'gemini'
        ? Boolean(config.apiKey.trim())
        : Boolean(config.apiKey.trim() && config.baseUrl.trim());

      return { provider, model, isConfigured };
    })
  );
  const isProviderConfigured = selectedProvider.protocol === 'gemini'
    ? Boolean(selectedProviderConfig.apiKey.trim())
    : Boolean(selectedProviderConfig.apiKey.trim() && selectedProviderConfig.baseUrl.trim());

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!composerMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Ensure at least one canvas exists
  useEffect(() => {
    if (canvases.length === 0) {
      addCanvas();
    } else if (!currentCanvasId) {
      setCurrentCanvas(canvases[0].id);
    }
  }, [canvases.length, currentCanvasId, addCanvas, setCurrentCanvas]);

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

  const handleSendMessage = useCallback(async (nodeId: string, text: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type !== 'conversation') return;

    const data = node.data as ConversationNodeData;
    const userMessage: Message = { role: 'user', content: text };
    const updatedMessages = [...data.messages, userMessage];

    updateNodeData(nodeId, {
      messages: updatedMessages,
      isProcessing: true,
    });

    try {
      let fullText = '';
      let fullReasoningText = '';

      for await (const chunk of streamText({
        protocol: selectedProvider.protocol,
        model: selectedModel,
        apiKey: selectedProviderConfig.apiKey.trim(),
        baseUrl: selectedProviderConfig.baseUrl.trim(),
        systemInstruction: 'You are a helpful assistant. Keep responses concise but informative.',
        messages: updatedMessages.map((message) => ({
          role: message.role,
          content: message.content,
          attachments: message.attachments,
        })),
      })) {
        if (chunk.type === 'reasoning') {
          fullReasoningText += chunk.text;
        } else {
          fullText += chunk.text;
        }

        updateNodeData(nodeId, {
          messages: [...updatedMessages, { role: 'model', content: fullText, reasoningContent: fullReasoningText || undefined }],
          isProcessing: true,
        });
      }
      
      updateNodeData(nodeId, {
        messages: [...updatedMessages, { role: 'model', content: fullText || 'No response', reasoningContent: fullReasoningText || undefined }],
        isProcessing: false,
      });
    } catch (error) {
      console.error('Gemini Error:', error);
      updateNodeData(nodeId, {
        messages: [...updatedMessages, { role: 'model', content: `Error: ${error instanceof Error ? error.message : 'Failed to get response from provider.'}` }],
        isProcessing: false,
      });
    }
  }, [selectedModel, selectedProvider.protocol, selectedProviderConfig.apiKey, selectedProviderConfig.baseUrl, updateNodeData, nodes]);

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
    if (globalInput.trim().length > 0 && !pendingBranch && nodes.length > 0) {
      const targetNode =
        nodes.find((node) => node.selected && (node.type === 'conversation' || node.type === 'start')) ||
        [...nodes].reverse().find((node) => node.type === 'conversation') ||
        rootStartNode;

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
  }, [globalInput, pendingBranch, nodes, rootStartNode, setPendingBranch, setNodes, setEdges, handleSendMessage, setCenter]);

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
    if ((!globalInput.trim() && composerAttachments.length === 0) || isProcessing || !isProviderConfigured) return;

    const hasUnsupportedAttachments = composerAttachments.some((attachment) =>
      attachment.kind === 'image' ? !supportsImageUpload : !supportsPdfUpload
    );

    if (hasUnsupportedAttachments) {
      setComposerNotice('当前模型不支持你上传的文件类型。请切换到支持图片/PDF 的模型，例如 Gemini 2.5 Flash。');
      return;
    }

    const text = globalInput;
    setGlobalInput('');
    setIsProcessing(true);
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
      const lastNode =
        nodes.find((node) => node.selected && (node.type === 'conversation' || node.type === 'start')) ||
        [...nodes].reverse().find((node) => node.type === 'conversation') ||
        rootStartNode;
      
      if (lastNode && lastNode.type === 'conversation') {
        const data = lastNode.data as ConversationNodeData;
        if (data.isProcessing) {
          // Revert processing state since we are blocking submission
          setIsProcessing(false);
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
      updateNodeData(targetNodeId, newNodeData);
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

    try {
      let fullText = '';
      let fullReasoningText = '';
      const requestMessages: AIMessage[] = [
        ...context,
        { role: 'user', content: text, attachments: requestAttachments },
      ];
      
      // Initialize the model message so it shows up immediately
      updateNodeData(targetNodeId, {
        messages: [userMessage, { role: 'model', content: '' }],
        isProcessing: true,
      });

      setTimeout(() => {
        const center = getNodeCenter(position, getConversationNodeSize());
        setCenter(center.x, center.y, { zoom: 1, duration: 800 });
      }, 100);

      for await (const chunk of streamText({
        protocol: selectedProvider.protocol,
        model: selectedModel,
        apiKey: selectedProviderConfig.apiKey.trim(),
        baseUrl: selectedProviderConfig.baseUrl.trim(),
        messages: requestMessages.map((message): AIMessage => ({
          role: message.role,
          content: message.content,
          attachments: message.attachments,
        })),
      })) {
        if (chunk.type === 'reasoning') {
          fullReasoningText += chunk.text;
        } else {
          fullText += chunk.text;
        }

        updateNodeData(targetNodeId, {
          messages: [userMessage, { role: 'model', content: fullText, reasoningContent: fullReasoningText || undefined }],
          isProcessing: true,
        });
      }

      updateNodeData(targetNodeId, {
        messages: [userMessage, { role: 'model', content: fullText || 'No response', reasoningContent: fullReasoningText || undefined }],
        isProcessing: false,
      });

    } catch (error) {
      console.error('Gemini Error:', error);
      updateNodeData(targetNodeId, {
        messages: [userMessage, { role: 'model', content: `Error: ${error instanceof Error ? error.message : 'Failed to get response.'}` }],
        isProcessing: false,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      if (isProcessing) {
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
    selectedNodeIds.forEach(id => deleteNode(id));
  };

  const selectedCount = nodes.filter(n => n.selected).length;
  const isSelectionMode = canvasInteractionMode === 'select';

  const getMiniMapNodeColor = useCallback((node: { type?: string }) => {
    if (node.type === 'start') return '#0f172a';
    if (node.type === 'folder') return '#94a3b8';
    return '#0071e3';
  }, []);

  return (
    <div className="relative flex w-full h-screen bg-canvas-bg overflow-hidden font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-8%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.96)_0%,_rgba(255,255,255,0)_72%)] opacity-95" />
        <div className="absolute right-[-8%] top-[14%] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,_rgba(0,113,227,0.08)_0%,_rgba(0,113,227,0)_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_100%)]" />
      </div>
      <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 relative flex flex-col min-w-0">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodesWithHandlers}
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
            nodesDraggable={true}
            selectionMode={SelectionMode.Partial}
            className="bg-canvas-bg"
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls 
              position="bottom-left" 
              showFitView={true}
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
                onClick={() => setCanvasInteractionMode('drag')}
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
                onClick={() => setCanvasInteractionMode('select')}
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

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            onMerge={selectedCount > 1 ? handleArchiveSelected : undefined}
            onExtract={contextMenu.isFolder && contextMenu.nodeId ? () => unarchiveNode(contextMenu.nodeId!) : undefined}
            onDelete={selectedCount > 0 ? handleDeleteSelected : (contextMenu.nodeId ? () => deleteNode(contextMenu.nodeId!) : undefined)}
            onInsert={handleInsertNode}
            onCenter={() => fitView({ duration: 800 })}
            onCopyContent={handleCopyContent}
            onReferenceContent={handleReferenceContent}
            selectedCount={selectedCount}
            isFolder={contextMenu.isFolder}
            isPane={contextMenu.isPane}
          />
        )}

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

        <AnimatePresence>
          {previewAttachment && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setPreviewAttachment(null)}
                className="absolute inset-0 bg-slate-950/26 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="relative w-full max-w-5xl rounded-[1.6rem] border border-white/90 bg-white/82 p-4 shadow-[0_24px_80px_rgba(36,39,46,0.16)] backdrop-blur-2xl"
              >
                <div className="mb-4 flex items-center justify-between gap-4 rounded-[1.1rem] bg-black/[0.03] px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{previewAttachment.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{previewAttachment.mimeType}</div>
                  </div>
                  <button
                    onClick={() => setPreviewAttachment(null)}
                    className="rounded-full p-2 text-slate-400 hover:bg-black/[0.05] hover:text-slate-600"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-hidden rounded-[1.2rem] bg-[#f4f5f7]">
                  {previewAttachment.kind === 'image' && (previewAttachment.dataUrl || previewAttachment.previewUrl) ? (
                    <img
                      src={previewAttachment.dataUrl || previewAttachment.previewUrl}
                      alt={previewAttachment.name}
                      className="max-h-[76vh] w-full object-contain"
                    />
                  ) : previewAttachment.mimeType === 'application/pdf' && (previewAttachment.dataUrl || previewAttachment.previewUrl) ? (
                    <iframe
                      src={previewAttachment.dataUrl || previewAttachment.previewUrl}
                      title={previewAttachment.name}
                      className="h-[76vh] w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-[40vh] items-center justify-center text-sm text-slate-500">
                      当前文件暂不支持预览
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        <AnimatePresence>
          {conversationNodes.length === 0 && !pendingBranch && !rootStartNode && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="flex flex-col items-center gap-8 max-w-md text-center px-8">
                <motion.div 
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center border border-slate-50"
                >
                  <Sparkles className="w-10 h-10 text-emerald-500" />
                </motion.div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Design your conversation</h3>
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">
                    Start a new flow by typing below, or use the branching tools to explore different paths.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    const id = 'root';
                    const pendingNodeId = `pending_${id}_${Date.now()}`;
                    const rootPosition = { x: 0, y: 0 };
                    const pendingPosition = getBranchedPosition(
                      { position: rootPosition },
                      'bottom',
                      getPendingNodeSize()
                    );
                    setNodes([
                      {
                        id,
                        type: 'conversation',
                        position: rootPosition,
                        data: { label: '', messages: [], onSendMessage: handleSendMessage, isPending: false },
                        draggable: true,
                        selected: true,
                      },
                      {
                        id: pendingNodeId,
                        type: 'conversation',
                        position: pendingPosition,
                        data: { label: '', messages: [], onSendMessage: handleSendMessage, isPending: true }
                      }
                    ]);
                    setEdges([{
                      id: `edge_${pendingNodeId}`,
                      source: id,
                      target: pendingNodeId,
                      sourceHandle: 'bottom',
                      targetHandle: 'target-top',
                      animated: true,
                      style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5,5' },
                    }]);
                    setPendingBranch({ sourceNodeId: id, direction: 'bottom', pendingNodeId });
                  }}
                  className="pointer-events-auto px-11 py-5 bg-slate-900 text-white rounded-[1.5rem] font-semibold text-[11px] uppercase tracking-[0.24em] hover:bg-[#0071e3] transition-all shadow-[0_16px_40px_rgba(36,39,46,0.16)] hover:scale-[1.01] active:scale-95"
                >
                  Initialize Flow
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Bottom Input */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl px-8 z-50">
          <div ref={composerMenuRef} className="relative">
            <AnimatePresence>
              {isModelMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  className="absolute left-0 bottom-[calc(100%+16px)] w-[380px] rounded-[1.35rem] border border-white/90 bg-white/74 p-3 shadow-[0_18px_48px_rgba(36,39,46,0.10)] backdrop-blur-2xl"
                >
                  <div className="px-3 pb-3 text-[13px] font-medium text-slate-400">选择模型</div>
                  <div className="space-y-1">
                    {modelMenuItems.map(({ provider, model, isConfigured }) => (
                      <button
                        key={`${provider.id}_${model.id}`}
                        onClick={() => {
                          if (!isConfigured) return;
                          setSelectedProvider(provider.id);
                          setSelectedModel(model.id);
                          setIsModelMenuOpen(false);
                        }}
                        disabled={!isConfigured}
                        className={`flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left transition ${
                          isConfigured
                            ? 'text-slate-800 hover:bg-black/[0.035]'
                            : 'cursor-not-allowed text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ProviderMark providerId={provider.id} size="md" muted={!isConfigured} />
                          <div className="min-w-0">
                            <div className={`text-[15px] font-medium ${isConfigured ? 'text-slate-900' : 'text-slate-400'}`}>
                              {model.label}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              {provider.label} · {model.description}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isConfigured && <Lock className="w-4 h-4 text-slate-300" />}
                          {selectedProviderId === provider.id && selectedModel === model.id && (
                            <Check className="w-5 h-5 text-slate-900" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  {!modelMenuItems.some((item) => item.isConfigured) && (
                    <div className="px-3 pt-4 text-xs text-slate-400">
                      先去侧边栏头像菜单里的 Settings 配置 API Key。
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div 
              layout
              className="bg-white/48 backdrop-blur-[36px] border border-white/92 shadow-[0_12px_34px_rgba(36,39,46,0.07)] rounded-[2rem] px-8 pt-7 pb-5 transition-all hover:bg-white/54"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              {composerAttachments.length > 0 && (
                <div className="mb-5 flex items-start gap-3 overflow-x-auto pb-1">
                  {composerAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="group relative h-[92px] w-[92px] flex-shrink-0 overflow-hidden rounded-[1rem] border border-black/[0.06] bg-white shadow-[0_8px_22px_rgba(36,39,46,0.06)]"
                    >
                      <button
                        onClick={() => setPreviewAttachment(attachment)}
                        className="absolute inset-0"
                        type="button"
                        aria-label={`预览 ${attachment.name}`}
                      />
                      {attachment.kind === 'image' && attachment.dataUrl ? (
                        <img
                          src={attachment.dataUrl}
                          alt={attachment.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,#ffffff_0%,#f4f5f8_100%)] px-3 text-center">
                          <FileText className="w-6 h-6 text-[#0071e3]" />
                          <span className="line-clamp-2 text-[10px] font-medium leading-tight text-slate-500">
                            {attachment.name}
                          </span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 py-2">
                        <div className="truncate text-[10px] font-medium text-white">
                          {attachment.name}
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          removeAttachment(attachment.id);
                        }}
                        className="absolute right-2 top-2 rounded-full bg-black/42 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/58"
                        type="button"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => {
                      if (!supportsAnyUpload) {
                        setComposerNotice('当前模型不支持上传图片/PDF。请切换到支持视觉的模型，例如 Qwen 3.5 Plus 或 Gemini 2.5 Flash。');
                        setIsModelMenuOpen(true);
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    className="flex h-[92px] w-[92px] flex-shrink-0 items-center justify-center rounded-[1rem] bg-black/[0.04] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-black/[0.06] hover:text-slate-700"
                    type="button"
                  >
                    <Plus className="w-7 h-7" />
                  </button>
                </div>
              )}
              <textarea
                id="global-input"
                value={globalInput}
                onChange={(e) => setGlobalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !isProviderConfigured
                    ? '请先在 Settings 中配置可用模型...'
                    : pendingBranch
                      ? 'Ask the selected model to continue this branch...'
                      : 'Start a new conversation flow...'
                }
                className="w-full bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-800 placeholder-slate-300 resize-none min-h-[84px] max-h-[220px] text-[20px] leading-relaxed tracking-[-0.024em]"
                rows={1}
              />
              {composerNotice && (
                <div className="mt-3 rounded-[1rem] bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {composerNotice}
                </div>
              )}
              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (!supportsAnyUpload) {
                        setComposerNotice('当前模型不支持上传图片/PDF。请切换到支持视觉的模型，例如 Qwen 3.5 Plus 或 Gemini 2.5 Flash。');
                        setIsModelMenuOpen(true);
                        return;
                      }
                      fileInputRef.current?.click();
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-black/[0.032] px-5 py-3 text-[15px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] transition hover:bg-black/[0.05]"
                    type="button"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span>上传文件</span>
                  </button>
                  <button
                    onClick={() => setIsModelMenuOpen((value) => !value)}
                    className="inline-flex items-center gap-3 rounded-full bg-black/[0.032] px-4 py-3 text-[15px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] transition hover:bg-black/[0.05]"
                  >
                    <ProviderMark providerId={selectedProvider.id} size="sm" />
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[14px] font-semibold text-slate-800">{selectedModelOption?.label ?? '选择模型'}</span>
                      <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">{selectedProvider.label}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={onGlobalSubmit}
                    disabled={(!globalInput.trim() && composerAttachments.length === 0) || isProcessing || !isProviderConfigured}
                    className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-[0_10px_22px_rgba(36,39,46,0.18)] hover:bg-[#0071e3] disabled:opacity-25 disabled:scale-95 transition-all active:scale-90 flex items-center justify-center flex-shrink-0"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
          {pendingBranch && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex justify-center"
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
          )}
        </div>
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
