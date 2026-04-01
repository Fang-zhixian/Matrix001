import type { ProviderConfig } from '../../../src/types/canvas.js';
import type {
  CredentialSource,
  DeploymentMode,
  ProviderRuntimeStatus,
  WorkspaceRecord,
} from '../../../shared/api.js';
import {
  getDefaultBaseUrlForProvider,
  PROVIDER_CATALOG,
  type ProviderCatalogId,
} from '../../../shared/modelCatalog.js';

type PlatformProviderEnv = {
  apiKey: string;
  baseUrl?: string;
};

const PLATFORM_PROVIDER_ENV: Record<ProviderCatalogId, PlatformProviderEnv> = {
  gemini: {
    apiKey: process.env.PLATFORM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  },
  deepseek: {
    apiKey: process.env.PLATFORM_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.PLATFORM_DEEPSEEK_BASE_URL || process.env.DEEPSEEK_BASE_URL || '',
  },
  qwen: {
    apiKey: process.env.PLATFORM_QWEN_API_KEY || process.env.QWEN_API_KEY || '',
    baseUrl: process.env.PLATFORM_QWEN_BASE_URL || process.env.QWEN_BASE_URL || '',
  },
  moonshot: {
    apiKey: process.env.PLATFORM_MOONSHOT_API_KEY || process.env.MOONSHOT_API_KEY || '',
    baseUrl: process.env.PLATFORM_MOONSHOT_BASE_URL || process.env.MOONSHOT_BASE_URL || '',
  },
  zhipu: {
    apiKey: process.env.PLATFORM_ZHIPU_API_KEY || process.env.ZHIPU_API_KEY || '',
    baseUrl: process.env.PLATFORM_ZHIPU_BASE_URL || process.env.ZHIPU_BASE_URL || '',
  },
};

export function getDeploymentMode(): DeploymentMode {
  return process.env.APP_DEPLOYMENT_MODE === 'saas' ? 'saas' : 'self-hosted';
}

export function isByokEnabled() {
  return process.env.APP_ENABLE_BYOK !== 'false';
}

export function getProviderRuntimeStatus(
  providerId: ProviderCatalogId,
  providerConfig: ProviderConfig
): ProviderRuntimeStatus {
  const platformConfig = PLATFORM_PROVIDER_ENV[providerId];
  const hasPlatformKey = Boolean(platformConfig.apiKey.trim());
  const hasStoredUserKey = Boolean(providerConfig.apiKey.trim());

  let credentialSource: CredentialSource = 'none';
  if (isByokEnabled() && hasStoredUserKey) {
    credentialSource = 'user';
  } else if (hasPlatformKey) {
    credentialSource = 'platform';
  }

  return {
    providerId,
    available: credentialSource !== 'none',
    credentialSource,
    hasStoredUserKey,
    canUsePlatformKey: hasPlatformKey,
    message:
      credentialSource === 'none'
        ? 'No credential configured on the platform or workspace.'
        : undefined,
  };
}

export function buildProviderStatusMap(providerConfigs: WorkspaceRecord['providerConfigs']) {
  return Object.fromEntries(
    PROVIDER_CATALOG.map((provider) => [
      provider.id,
      getProviderRuntimeStatus(provider.id, providerConfigs[provider.id]),
    ])
  ) as Record<ProviderCatalogId, ProviderRuntimeStatus>;
}

export function sanitizeProviderConfigsForClient(providerConfigs: WorkspaceRecord['providerConfigs']) {
  return Object.fromEntries(
    PROVIDER_CATALOG.map((provider) => {
      const runtime = getProviderRuntimeStatus(provider.id, providerConfigs[provider.id]);
      const config = providerConfigs[provider.id];

      return [
        provider.id,
        {
          apiKey: '',
          baseUrl: config.baseUrl || PLATFORM_PROVIDER_ENV[provider.id].baseUrl || getDefaultBaseUrlForProvider(provider.id),
          hasStoredApiKey: runtime.hasStoredUserKey,
          credentialSource: runtime.credentialSource,
        },
      ];
    })
  ) as WorkspaceRecord['providerConfigs'];
}

export function resolveProviderCredentials(
  providerId: ProviderCatalogId,
  providerConfig: ProviderConfig
) {
  const runtime = getProviderRuntimeStatus(providerId, providerConfig);
  if (!runtime.available) {
    throw new Error(`Provider ${providerId} is not configured.`);
  }

  const platformConfig = PLATFORM_PROVIDER_ENV[providerId];
  const apiKey = runtime.credentialSource === 'user'
    ? providerConfig.apiKey.trim()
    : platformConfig.apiKey.trim();
  const baseUrl = (providerConfig.baseUrl || platformConfig.baseUrl || getDefaultBaseUrlForProvider(providerId)).trim();
  const provider = PROVIDER_CATALOG.find((entry) => entry.id === providerId) ?? PROVIDER_CATALOG[0];

  return {
    apiKey,
    baseUrl,
    credentialSource: runtime.credentialSource,
    protocol: provider.protocol,
  };
}
