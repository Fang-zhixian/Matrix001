import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff, KeyRound, SlidersHorizontal, X } from 'lucide-react';
import {
  PROVIDER_CATALOG,
  type ProviderCatalogId,
  type ProviderCatalogEntry,
} from '../lib/modelCatalog';
import type { ProviderConfig } from '../types/canvas';
import ProviderMark from './ProviderMark';

interface ModelSettingsPanelProps {
  isOpen: boolean;
  selectedProviderId: ProviderCatalogId;
  selectedModel: string;
  providerConfigs: Record<ProviderCatalogId, ProviderConfig>;
  onClose: () => void;
  onSelectProvider: (providerId: ProviderCatalogId) => void;
  onSelectModel: (model: string) => void;
  onUpdateProviderConfig: (providerId: ProviderCatalogId, patch: Partial<ProviderConfig>) => void;
}

const ProviderCard = ({
  provider,
  selected,
  onClick,
}: {
  provider: ProviderCatalogEntry;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-[1rem] border px-4 py-3.5 transition-all duration-300 ${
      selected
        ? 'border-[#0071e3]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(245,249,255,0.88)_100%)] shadow-[0_8px_24px_rgba(36,39,46,0.05)]'
        : 'border-transparent bg-transparent hover:bg-white/70'
    }`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium tracking-[-0.01em] text-slate-800">{provider.label}</div>
        <div className="mt-1 text-xs text-slate-400 truncate">{provider.description}</div>
      </div>
      <div className={`px-2.5 py-1 rounded-full text-[9px] font-semibold uppercase tracking-[0.14em] ${
        selected ? 'bg-[#0071e3] text-white' : 'bg-black/[0.05] text-slate-500'
      }`}>
        {provider.protocol === 'gemini' ? 'Native' : 'Compatible'}
      </div>
    </div>
  </button>
);

const CapabilityPill = ({ label }: { label: string }) => (
  <span className="rounded-full bg-black/[0.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
    {label}
  </span>
);

const ModelSettingsPanel = ({
  isOpen,
  selectedProviderId,
  selectedModel,
  providerConfigs,
  onClose,
  onSelectProvider,
  onSelectModel,
  onUpdateProviderConfig,
}: ModelSettingsPanelProps) => {
  const [showSecrets, setShowSecrets] = React.useState(false);
  const selectedProvider = PROVIDER_CATALOG.find((provider) => provider.id === selectedProviderId) ?? PROVIDER_CATALOG[0];
  const selectedConfig = providerConfigs[selectedProvider.id];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/14 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            className="relative flex h-[min(86vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(245,247,251,0.84)_100%)] shadow-[0_18px_55px_rgba(36,39,46,0.12)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-black/[0.05] px-9 py-5">
              <div>
                <div>
                  <h2 className="text-[22px] text-slate-900 tracking-[-0.03em]" style={{ fontFamily: 'var(--font-display)' }}>Model Settings</h2>
                  <p className="text-sm text-slate-500">Configure provider access in a macOS-style control panel.</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/80 text-slate-500 border border-white hover:bg-white transition-colors flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="min-h-0 border-r border-black/[0.05] bg-white/34 p-6">
                <div className="flex h-full min-h-0 flex-col rounded-[1.15rem] border border-white/80 bg-white/58 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  <div className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Providers</div>
                  <div className="min-h-0 space-y-1 overflow-y-auto pr-1">
                    {PROVIDER_CATALOG.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        selected={provider.id === selectedProvider.id}
                        onClick={() => onSelectProvider(provider.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-h-0 p-9">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Active Provider</div>
                      <h3 className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-slate-900">{selectedProvider.label}</h3>
                      <p className="mt-2 text-sm text-slate-500">{selectedProvider.description}</p>
                    </div>
                    <button
                      onClick={() => setShowSecrets((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/86 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:border-[#0071e3]/30 hover:text-[#0071e3]"
                    >
                      {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showSecrets ? 'Hide Keys' : 'Show Keys'}
                    </button>
                  </div>

                  <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="space-y-4">
                      <div className="rounded-[1.2rem] border border-white/80 bg-white/64 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <KeyRound className="w-4 h-4" />
                          Credentials
                        </div>
                        <div className="space-y-4">
                          <label className="block">
                            <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {selectedProvider.apiKeyLabel}
                            </span>
                            <input
                              type={showSecrets ? 'text' : 'password'}
                              value={selectedConfig.apiKey}
                              onChange={(e) => onUpdateProviderConfig(selectedProvider.id, { apiKey: e.target.value })}
                              placeholder={selectedProvider.apiKeyPlaceholder}
                              className="w-full rounded-[1.1rem] border border-black/[0.06] bg-white/88 px-4 py-3.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/10"
                            />
                          </label>

                          {selectedProvider.protocol === 'openai-compatible' && (
                            <label className="block">
                              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                {selectedProvider.baseUrlLabel}
                              </span>
                              <input
                                type="text"
                                value={selectedConfig.baseUrl}
                                onChange={(e) => onUpdateProviderConfig(selectedProvider.id, { baseUrl: e.target.value })}
                                placeholder={selectedProvider.baseUrlPlaceholder}
                                className="w-full rounded-[1.1rem] border border-black/[0.06] bg-white/88 px-4 py-3.5 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#0071e3]/30 focus:ring-4 focus:ring-[#0071e3]/10"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border border-white/80 bg-white/64 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          <SlidersHorizontal className="w-4 h-4" />
                          Model Selection
                        </div>
                        <div className="space-y-2">
                          {selectedProvider.models.map((model) => {
                            const isActive = model.id === selectedModel;

                            return (
                              <button
                                key={model.id}
                                onClick={() => onSelectModel(model.id)}
                                className={`flex w-full items-start justify-between gap-3 rounded-[1rem] border px-4 py-3 text-left transition ${
                                  isActive
                                    ? 'border-[#0071e3]/22 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(240,247,255,0.92)_100%)] shadow-[0_8px_22px_rgba(0,113,227,0.08)]'
                                    : 'border-black/[0.05] bg-white/78 hover:border-[#0071e3]/14 hover:bg-white'
                                }`}
                                type="button"
                              >
                                <div className="flex min-w-0 items-start gap-3">
                                  <ProviderMark providerId={selectedProvider.id} size="md" />
                                  <div className="min-w-0">
                                    <div className="text-[15px] font-semibold text-slate-900">{model.label}</div>
                                    <div className="mt-1 text-[12px] font-medium text-slate-400">{selectedProvider.label}</div>
                                    <div className="mt-2 text-sm text-slate-500">{model.description}</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {model.capabilities?.image && <CapabilityPill label="Image" />}
                                      {model.capabilities?.pdf && <CapabilityPill label="PDF" />}
                                      {!model.capabilities?.image && !model.capabilities?.pdf && (
                                        <CapabilityPill label="Text" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isActive && (
                                  <div className="rounded-full bg-[#0071e3]/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
                                    Active
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-[1.2rem] border border-white/80 bg-black/[0.022] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Model Notes</div>
                        <div className="mt-3 space-y-2">
                          {selectedProvider.models.map((model) => (
                            <div
                              key={model.id}
                              className={`rounded-[0.95rem] border px-4 py-3 transition-all ${
                                model.id === selectedModel
                                  ? 'border-[#0071e3]/25 bg-white shadow-sm'
                                  : 'border-transparent bg-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <ProviderMark providerId={selectedProvider.id} size="sm" />
                                <div>
                                  <div className="text-sm font-semibold text-slate-700">{model.label}</div>
                                  <div className="mt-1 text-[11px] text-slate-400">{selectedProvider.label}</div>
                                </div>
                              </div>
                              <div className="mt-1 text-sm text-slate-500">{model.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="px-1 text-xs leading-relaxed text-slate-400">
                        API keys are stored in your browser local state for convenience. In this app&apos;s current architecture, they are still client-side values.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ModelSettingsPanel;
