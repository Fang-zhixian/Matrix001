export type AIProtocol = 'gemini' | 'openai-compatible';

export type ProviderCatalogId =
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'moonshot'
  | 'zhipu';

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  capabilities?: {
    image?: boolean;
    pdf?: boolean;
  };
}

export interface ProviderCatalogEntry {
  id: ProviderCatalogId;
  label: string;
  protocol: AIProtocol;
  description: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  baseUrlLabel?: string;
  baseUrlPlaceholder?: string;
  defaultBaseUrl?: string;
  models: ModelOption[];
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'gemini',
    label: 'Gemini Native',
    protocol: 'gemini',
    description: 'Google Gemini native API',
    apiKeyLabel: 'Gemini API Key',
    apiKeyPlaceholder: 'Paste your Gemini API key',
    models: [
      {
        id: 'gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        description: 'Fast default model',
        capabilities: { image: true, pdf: true },
      },
      {
        id: 'gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        description: 'Stronger reasoning model',
        capabilities: { image: true, pdf: true },
      },
      {
        id: 'gemini-2.0-flash',
        label: 'Gemini 2.0 Flash',
        description: 'Lower latency option',
        capabilities: { image: true, pdf: true },
      },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai-compatible',
    description: 'DeepSeek OpenAI-compatible API',
    apiKeyLabel: 'DeepSeek API Key',
    apiKeyPlaceholder: 'Paste your DeepSeek API key',
    baseUrlLabel: 'API Base URL',
    baseUrlPlaceholder: 'https://api.deepseek.com/v1',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat', description: 'General chat model' },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Reasoning-focused model' },
    ],
  },
  {
    id: 'qwen',
    label: 'Qwen',
    protocol: 'openai-compatible',
    description: 'Alibaba Cloud DashScope compatible endpoint',
    apiKeyLabel: 'DashScope API Key',
    apiKeyPlaceholder: 'Paste your DashScope API key',
    baseUrlLabel: 'API Base URL',
    baseUrlPlaceholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {
        id: 'qwen3.5-plus',
        label: 'Qwen 3.5 Plus',
        description: 'Vision-capable balanced model',
        capabilities: { image: true },
      },
      { id: 'qwen-plus', label: 'Qwen Plus', description: 'Balanced text model' },
      { id: 'qwen-max', label: 'Qwen Max', description: 'Higher capability model' },
      { id: 'qwen-turbo', label: 'Qwen Turbo', description: 'Faster lower-cost option' },
    ],
  },
  {
    id: 'moonshot',
    label: 'Moonshot',
    protocol: 'openai-compatible',
    description: 'Kimi / Moonshot OpenAI-compatible API',
    apiKeyLabel: 'Moonshot API Key',
    apiKeyPlaceholder: 'Paste your Moonshot API key',
    baseUrlLabel: 'API Base URL',
    baseUrlPlaceholder: 'https://api.moonshot.cn/v1',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'moonshot-v1-8k', label: 'Moonshot v1 8K', description: 'Shorter context window' },
      { id: 'moonshot-v1-32k', label: 'Moonshot v1 32K', description: 'Mid-size context window' },
      { id: 'moonshot-v1-128k', label: 'Moonshot v1 128K', description: 'Long context window' },
    ],
  },
  {
    id: 'zhipu',
    label: 'Zhipu',
    protocol: 'openai-compatible',
    description: 'Zhipu GLM OpenAI-compatible API',
    apiKeyLabel: 'Zhipu API Key',
    apiKeyPlaceholder: 'Paste your Zhipu API key',
    baseUrlLabel: 'API Base URL',
    baseUrlPlaceholder: 'https://open.bigmodel.cn/api/paas/v4',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-4.5', label: 'GLM 4.5', description: 'General flagship model' },
      { id: 'glm-4.5-air', label: 'GLM 4.5 Air', description: 'Faster lower-cost option' },
      { id: 'glm-4.5-flash', label: 'GLM 4.5 Flash', description: 'Low-latency model' },
    ],
  },
];

export function getProviderCatalogEntry(providerId: ProviderCatalogId) {
  return PROVIDER_CATALOG.find((provider) => provider.id === providerId) ?? PROVIDER_CATALOG[0];
}

export function getDefaultModelForProvider(providerId: ProviderCatalogId) {
  return getProviderCatalogEntry(providerId).models[0]?.id ?? '';
}

export function getDefaultBaseUrlForProvider(providerId: ProviderCatalogId) {
  return getProviderCatalogEntry(providerId).defaultBaseUrl ?? '';
}
