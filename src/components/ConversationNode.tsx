import React, { useEffect, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import ReactMarkdown from 'react-markdown';
import { Loader2, Bot, User, Plus, FileText, ChevronDown, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import useStore, { AttachmentPayload, ConversationNodeData } from '../store';
import { getBranchedPosition, getNodeCenter, getPendingNodeSize } from '../lib/nodeLayout';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const ConversationNode = ({ id, data, selected }: NodeProps<ConversationNodeData>) => {
  const { setCenter } = useReactFlow();
  const setNodes = useStore((state) => state.setNodes);
  const setEdges = useStore((state) => state.setEdges);
  const currentCanvasId = useStore((state) => state.currentCanvasId);
  const canvases = useStore((state) => state.canvases);
  const currentNodes = canvases.find(c => c.id === currentCanvasId)?.nodes || [];
  
  const setPendingBranch = useStore((state) => state.setPendingBranch);
  const pendingBranch = useStore((state) => state.pendingBranch);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentPayload | null>(null);
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);

  useEffect(() => {
    hljs.highlightAll();
  }, [data.messages]);

  useEffect(() => {
    setIsReasoningOpen(false);
  }, [id]);

  const onBranchClick = (direction: 'top' | 'bottom' | 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (pendingBranch?.sourceNodeId === id && pendingBranch?.direction === direction) {
      setPendingBranch(null);
      setNodes((nds) => nds.filter(n => !(n.data as ConversationNodeData).isPending));
      setEdges((eds) => eds.filter(e => e.id !== `edge_${pendingBranch.pendingNodeId}`));
      return;
    }

    const pendingNodeId = `pending_${id}_${Date.now()}`;
    setPendingBranch({ sourceNodeId: id, direction, pendingNodeId, isAutoCreated: false });

    // Focus the global input textarea when manually creating a branch
    setTimeout(() => {
      document.getElementById('global-input')?.focus();
    }, 50);

    const currentNode = currentNodes.find(n => n.id === id);
    if (!currentNode) return;

    const pendingSize = getPendingNodeSize();
    const nextPosition = getBranchedPosition(currentNode, direction, pendingSize);
    
    setNodes((nds) => nds.filter(n => !(n.data as ConversationNodeData).isPending).concat({
      id: pendingNodeId,
      type: 'conversation',
      position: nextPosition,
      data: {
        label: 'New Branch',
        messages: [],
        isPending: true,
        onSendMessage: data.onSendMessage,
      },
    }));

    setEdges((eds) => {
      const filtered = pendingBranch ? eds.filter(e => e.id !== `edge_${pendingBranch.pendingNodeId}`) : eds;
      return filtered.concat({
        id: `edge_${pendingNodeId}`,
        source: id,
        target: pendingNodeId,
        sourceHandle: direction,
        targetHandle: direction === 'right' ? 'target-left' : direction === 'left' ? 'target-right' : direction === 'bottom' ? 'target-top' : 'target-bottom',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5,5' },
      });
    });

    setTimeout(() => {
      const center = getNodeCenter(nextPosition, pendingSize);
      setCenter(center.x, center.y, { zoom: 1, duration: 800 });
    }, 100);
  };

  const isSourceOfPending = pendingBranch?.sourceNodeId === id;
  const userMsg = data.messages.find(m => m.role === 'user');
  const modelMsg = data.messages.find(m => m.role === 'model');
  const hasReasoning = Boolean(modelMsg?.reasoningContent?.trim());
  const hasModelAnswer = Boolean(modelMsg?.content?.trim());
  const previewModal = previewAttachment ? (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            event.stopPropagation();
            setPreviewAttachment(null);
          }}
          className="nodrag nopan absolute inset-0 bg-slate-950/38 backdrop-blur-xl"
        />
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          onClick={(event) => event.stopPropagation()}
          className="nodrag nopan relative flex h-[min(92vh,980px)] w-[min(94vw,1500px)] flex-col overflow-hidden rounded-[1.8rem] border border-white/80 bg-white/88 shadow-[0_30px_120px_rgba(15,23,42,0.32)] backdrop-blur-3xl"
        >
          <div className="flex items-center justify-between gap-4 border-b border-black/[0.05] bg-white/72 px-5 py-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-800">{previewAttachment.name}</div>
              <div className="mt-1 text-xs text-slate-400">{previewAttachment.mimeType}</div>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setPreviewAttachment(null);
              }}
              className="nodrag nopan rounded-full p-2 text-slate-400 hover:bg-black/[0.05] hover:text-slate-600"
              type="button"
            >
              <Plus className="w-4 h-4 rotate-45" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.9)_0%,rgba(241,245,249,0.96)_62%,rgba(226,232,240,0.92)_100%)]">
            {previewAttachment.kind === 'image' && (previewAttachment.previewUrl || previewAttachment.dataUrl) ? (
              <div className="flex h-full w-full items-center justify-center p-6">
                <img
                  src={previewAttachment.previewUrl || previewAttachment.dataUrl}
                  alt={previewAttachment.name}
                  className="max-h-full max-w-full rounded-[1.2rem] object-contain shadow-[0_18px_60px_rgba(15,23,42,0.18)]"
                />
              </div>
            ) : previewAttachment.mimeType === 'application/pdf' && (previewAttachment.previewUrl || previewAttachment.dataUrl) ? (
              <iframe
                src={previewAttachment.previewUrl || previewAttachment.dataUrl}
                title={previewAttachment.name}
                className="h-full w-full bg-white"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                当前文件暂不支持预览
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  ) : null;

  if (data.isPending) {
    const isTyping = data.globalInput && data.globalInput.trim().length > 0;
    
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-white/54 backdrop-blur-2xl rounded-[1.7rem] border border-dashed ${isTyping ? 'border-[#0071e3]/34 shadow-slate-200/30' : 'border-slate-300/70 shadow-slate-200/30'} w-[470px] h-[250px] flex items-center justify-center shadow-[0_10px_30px_rgba(36,39,46,0.07)] transition-all duration-300`}
      >
        <div className="flex flex-col items-center gap-4 text-[#0071e3]">
          <div className={`w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center ${isTyping ? 'animate-pulse' : 'animate-bounce'}`}>
            {isTyping ? (
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <Plus className="w-6 h-6" />
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.2em]">{isTyping ? 'Typing...' : 'New Branch'}</span>
            <span className="text-[10px] opacity-60 max-w-[200px] truncate">
              {isTyping ? data.globalInput : 'Waiting for your message...'}
            </span>
          </div>
        </div>
        <Handle type="target" position={Position.Top} className="opacity-0" />
        <Handle type="target" position={Position.Bottom} className="opacity-0" />
        <Handle type="target" position={Position.Left} className="opacity-0" />
        <Handle type="target" position={Position.Right} className="opacity-0" />
      </motion.div>
    );
  }

  return (
    <>
      {typeof document !== 'undefined' && previewModal ? createPortal(previewModal, document.body) : null}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group relative rounded-[1.6rem] border transition-all duration-300 w-[540px] overflow-hidden flex flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(248,249,252,0.76)_100%)] shadow-[0_10px_30px_rgba(36,39,46,0.07)] ${
          selected ? 'border-[#0071e3]/40 shadow-[#0071e3]/[0.04]' : 'border-white/85'
        } ${isSourceOfPending ? 'border-[#0071e3]/30' : ''}`}
      >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(255,255,255,0)_100%)]" />

      {/* Handles */}
      <Handle type="target" position={Position.Top} id="target-top" className="!bg-slate-200 !border-white z-10" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="opacity-0 z-0" />
      <Handle type="target" position={Position.Left} id="target-left" className="opacity-0 z-0" />
      <Handle type="target" position={Position.Right} id="target-right" className="opacity-0 z-0" />

      <Handle type="source" position={Position.Top} id="top" className="opacity-0 z-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-emerald-500 !border-white z-10" />
      <Handle type="source" position={Position.Left} id="left" className="!bg-slate-200 !border-white z-10" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-slate-200 !border-white z-10" />

      {/* Branching Buttons */}
      <AnimatePresence>
        {['top', 'bottom', 'left', 'right'].map((dir) => (
          <button 
            key={dir}
            onClick={(e) => onBranchClick(dir as any, e)}
            className={`absolute w-7 h-7 rounded-full border-2 border-white shadow-md flex items-center justify-center transition-all z-50 hover:scale-110 active:scale-95 ${
              pendingBranch?.direction === dir && isSourceOfPending 
                ? 'bg-[#0071e3]' 
                : 'bg-white/90 hover:bg-[#0071e3]'
            } ${
              dir === 'top' ? '-top-3.5 left-1/2 -translate-x-1/2' :
              dir === 'bottom' ? '-bottom-3.5 left-1/2 -translate-x-1/2' :
              dir === 'left' ? 'top-1/2 -left-3.5 -translate-y-1/2' :
              'top-1/2 -right-3.5 -translate-y-1/2'
            }`}
          >
            <Plus className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${
              pendingBranch?.direction === dir && isSourceOfPending ? 'rotate-45' : ''
            }`} />
          </button>
        ))}
      </AnimatePresence>

      <div className="px-7 py-6 space-y-7">
        {/* User Query */}
        {userMsg && (
          <div className="rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,247,250,0.94)_100%)] p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">User</span>
                <span className="text-[11px] text-slate-400">Question</span>
              </div>
            </div>
            {userMsg.attachments && userMsg.attachments.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-3">
                {userMsg.attachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewAttachment(attachment);
                    }}
                    className="nodrag nopan group relative h-[86px] w-[86px] overflow-hidden rounded-[1rem] border border-black/[0.06] bg-white shadow-[0_8px_18px_rgba(36,39,46,0.06)]"
                    type="button"
                  >
                    {attachment.kind === 'image' && (attachment.previewUrl || attachment.dataUrl) ? (
                      <img
                        src={attachment.previewUrl || attachment.dataUrl}
                        alt={attachment.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(180deg,#ffffff_0%,#f4f5f8_100%)] px-3 text-center">
                        <FileText className="w-5 h-5 text-[#0071e3]" />
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
                  </button>
                ))}
              </div>
            )}
            <div className="text-[17px] font-medium leading-relaxed text-slate-800">
              {userMsg.content}
            </div>
          </div>
        )}

        {/* Model Response */}
        <div className="rounded-[1.35rem] border border-[#0071e3]/12 bg-[linear-gradient(180deg,rgba(0,113,227,0.055)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_10px_28px_rgba(0,113,227,0.05)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#0071e3] text-white shadow-sm shadow-[#0071e3]/20">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0071e3]">Model</span>
              <span className="text-[11px] text-slate-400">Answer</span>
            </div>
          </div>
          {hasReasoning && (
            <div className="mb-4">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsReasoningOpen((current) => !current);
                }}
                className="nodrag nopan flex w-full items-center justify-between rounded-[1rem] border border-slate-200/80 bg-white/82 px-3.5 py-3 text-left transition-colors hover:border-[#0071e3]/20 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                    <BrainCircuit className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-700">Deep Thinking</div>
                    <div className="text-[11px] text-slate-400">
                      {data.isProcessing ? 'Streaming reasoning' : 'Hidden by default'}
                    </div>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isReasoningOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isReasoningOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -4 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-[1rem] border border-slate-200/80 bg-slate-50/88 p-4">
                      <div className="markdown-content text-[14px] leading-7 text-slate-600 selection:bg-slate-200/70">
                        <ReactMarkdown>{modelMsg?.reasoningContent ?? ''}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <div className="relative">
            {modelMsg ? (
              <div className="markdown-content text-slate-700 selection:bg-teal-100">
                {hasModelAnswer ? (
                  <ReactMarkdown>{modelMsg.content}</ReactMarkdown>
                ) : data.isProcessing ? (
                  <div className="rounded-[1rem] border border-[#0071e3]/10 bg-white/72 px-4 py-3 text-sm text-slate-500">
                    Preparing final answer...
                  </div>
                ) : null}
                {data.isProcessing && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0071e3]/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Streaming
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 py-1">
                <div className="h-3 w-full animate-pulse rounded-full bg-[#0071e3]/10" />
                <div className="h-3 w-5/6 animate-pulse rounded-full bg-[#0071e3]/10" />
                <div className="h-3 w-4/6 animate-pulse rounded-full bg-[#0071e3]/10" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Decoration */}
      <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-[#0071e3]/12 to-transparent" />
      </motion.div>
    </>
  );
};

export default ConversationNode;
