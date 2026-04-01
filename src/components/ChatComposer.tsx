import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  Send,
  X,
} from 'lucide-react';
import ProviderMark from './ProviderMark';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import type { AttachmentPayload, PendingBranch } from '../types/canvas';
import type {
  ModelOption,
  ProviderCatalogEntry,
  ProviderCatalogId,
} from '../lib/modelCatalog';

interface ModelMenuItem {
  provider: ProviderCatalogEntry;
  model: ModelOption;
  isConfigured: boolean;
}

interface ChatComposerProps {
  attachments: AttachmentPayload[];
  composerNotice: string | null;
  isCurrentCanvasProcessing: boolean;
  isProviderConfigured: boolean;
  modelMenuItems: ModelMenuItem[];
  onChange: (value: string) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onModelSelect: (providerId: ProviderCatalogId, modelId: string) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSubmit: () => void;
  onUnsupportedUpload: () => void;
  pendingBranch: PendingBranch | null;
  readyMode: boolean;
  selectedModel: string;
  selectedModelOption: ModelOption | undefined;
  selectedProvider: ProviderCatalogEntry;
  selectedProviderId: ProviderCatalogId;
  supportsAnyUpload: boolean;
  value: string;
}

const READY_COMPOSER_MAX_HEIGHT = 152;
const CANVAS_COMPOSER_MAX_HEIGHT = 168;
const EXPANDED_COMPOSER_MAX_HEIGHT = 520;

function syncTextareaHeight(textarea: HTMLTextAreaElement | null, maxHeight: number) {
  if (!textarea) return;

  textarea.style.height = '0px';
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${Math.max(nextHeight, 40)}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
}

export default function ChatComposer({
  attachments,
  composerNotice,
  isCurrentCanvasProcessing,
  isProviderConfigured,
  modelMenuItems,
  onChange,
  onFileChange,
  onKeyDown,
  onModelSelect,
  onRemoveAttachment,
  onSubmit,
  onUnsupportedUpload,
  pendingBranch,
  readyMode,
  selectedModel,
  selectedModelOption,
  selectedProvider,
  selectedProviderId,
  supportsAnyUpload,
  value,
}: ChatComposerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentPayload | null>(null);
  const composerMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compactTextareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!composerMenuRef.current?.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    syncTextareaHeight(
      compactTextareaRef.current,
      readyMode ? READY_COMPOSER_MAX_HEIGHT : CANVAS_COMPOSER_MAX_HEIGHT
    );
  }, [readyMode, value]);

  useEffect(() => {
    syncTextareaHeight(expandedTextareaRef.current, EXPANDED_COMPOSER_MAX_HEIGHT);
  }, [isExpanded, value]);

  useEffect(() => {
    if (!isExpanded) return;
    expandedTextareaRef.current?.focus();
  }, [isExpanded]);

  const triggerFilePicker = () => {
    if (!supportsAnyUpload) {
      onUnsupportedUpload();
      setIsModelMenuOpen(true);
      return;
    }

    fileInputRef.current?.click();
  };

  const placeholder = !isProviderConfigured
    ? '请先在 Settings 中配置可用模型...'
    : pendingBranch
      ? 'Ask the selected model to continue this branch...'
      : readyMode
        ? 'Ask anything'
        : 'Start a new conversation flow...';

  const canSubmit = (value.trim().length > 0 || attachments.length > 0) && !isCurrentCanvasProcessing && isProviderConfigured;

  const renderModelMenu = (mode: 'compact' | 'expanded') => (
    <AnimatePresence>
      {isModelMenuOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className={`absolute z-20 w-[380px] rounded-[1.35rem] border border-[#e6e8ee] bg-[#fcfcfd] p-3 shadow-[0_18px_48px_rgba(36,39,46,0.10)] ${
            mode === 'expanded'
              ? 'left-0 top-[calc(100%+14px)]'
              : readyMode
                ? 'left-1/2 top-[calc(100%+16px)] -translate-x-1/2'
                : 'left-0 bottom-[calc(100%+16px)]'
          }`}
        >
          <div className="px-3 pb-3 text-[13px] font-medium text-slate-400">选择模型</div>
          <div className="max-h-[min(46vh,420px)] space-y-1 overflow-y-auto pr-1">
            {modelMenuItems.map(({ provider, model, isConfigured }) => (
              <button
                key={`${provider.id}_${model.id}`}
                onClick={() => {
                  if (!isConfigured) return;
                  onModelSelect(provider.id, model.id);
                  setIsModelMenuOpen(false);
                }}
                disabled={!isConfigured}
                className={`flex w-full items-center justify-between rounded-[1rem] px-3 py-3 text-left transition ${
                  isConfigured
                    ? 'text-slate-800 hover:bg-black/[0.035]'
                    : 'cursor-not-allowed text-slate-400'
                }`}
                type="button"
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
                  {!isConfigured ? <Lock className="h-4 w-4 text-slate-300" /> : null}
                  {selectedProviderId === provider.id && selectedModel === model.id ? (
                    <Check className="h-5 w-5 text-slate-900" />
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          {!modelMenuItems.some((item) => item.isConfigured) ? (
            <div className="px-3 pt-4 text-xs text-slate-400">
              先去侧边栏头像菜单里的 Settings 配置 API Key。
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  const renderAttachments = (size: 'compact' | 'expanded') => {
    if (attachments.length === 0) {
      return null;
    }

    const isExpandedMode = size === 'expanded';
    const cardSize = isExpandedMode ? 'h-[88px] w-[88px]' : 'h-[64px] w-[64px]';
    const iconSize = isExpandedMode ? 'w-6 h-6' : 'w-4 h-4';
    const nameSize = isExpandedMode ? 'text-[10px]' : 'text-[8px]';

    return (
      <div className={`flex items-start overflow-x-auto pb-1 ${isExpandedMode ? 'mb-5 gap-3' : 'mb-3 gap-2.5'}`}>
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className={`group relative ${cardSize} flex-shrink-0 overflow-hidden rounded-[1rem] border border-black/[0.06] bg-white shadow-[0_8px_22px_rgba(36,39,46,0.06)]`}
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
                <FileText className={`${iconSize} text-[#0071e3]`} />
                <span className={`line-clamp-2 font-medium leading-tight text-slate-500 ${nameSize}`}>
                  {attachment.name}
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 py-2">
              <div className={`truncate font-medium text-white ${isExpandedMode ? 'text-[10px]' : 'text-[8px]'}`}>
                {attachment.name}
              </div>
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onRemoveAttachment(attachment.id);
              }}
              className={`absolute rounded-full bg-black/42 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/58 ${
                isExpandedMode ? 'right-2 top-2' : 'right-1.5 top-1.5'
              }`}
              type="button"
            >
              <X className={`${isExpandedMode ? 'h-3.5 w-3.5' : 'h-3 w-3'}`} />
            </button>
          </div>
        ))}

        <button
          onClick={triggerFilePicker}
          className={`${cardSize} flex flex-shrink-0 items-center justify-center rounded-[1rem] bg-black/[0.04] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-black/[0.06] hover:text-slate-700`}
          type="button"
        >
          <Plus className={`${isExpandedMode ? 'h-6 w-6' : 'h-5 w-5'}`} />
        </button>
      </div>
    );
  };

  const renderFooter = (mode: 'compact' | 'expanded') => {
    const isExpandedMode = mode === 'expanded';

    return (
      <div className={`flex items-center justify-between gap-4 ${isExpandedMode ? 'mt-5' : 'mt-3.5'}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={triggerFilePicker}
            className={`inline-flex items-center justify-center rounded-full bg-black/[0.032] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] transition hover:bg-black/[0.05] ${
              isExpandedMode ? 'h-11 w-11' : 'h-10 w-10'
            }`}
            type="button"
            aria-label="上传文件"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setIsModelMenuOpen((current) => !current)}
              className={`inline-flex items-center gap-3 rounded-full bg-black/[0.032] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] transition hover:bg-black/[0.05] ${
                isExpandedMode ? 'px-4 py-2.5' : 'px-3.5 py-2.5'
              }`}
              type="button"
            >
              <ProviderMark providerId={selectedProvider.id} size="sm" />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[14px] font-semibold text-slate-800">
                  {selectedModelOption?.label ?? '选择模型'}
                </span>
                <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  {selectedProvider.label}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {renderModelMenu(mode)}
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`rounded-full bg-slate-900 text-white shadow-[0_10px_22px_rgba(36,39,46,0.18)] transition-all active:scale-90 hover:bg-[#0071e3] disabled:scale-95 disabled:opacity-25 ${
            isExpandedMode ? 'h-12 w-12' : 'h-11 w-11'
          }`}
          type="button"
        >
          {isCurrentCanvasProcessing ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : (
            <Send className="mx-auto h-5 w-5" />
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      <div ref={composerMenuRef}>
        <div
          className={`absolute left-1/2 z-50 w-full px-8 transition-all duration-300 ${
            readyMode
              ? 'top-1/2 max-w-[44rem] -translate-x-1/2 -translate-y-1/2'
              : 'bottom-12 max-w-[40rem] -translate-x-1/2'
          }`}
        >
          <div className="relative">
            {readyMode ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 text-center"
              >
                <div className="text-[2.1rem] font-medium tracking-[-0.04em] text-slate-900">
                  Ready when you are.
                </div>
              </motion.div>
            ) : null}

            <motion.div
              layout
              className={`relative border border-white/92 bg-white/48 backdrop-blur-[36px] shadow-[0_12px_34px_rgba(36,39,46,0.07)] transition-all hover:bg-white/54 ${
                readyMode
                  ? 'rounded-[1.85rem] px-5 pt-4 pb-3.5'
                  : 'rounded-[1.75rem] px-5 pt-4 pb-4'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={onFileChange}
                className="hidden"
              />

              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => setIsExpanded(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.032] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] transition hover:bg-black/[0.05] hover:text-slate-700"
                  type="button"
                  aria-label="放大输入框"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                {pendingBranch ? (
                  <div className="rounded-full bg-[#0071e3]/8 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
                    Branch reply
                  </div>
                ) : null}
              </div>

              {renderAttachments('compact')}

              <textarea
                ref={compactTextareaRef}
                id="global-input"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                className={`w-full resize-none border-none bg-transparent text-slate-800 placeholder-slate-300 outline-none focus:outline-none focus:ring-0 ${
                  readyMode
                    ? 'text-[16px] leading-7 tracking-[-0.02em]'
                    : 'text-[17px] leading-7 tracking-[-0.022em]'
                }`}
                rows={1}
              />

              {composerNotice ? (
                <div className="mt-3 rounded-[1rem] bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {composerNotice}
                </div>
              ) : null}

              {renderFooter('compact')}
            </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded ? (
            <div className="fixed inset-0 z-[1200] flex items-center justify-center p-6">
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsExpanded(false)}
                className="absolute inset-0 bg-slate-950/16 backdrop-blur-md"
              />

              <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.98 }}
                className="relative flex h-[min(80vh,760px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(245,247,251,0.88)_100%)] p-6 shadow-[0_24px_80px_rgba(36,39,46,0.16)] backdrop-blur-3xl"
              >
                <div className="mb-5 flex items-center justify-between">
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.032] text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.98)] transition hover:bg-black/[0.05] hover:text-slate-700"
                    type="button"
                    aria-label="收起输入框"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Expanded Composer
                  </div>
                </div>

                {renderAttachments('expanded')}

                <textarea
                  ref={expandedTextareaRef}
                  value={value}
                  onChange={(event) => onChange(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={placeholder}
                  className="min-h-[220px] w-full flex-1 resize-none rounded-[1.45rem] border border-black/[0.05] bg-white/74 px-5 py-4 text-[18px] leading-8 tracking-[-0.024em] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-[#0071e3]/18"
                  rows={8}
                />

                {composerNotice ? (
                  <div className="mt-4 rounded-[1rem] bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {composerNotice}
                  </div>
                ) : null}

                {renderFooter('expanded')}
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
