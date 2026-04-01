import { Check, Folder } from 'lucide-react';
import { motion } from 'motion/react';
import type { Canvas, SidebarFolder } from '../../types/canvas';

interface SidebarMoveMenuProps {
  canvas: Canvas;
  groups: SidebarFolder[];
  onMoveToChat: () => void;
  onMoveToGroup: (groupId: string) => void;
}

const SidebarMoveMenu = ({
  canvas,
  groups,
  onMoveToChat,
  onMoveToGroup,
}: SidebarMoveMenuProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      className="absolute right-2 top-11 z-30 w-[218px] rounded-[1rem] border border-[#d9d9dc] bg-white/98 p-2 shadow-[0_18px_40px_rgba(25,28,34,0.12)]"
    >
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        Move To Group
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onMoveToChat();
        }}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
          !canvas.folderId ? 'bg-[#111827]/6 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
        }`}
        type="button"
      >
        <span>Chat</span>
        {!canvas.folderId && <Check className="h-4 w-4" />}
      </button>
      {groups.map((group) => (
        <button
          key={group.id}
          onClick={(event) => {
            event.stopPropagation();
            onMoveToGroup(group.id);
          }}
          className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
            canvas.folderId === group.id ? 'bg-[#111827]/6 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
          }`}
          type="button"
        >
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4" />
            <span className="truncate">{group.name}</span>
          </div>
          {canvas.folderId === group.id && <Check className="h-4 w-4" />}
        </button>
      ))}
    </motion.div>
  );
};

export default SidebarMoveMenu;
