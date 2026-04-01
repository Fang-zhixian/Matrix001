import type { DragEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import { Check, Edit2, MoveRight, Trash2 } from 'lucide-react';
import type { Canvas, SidebarFolder } from '../../types/canvas';
import SidebarMoveMenu from './SidebarMoveMenu';

interface SidebarChatRowProps {
  canvas: Canvas;
  label: string;
  groups: SidebarFolder[];
  isActive: boolean;
  isDragging: boolean;
  isEditing: boolean;
  isDeleting: boolean;
  isMoveMenuOpen: boolean;
  editValue: string;
  onSelect: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onToggleMoveMenu: () => void;
  onStartEdit: () => void;
  onEditValueChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onMoveToChat: () => void;
  onMoveToGroup: (groupId: string) => void;
}

const SidebarChatRow = ({
  canvas,
  label,
  groups,
  isActive,
  isDragging,
  isEditing,
  isDeleting,
  isMoveMenuOpen,
  editValue,
  onSelect,
  onDragStart,
  onDragEnd,
  onToggleMoveMenu,
  onStartEdit,
  onEditValueChange,
  onCommitEdit,
  onCancelEdit,
  onStartDelete,
  onConfirmDelete,
  onCancelDelete,
  onMoveToChat,
  onMoveToGroup,
}: SidebarChatRowProps) => {
  return (
    <div draggable={!isEditing && !isDeleting} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div
        onClick={onSelect}
        className={`group relative rounded-[0.95rem] px-2 py-1.5 transition-all ${
          isActive ? 'bg-black/[0.05] text-slate-900' : 'text-slate-700 hover:bg-black/[0.03]'
        } ${isDragging ? 'opacity-50' : ''}`}
      >
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={editValue}
              onChange={(event) => onEditValueChange(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-700 outline-none"
              onClick={(event) => event.stopPropagation()}
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
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[12px] text-red-500">Delete this chat?</span>
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
            <div className="flex items-center justify-between gap-2">
              <span className="truncate pr-12 text-[14px] leading-6">{label}</span>
              <div className="absolute right-1 top-1 hidden items-center gap-0.5 rounded-full bg-white/92 px-1 py-0.5 shadow-sm group-hover:flex">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleMoveMenu();
                  }}
                  className="rounded-md p-1 text-slate-400 hover:bg-black/[0.04] hover:text-slate-700"
                  type="button"
                >
                  <MoveRight className="h-3 w-3" />
                </button>
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
            <AnimatePresence>
              {isMoveMenuOpen ? (
                <SidebarMoveMenu
                  canvas={canvas}
                  groups={groups}
                  onMoveToChat={onMoveToChat}
                  onMoveToGroup={onMoveToGroup}
                />
              ) : null}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
};

export default SidebarChatRow;
