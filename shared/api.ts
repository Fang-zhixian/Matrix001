import type { Canvas, ProviderConfig, SidebarFolder } from '../src/types/canvas.js';
import type { ModelOption, ProviderCatalogEntry, ProviderCatalogId } from './modelCatalog.js';

export type DeploymentMode = 'saas' | 'self-hosted';
export type CredentialSource = 'platform' | 'user' | 'none';

export interface ProviderRuntimeStatus {
  providerId: ProviderCatalogId;
  available: boolean;
  credentialSource: CredentialSource;
  hasStoredUserKey: boolean;
  canUsePlatformKey: boolean;
  message?: string;
}

export interface WorkspaceBootstrapResponse {
  workspaceId: string;
  deploymentMode: DeploymentMode;
  byokEnabled: boolean;
  providers: ProviderCatalogEntry[];
  providerStatus: Record<ProviderCatalogId, ProviderRuntimeStatus>;
  providerConfigs: Record<ProviderCatalogId, ProviderConfig>;
  selectedProviderId: ProviderCatalogId;
  selectedModel: string;
  canvases: Canvas[];
  sidebarFolders: SidebarFolder[];
}

export interface UpdateWorkspaceSettingsRequest {
  selectedProviderId?: ProviderCatalogId;
  selectedModel?: string;
  providerConfigs?: Partial<Record<ProviderCatalogId, Partial<ProviderConfig> & { clearStoredApiKey?: boolean }>>;
  sidebarFolders?: SidebarFolder[];
}

export interface UpsertCanvasRequest {
  canvas: Canvas;
}

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'document';
  dataUrl?: string;
  base64Data?: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  attachments?: ChatAttachment[];
}

export interface ChatStreamRequest {
  providerId: ProviderCatalogId;
  model: string;
  messages: ChatMessage[];
  systemInstruction?: string;
}

export interface StreamChunk {
  type: 'content' | 'reasoning';
  text: string;
}

export interface ModelsResponse {
  providers: ProviderCatalogEntry[];
  providerStatus: Record<ProviderCatalogId, ProviderRuntimeStatus>;
}

export interface WorkspaceRecord {
  id: string;
  selectedProviderId: ProviderCatalogId;
  selectedModel: string;
  providerConfigs: Record<ProviderCatalogId, ProviderConfig>;
  canvases: Canvas[];
  sidebarFolders: SidebarFolder[];
  createdAt: number;
  updatedAt: number;
}

export type ProviderModelAvailability = {
  providerId: ProviderCatalogId;
  model: ModelOption;
  runtime: ProviderRuntimeStatus;
};
