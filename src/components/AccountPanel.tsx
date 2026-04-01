import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BadgeCheck,
  CreditCard,
  LogIn,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserRoundPlus,
  X,
} from 'lucide-react';
import type {
  AuthUser,
  BillingSummary,
  DeploymentMode,
  PlanSummary,
} from '../../shared/api';

type AccountPanelView = 'account' | 'billing' | 'login' | 'register';

interface AccountPanelProps {
  isOpen: boolean;
  view: AccountPanelView;
  currentUser: AuthUser | null;
  billingSummary: BillingSummary | null;
  plans: PlanSummary[];
  allowGuest: boolean;
  requiresLogin: boolean;
  deploymentMode: DeploymentMode;
  byokEnabled: boolean;
  onClose: () => void;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onRegister: (payload: { email: string; password: string; displayName: string }) => Promise<void>;
  onLogout: () => Promise<void>;
  onChangePlan: (planId: string) => Promise<void>;
}

const formatPrice = (priceCentsMonthly: number) =>
  priceCentsMonthly === 0 ? 'Free' : `¥${(priceCentsMonthly / 100).toFixed(0)}/mo`;

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: value >= 1000 ? 'compact' : 'standard' }).format(value);

const TabButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
      active
        ? 'bg-slate-900 text-white shadow-[0_10px_28px_rgba(15,23,42,0.16)]'
        : 'bg-white/70 text-slate-500 hover:bg-white hover:text-slate-700'
    }`}
  >
    {children}
  </button>
);

const MetricBar = ({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) => {
  const progress = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  return (
    <div className="rounded-[1rem] border border-black/[0.05] bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] font-medium text-slate-500">{label}</div>
        <div className="text-[12px] font-semibold text-slate-700">
          {formatNumber(used)} / {formatNumber(total)}
        </div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#111827_0%,#0071e3_100%)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default function AccountPanel({
  isOpen,
  view,
  currentUser,
  billingSummary,
  plans,
  allowGuest,
  requiresLogin,
  deploymentMode,
  byokEnabled,
  onClose,
  onLogin,
  onRegister,
  onLogout,
  onChangePlan,
}: AccountPanelProps) {
  const [activeView, setActiveView] = useState<AccountPanelView>(view);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ displayName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setActiveView(view);
    setErrorMessage(null);
  }, [view, isOpen]);

  useEffect(() => {
    if (currentUser && (activeView === 'login' || activeView === 'register')) {
      setActiveView('account');
    }
  }, [activeView, currentUser]);

  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === billingSummary?.planId) ?? plans.find((plan) => plan.isDefault) ?? plans[0] ?? null,
    [billingSummary?.planId, plans]
  );

  const environmentLabel = deploymentMode === 'saas' ? 'Hosted Workspace' : 'Self-hosted Workspace';
  const guestLabel = requiresLogin
    ? 'Authentication is required before any workspace can be created.'
    : allowGuest
      ? 'Guest workspaces are available before login.'
      : 'Only authenticated accounts can create workspaces.';

  const handleLogin = async () => {
    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onLogin({
        email: loginForm.email.trim(),
        password: loginForm.password,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.displayName.trim() || !registerForm.email.trim() || !registerForm.password.trim()) {
      setErrorMessage('Please complete display name, email, and password.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onRegister({
        displayName: registerForm.displayName.trim(),
        email: registerForm.email.trim(),
        password: registerForm.password,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onLogout();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to sign out.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePlan = async (planId: string) => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onChangePlan(planId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to change plan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/18 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.985 }}
            className="relative flex h-[min(82vh,860px)] w-full max-w-5xl overflow-hidden rounded-[1.9rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(245,247,251,0.88)_100%)] shadow-[0_24px_64px_rgba(20,24,34,0.16)] backdrop-blur-2xl"
          >
            <div className="hidden w-[320px] border-r border-black/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.70)_0%,rgba(241,245,249,0.82)_100%)] p-7 lg:flex lg:flex-col">
              <div className="rounded-[1.4rem] border border-white/80 bg-white/72 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {environmentLabel}
                </div>
                <h2
                  className="mt-4 text-[28px] font-semibold tracking-[-0.04em] text-slate-900"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Accounts & Billing
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Secure user sessions, workspace ownership, and quota-aware model access now run through the backend.
                </p>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.3rem] border border-white/80 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <Sparkles className="h-4 w-4" />
                    Access Mode
                  </div>
                  <div className="mt-3 text-sm font-medium text-slate-700">
                    {currentUser ? `Signed in as ${currentUser.displayName}` : 'Guest / anonymous access'}
                  </div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{guestLabel}</div>
                </div>

                <div className="rounded-[1.3rem] border border-white/80 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <BadgeCheck className="h-4 w-4" />
                    Provider Credentials
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-500">
                    {deploymentMode === 'saas'
                      ? byokEnabled
                        ? 'Hosted quotas are available, and advanced users can still attach their own provider keys.'
                        : 'Hosted quotas are available. End users do not supply provider keys in this mode.'
                      : byokEnabled
                        ? 'Users can keep running BYOK credentials while the backend handles sessions and storage.'
                        : 'Provider access is controlled by the server environment only.'}
                  </div>
                </div>
              </div>

              <div className="mt-auto rounded-[1.3rem] border border-white/80 bg-[linear-gradient(180deg,rgba(247,249,252,0.88)_0%,rgba(255,255,255,0.88)_100%)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current Plan</div>
                <div className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-slate-900">
                  {currentPlan?.label ?? 'No plan'}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {currentPlan ? currentPlan.description : 'Create an account to manage quotas and hosted access.'}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-black/[0.05] px-6 py-5 lg:px-8">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Workspace Control
                  </div>
                  <div className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-slate-900">
                    {currentUser ? 'Workspace account' : 'Sign in or create an account'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/90 bg-white/80 text-slate-500 transition hover:bg-white hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  {currentUser ? (
                    <>
                      <TabButton active={activeView === 'account'} onClick={() => setActiveView('account')}>
                        Account
                      </TabButton>
                      <TabButton active={activeView === 'billing'} onClick={() => setActiveView('billing')}>
                        Billing
                      </TabButton>
                    </>
                  ) : (
                    <>
                      <TabButton active={activeView === 'login'} onClick={() => setActiveView('login')}>
                        Sign In
                      </TabButton>
                      <TabButton active={activeView === 'register'} onClick={() => setActiveView('register')}>
                        Create Account
                      </TabButton>
                      <TabButton active={activeView === 'billing'} onClick={() => setActiveView('billing')}>
                        Plans
                      </TabButton>
                    </>
                  )}
                </div>

                {errorMessage ? (
                  <div className="mb-5 rounded-[1rem] border border-[#ffcfb8] bg-[#fff7f2] px-4 py-3 text-sm text-[#9a4219]">
                    {errorMessage}
                  </div>
                ) : null}

                {currentUser && activeView === 'account' ? (
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="rounded-[1.35rem] border border-white/85 bg-white/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Identity
                      </div>
                      <div className="mt-4 flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] bg-slate-900 text-white">
                          <span className="text-lg font-semibold">
                            {(currentUser.displayName || currentUser.email).slice(0, 1).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-[22px] font-semibold tracking-[-0.03em] text-slate-900">
                            {currentUser.displayName}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{currentUser.email}</div>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1rem] border border-black/[0.05] bg-slate-50/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Access
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-700">
                            {deploymentMode === 'saas' ? 'Managed production workspace' : 'Self-hosted account session'}
                          </div>
                        </div>
                        <div className="rounded-[1rem] border border-black/[0.05] bg-slate-50/80 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            BYOK
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-700">
                            {byokEnabled ? 'Available alongside account auth' : 'Disabled by deployment policy'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-white/85 bg-white/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Session Controls
                      </div>
                      <div className="mt-4 text-sm leading-6 text-slate-500">
                        Your session now lives in an httpOnly backend cookie, and workspace ownership is enforced server-side.
                      </div>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleLogout}
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0071e3] disabled:cursor-wait disabled:opacity-60"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : null}

                {!currentUser && (activeView === 'login' || activeView === 'register') ? (
                  <div className="mx-auto max-w-2xl rounded-[1.4rem] border border-white/85 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-slate-900 text-white">
                        {activeView === 'login' ? <LogIn className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-900">
                          {activeView === 'login' ? 'Sign in to continue' : 'Create your workspace account'}
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {activeView === 'login'
                            ? 'Resume your synced workspace, quotas, and hosted model access.'
                            : 'Create an account to unlock owned workspaces, subscriptions, and session-based access.'}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {activeView === 'register' ? (
                        <label className="block">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Display Name
                          </div>
                          <input
                            type="text"
                            value={registerForm.displayName}
                            onChange={(event) => setRegisterForm((current) => ({ ...current, displayName: event.target.value }))}
                            className="h-12 w-full rounded-[1rem] border border-black/[0.06] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/10"
                            placeholder="How should we address you?"
                          />
                        </label>
                      ) : null}

                      <label className="block">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Email
                        </div>
                        <input
                          type="email"
                          value={activeView === 'login' ? loginForm.email : registerForm.email}
                          onChange={(event) =>
                            activeView === 'login'
                              ? setLoginForm((current) => ({ ...current, email: event.target.value }))
                              : setRegisterForm((current) => ({ ...current, email: event.target.value }))
                          }
                          className="h-12 w-full rounded-[1rem] border border-black/[0.06] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/10"
                          placeholder="you@example.com"
                        />
                      </label>

                      <label className="block">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Password
                        </div>
                        <input
                          type="password"
                          value={activeView === 'login' ? loginForm.password : registerForm.password}
                          onChange={(event) =>
                            activeView === 'login'
                              ? setLoginForm((current) => ({ ...current, password: event.target.value }))
                              : setRegisterForm((current) => ({ ...current, password: event.target.value }))
                          }
                          className="h-12 w-full rounded-[1rem] border border-black/[0.06] bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/10"
                          placeholder="Use a long, unique password"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={activeView === 'login' ? handleLogin : handleRegister}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0071e3] disabled:cursor-wait disabled:opacity-60"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                          Working...
                        </span>
                      ) : activeView === 'login' ? (
                        <>
                          <LogIn className="h-4 w-4" />
                          Sign In
                        </>
                      ) : (
                        <>
                          <UserRoundPlus className="h-4 w-4" />
                          Create Account
                        </>
                      )}
                    </button>
                  </div>
                ) : null}

                {activeView === 'billing' ? (
                  <div className="space-y-5">
                    {currentUser && billingSummary ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <MetricBar
                          label="Messages this cycle"
                          used={billingSummary.usedMessages}
                          total={billingSummary.usedMessages + billingSummary.remainingMessages}
                        />
                        <MetricBar
                          label="Tokens this cycle"
                          used={billingSummary.usedTokens}
                          total={billingSummary.usedTokens + billingSummary.remainingTokens}
                        />
                      </div>
                    ) : (
                      <div className="rounded-[1.2rem] border border-[#dce7ff] bg-[#f5f9ff] px-4 py-3 text-sm text-[#315c93]">
                        Compare plans first. Sign in when you are ready to activate subscriptions and hosted quotas.
                      </div>
                    )}

                    <div className="grid gap-4 xl:grid-cols-3">
                      {plans.map((plan) => {
                        const isCurrentPlan = billingSummary?.planId === plan.id;
                        const canSelect = Boolean(currentUser) && !isCurrentPlan;

                        return (
                          <div
                            key={plan.id}
                            className={`rounded-[1.35rem] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition ${
                              isCurrentPlan
                                ? 'border-[#0071e3]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(243,248,255,0.94)_100%)] shadow-[0_12px_30px_rgba(0,113,227,0.10)]'
                                : 'border-white/85 bg-white/80'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[20px] font-semibold tracking-[-0.03em] text-slate-900">
                                  {plan.label}
                                </div>
                                <div className="mt-2 text-sm leading-6 text-slate-500">{plan.description}</div>
                              </div>
                              {isCurrentPlan ? (
                                <div className="rounded-full bg-[#0071e3]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
                                  Active
                                </div>
                              ) : null}
                            </div>

                            <div className="mt-5 text-[26px] font-semibold tracking-[-0.04em] text-slate-900">
                              {formatPrice(plan.priceCentsMonthly)}
                            </div>
                            <div className="mt-4 grid gap-2 text-sm text-slate-500">
                              <div>{formatNumber(plan.monthlyMessageLimit)} messages / month</div>
                              <div>{formatNumber(plan.monthlyTokenLimit)} tokens / month</div>
                            </div>

                            <div className="mt-5 space-y-2 text-sm text-slate-600">
                              {plan.features.map((feature) => (
                                <div key={feature} className="flex items-start gap-2">
                                  <CreditCard className="mt-0.5 h-4 w-4 text-slate-400" />
                                  <span>{feature}</span>
                                </div>
                              ))}
                            </div>

                            <button
                              type="button"
                              disabled={!canSelect || submitting}
                              onClick={() => handleChangePlan(plan.id)}
                              className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium transition ${
                                isCurrentPlan
                                  ? 'bg-slate-900 text-white'
                                  : canSelect
                                    ? 'bg-[#0071e3] text-white hover:bg-[#0062c4]'
                                    : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {isCurrentPlan ? 'Current Plan' : currentUser ? 'Switch Plan' : 'Sign in to subscribe'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
