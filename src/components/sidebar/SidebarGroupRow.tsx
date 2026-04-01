import type { DragEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Edit2, Folder, FolderOpen, MessageSquare, Trash2 } from 'lucide-react';
import type { Canvas, SidebarFolder } from '../../types/canvas';

interface SidebarGroupRowProps {
  group: SidebarFolder;
  chatCount: number;
  groupChats: Canvas[];
  currentCanvasId: string | null;
  isExpanded: boolean;
  isDragOver: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  editValue: string;
  onToggleExpand: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onEditValueChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onSelectCanvas: (canvasId: string) => void;
  getChatLabel: (canvas: Canvas) => string;
}

const SidebarGroupRow = ({
  group,
  chatCount,
  groupChats,
  currentCanvasId,
  isExpanded,
  isDragOver,
  isEditing,
  isDeleting,
  editValue,
  onToggleExpand,
  onDragOver,
  onDragLeave,
  onDrop,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onStartEdit,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
  onSelectCanvas,
  getChatLabel,
}: SidebarGroupRowProps) => {
  return (
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div
        onClick={onToggleExpand}
        className={`group flex items-center gap-3 rounded-[0.95rem] px-2 py-2 transition-all ${
          isDragOver
            ? 'bg-[#0071e3]/7 text-[#0071e3]'
            : isExpanded
              ? 'bg-black/[0.05] text-slate-900'
              : 'text-slate-700 hover:bg-black/[0.03]'
        }`}
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white shadow-sm">
          {isExpanded ? <FolderOpen className="h-3.5 w-3.5" /> : <Folder className="h-3.5 w-3.5" />}
        </div>

        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              autoFocus
              value={editValue}
              onChange={(event) => onEditValueChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-700 outline-none"
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) {
                  return;
                }

                if (event.key === 'Enter' && editValue.trim()) {
                  onCommitEdit();
                }

                if (event.key === 'Escape') {
                  onCancelEdit();
                }
              }}
            />
            <button
              onClick={(event) => {
                event.stopPropagation();
                onCommitEdit();
              }}
              className="rounded-md p-1 text-slate-500 hover:bg-black/[0.04]"
              type="button"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : isDeleting ? (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="truncate text-[12px] text-red-500">Remove group?</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onConfirmDelete();
                }}
                className="rounded-md bg-red-500 px-2 py-1 text-[10px] font-semibold text-white"
                type="button"
              >
                Delete
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelDelete();
                }}
                className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] leading-6">{group.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-slate-400">{chatCount}</span>
              <div className="hidden items-center gap-0.5 rounded-full bg-white/92 px-1 py-0.5 shadow-sm group-hover:flex">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartEdit();
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-black/[0.04] hover:text-slate-700"
                  type="button"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartDelete();
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  type="button"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mt-1 space-y-1 border-l border-slate-200/80 pl-4">
              {groupChats.length > 0 ? (
                groupChats.map((canvas) => {
                  const isActive = canvas.id === currentCanvasId;

                  return (
                    <button
                      key={`${canvas.id}_group`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelectCanvas(canvas.id);
                      }}
                      className={`flex w-full items-center gap-2 rounded-[0.85rem] px-2 py-1.5 text-left transition ${
                        isActive ? 'bg-black/[0.05] text-slate-900' : 'text-slate-600 hover:bg-black/[0.03]'
                      }`}
                      type="button"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate text-[13px] leading-5">{getChatLabel(canvas)}</span>
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-2 text-[12px] text-slate-400">
                  This group is empty for now.
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SidebarGroupRow;
