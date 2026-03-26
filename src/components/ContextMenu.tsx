import React from 'react';
import { motion } from 'motion/react';
import { FolderPlus, Maximize2, Trash2, Plus, LayoutGrid, Copy, Quote } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onMerge?: () => void;
  onExtract?: () => void;
  onDelete?: () => void;
  onInsert?: () => void;
  onCenter?: () => void;
  onCopyContent?: () => void;
  onReferenceContent?: () => void;
  selectedCount: number;
  isFolder: boolean;
  isPane: boolean;
}

const ContextMenu = ({ 
  x, y, onClose, onMerge, onExtract, onDelete, onInsert, onCenter, onCopyContent, onReferenceContent, selectedCount, isFolder, isPane 
}: ContextMenuProps) => {
  return (
    <div 
      className="fixed inset-0 z-[9999]" 
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ top: y, left: x }}
        className="absolute bg-white/90 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl p-1.5 min-w-[200px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isPane && (
          <>
            <button
              onClick={() => {
                onInsert?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
            >
              <Plus className="w-4 h-4" />
              Insert Node
            </button>
            <button
              onClick={() => {
                onCenter?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
            >
              <LayoutGrid className="w-4 h-4" />
              Center View
            </button>
          </>
        )}

        {!isPane && !isFolder && (
          <>
            <button
              onClick={() => {
                onReferenceContent?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
            >
              <Quote className="w-4 h-4" />
              Reference Content
            </button>
            <button
              onClick={() => {
                onCopyContent?.();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
            >
              <Copy className="w-4 h-4" />
              Copy as Markdown
            </button>
          </>
        )}

        {selectedCount > 1 && onMerge && (
          <button
            onClick={() => {
              onMerge();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            Merge into Folder ({selectedCount})
          </button>
        )}

        {isFolder && onExtract && (
          <button
            onClick={() => {
              onExtract();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
          >
            <Maximize2 className="w-4 h-4" />
            Extract Folder
          </button>
        )}

        {(selectedCount > 0 || !isPane) && (
          <button
            onClick={() => {
              onDelete?.();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete {selectedCount > 1 ? `(${selectedCount})` : ''}
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default ContextMenu;
