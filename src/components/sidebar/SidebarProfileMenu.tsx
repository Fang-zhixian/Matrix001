import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronUp, Settings2, User } from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';

interface SidebarProfileMenuProps {
  isOpen: boolean;
  user: FirebaseUser | null;
  onToggle: () => void;
  onOpenSettings: () => void;
}

const SidebarProfileMenu = ({
  isOpen,
  user,
  onToggle,
  onOpenSettings,
}: SidebarProfileMenuProps) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-[1rem] px-2 py-2 transition hover:bg-black/[0.03]"
        type="button"
      >
        <div className="flex min-w-0 items-center gap-3">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || ''}
              className="h-9 w-9 rounded-[0.9rem]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-white shadow-sm">
              <User className="h-4 w-4 text-slate-500" />
            </div>
          )}
          <div className="min-w-0 text-left">
            <div className="truncate text-[13px] font-medium text-slate-700">
              {user?.displayName || 'Workspace'}
            </div>
            <div className="text-[11px] text-slate-400">Open menu</div>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronLeft className="h-4 w-4 -rotate-90 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-[1rem] border border-[#e0e0e4] bg-white p-2 shadow-[0_18px_40px_rgba(25,28,34,0.12)]"
          >
            <button
              onClick={() => {
                onOpenSettings();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
              type="button"
            >
              <Settings2 className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SidebarProfileMenu;
