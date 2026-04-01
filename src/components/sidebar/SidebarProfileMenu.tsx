import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronUp,
  CreditCard,
  LogIn,
  LogOut,
  Settings2,
  User,
  UserRoundPlus,
} from 'lucide-react';

type SidebarUser = {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

interface SidebarProfileMenuProps {
  isOpen: boolean;
  user: SidebarUser | null;
  planLabel?: string | null;
  onToggle: () => void;
  onOpenAccount: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenBilling: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

const SidebarProfileMenu = ({
  isOpen,
  user,
  planLabel,
  onToggle,
  onOpenAccount,
  onOpenAuth,
  onOpenBilling,
  onOpenSettings,
  onLogout,
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
              {user?.displayName || 'Guest Workspace'}
            </div>
            <div className="truncate text-[11px] text-slate-400">
              {user ? planLabel || user.email || 'Open menu' : 'Open menu'}
            </div>
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
            {user ? (
              <>
                <button
                  onClick={onOpenAccount}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
                  type="button"
                >
                  <User className="h-4 w-4" />
                  <span>Account</span>
                </button>
                <button
                  onClick={onOpenBilling}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
                  type="button"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Billing</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onOpenAuth('login')}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
                  type="button"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => onOpenAuth('register')}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
                  type="button"
                >
                  <UserRoundPlus className="h-4 w-4" />
                  <span>Create Account</span>
                </button>
                <button
                  onClick={onOpenBilling}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
                  type="button"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Plans</span>
                </button>
              </>
            )}
            <button
              onClick={onOpenSettings}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
              type="button"
            >
              <Settings2 className="h-4 w-4" />
              <span>Settings</span>
            </button>
            {user ? (
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-[#9f2d2d] transition hover:bg-[#fff5f5]"
                type="button"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default SidebarProfileMenu;
