import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { WorkspaceRecord } from '../../../shared/api.js';
import {
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  type ProviderCatalogId,
} from '../../../shared/modelCatalog.js';

const DATA_ROOT = path.resolve(process.cwd(), 'server/data/workspaces');

function workspaceFilePath(workspaceId: string) {
  return path.join(DATA_ROOT, `${workspaceId}.json`);
}

function createDefaultProviderConfigs() {
  const providerIds: ProviderCatalogId[] = ['gemini', 'deepseek', 'qwen', 'moonshot', 'zhipu'];
  return Object.fromEntries(
    providerIds.map((providerId) => [
      providerId,
      {
        apiKey: '',
        baseUrl: getDefaultBaseUrlForProvider(providerId),
        hasStoredApiKey: false,
        credentialSource: 'none' as const,
      },
    ])
  ) as WorkspaceRecord['providerConfigs'];
}

export function createEmptyWorkspace(workspaceId?: string): WorkspaceRecord {
  const now = Date.now();
  return {
    id: workspaceId ?? randomUUID(),
    selectedProviderId: 'gemini',
    selectedModel: getDefaultModelForProvider('gemini'),
    providerConfigs: createDefaultProviderConfigs(),
    canvases: [],
    sidebarFolders: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function ensureDataRoot() {
  await mkdir(DATA_ROOT, { recursive: true });
}

export async function loadWorkspace(workspaceId: string) {
  await ensureDataRoot();

  try {
    const raw = await readFile(workspaceFilePath(workspaceId), 'utf8');
    return JSON.parse(raw) as WorkspaceRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function saveWorkspace(workspace: WorkspaceRecord) {
  await ensureDataRoot();

  const nextWorkspace: WorkspaceRecord = {
    ...workspace,
    updatedAt: Date.now(),
  };

  const targetPath = workspaceFilePath(workspace.id);
  const tempPath = `${targetPath}.tmp`;
  await writeFile(tempPath, JSON.stringify(nextWorkspace, null, 2), 'utf8');
  await rename(tempPath, targetPath);
  return nextWorkspace;
}

export async function ensureWorkspace(workspaceId?: string) {
  if (workspaceId) {
    const existingWorkspace = await loadWorkspace(workspaceId);
    if (existingWorkspace) {
      return existingWorkspace;
    }
  }

  const newWorkspace = createEmptyWorkspace(workspaceId);
  return saveWorkspace(newWorkspace);
}
