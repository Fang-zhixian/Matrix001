import type { Canvas, ProviderConfig, SidebarFolder } from '../src/types/canvas.js';
import type { ModelOption, ProviderCatalogEntry, ProviderCatalogId } from './modelCatalog.js';

export type DeploymentMode = 'saas' | 'self-hosted';
export type CredentialSource = 'platform' | 'user' | 'none';
export type SubscriptionStatus = 'active' | 'trialing' | 'canceled';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: number;
}

export interface PlanSummary {
  id: string;
  label: string;
  description: string;
  priceCentsMonthly: number;
  monthlyTokenLimit: number;
  monthlyMessageLimit: number;
  features: string[];
  isDefault?: boolean;
}

export interface BillingSummary {
  planId: string;
  status: SubscriptionStatus;
  periodStart: number;
  periodEnd: number;
  usedTokens: number;
  usedMessages: number;
  remainingTokens: number;
  remainingMessages: number;
  priceCentsMonthly: number;
  canUsePlatformModels: boolean;
}

export interface ProviderRuntimeStatus {
  providerId: ProviderCatalogId;
  available: boolean;
  credentialSource: CredentialSource;
  hasStoredUserKey: boolean;
  canUsePlatformKey: boolean;
  message?: string;
}

export interface WorkspaceBootstrapResponse {
  workspaceId: string | null;
  deploymentMode: DeploymentMode;
  byokEnabled: boolean;
  allowGuest: boolean;
  requiresLogin: boolean;
  currentUser: AuthUser | null;
  billingSummary: BillingSummary | null;
  plans: PlanSummary[];
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

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  workspaceId: string | null;
  billingSummary: BillingSummary | null;
}

export interface ChangePlanRequest {
  planId: string;
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
  ownerUserId?: string | null;
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
