import { randomUUID } from 'node:crypto';
import type { WorkspaceRecord } from '../../../shared/api.js';
import {
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  type ProviderCatalogId,
} from '../../../shared/modelCatalog.js';
import { getDatabase, withTransaction } from './database.js';
import { HttpError } from '../utils/httpError.js';

type WorkspaceRow = {
  id: string;
  owner_user_id: string | null;
  selected_provider_id: WorkspaceRecord['selectedProviderId'];
  selected_model: string;
  provider_configs_json: WorkspaceRecord['providerConfigs'];
  created_at: string | number;
  updated_at: string | number;
};

type CanvasRow = {
  data_json: WorkspaceRecord['canvases'][number];
};

type SidebarFolderRow = {
  id: string;
  name: string;
  created_at: string | number;
  updated_at: string | number;
};

function toJsonValue<T>(value: T) {
  return value as any;
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

export async function loadWorkspace(workspaceId: string) {
  const db = await getDatabase();
  const [workspaceRow] = await db<WorkspaceRow[]>`
    SELECT *
    FROM workspaces
    WHERE id = ${workspaceId}
  `;

  if (!workspaceRow) {
    return null;
  }

  const canvases = await db<CanvasRow[]>`
    SELECT data_json
    FROM canvases
    WHERE workspace_id = ${workspaceId}
    ORDER BY updated_at DESC
  `;
  const sidebarFolders = await db<SidebarFolderRow[]>`
    SELECT id, name, created_at, updated_at
    FROM sidebar_folders
    WHERE workspace_id = ${workspaceId}
    ORDER BY updated_at DESC
  `;

  return {
    id: workspaceRow.id,
    ownerUserId: workspaceRow.owner_user_id,
    selectedProviderId: workspaceRow.selected_provider_id,
    selectedModel: workspaceRow.selected_model,
    providerConfigs: workspaceRow.provider_configs_json,
    canvases: canvases.map((row) => row.data_json),
    sidebarFolders: sidebarFolders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      createdAt: Number(folder.created_at),
      lastModified: Number(folder.updated_at),
    })),
    createdAt: Number(workspaceRow.created_at),
    updatedAt: Number(workspaceRow.updated_at),
  };
}

export async function saveWorkspace(workspace: WorkspaceRecord) {
  const nextWorkspace: WorkspaceRecord = {
    ...workspace,
    updatedAt: Date.now(),
  };

  await withTransaction(async (tx) => {
    await tx.unsafe(
      `
      INSERT INTO workspaces (
        id, owner_user_id, selected_provider_id, selected_model,
        provider_configs_json, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      ON CONFLICT (id) DO UPDATE SET
        owner_user_id = EXCLUDED.owner_user_id,
        selected_provider_id = EXCLUDED.selected_provider_id,
        selected_model = EXCLUDED.selected_model,
        provider_configs_json = EXCLUDED.provider_configs_json,
        updated_at = EXCLUDED.updated_at
    `,
      [
        nextWorkspace.id,
        nextWorkspace.ownerUserId ?? null,
        nextWorkspace.selectedProviderId,
        nextWorkspace.selectedModel,
        tx.json(toJsonValue(nextWorkspace.providerConfigs)),
        nextWorkspace.createdAt,
        nextWorkspace.updatedAt,
      ]
    );

    await tx.unsafe('DELETE FROM canvases WHERE workspace_id = $1', [nextWorkspace.id]);
    await tx.unsafe('DELETE FROM sidebar_folders WHERE workspace_id = $1', [nextWorkspace.id]);

    for (const canvas of nextWorkspace.canvases) {
      await tx.unsafe(
        `
        INSERT INTO canvases (
          id, workspace_id, name, folder_id, folder_name, is_incognito, data_json, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
      `,
        [
          canvas.id,
          nextWorkspace.id,
          canvas.name,
          canvas.folderId ?? null,
          canvas.folderName ?? null,
          canvas.isIncognito ?? false,
          tx.json(toJsonValue(canvas)),
          canvas.createdAt,
          canvas.lastModified,
        ]
      );
    }

    for (const folder of nextWorkspace.sidebarFolders) {
      await tx.unsafe(
        `
        INSERT INTO sidebar_folders (
          id, workspace_id, name, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5
        )
      `,
        [
          folder.id,
          nextWorkspace.id,
          folder.name,
          folder.createdAt,
          folder.lastModified,
        ]
      );
    }
  });

  return nextWorkspace;
}

export async function ensureWorkspace(workspaceId?: string, ownerUserId?: string | null) {
  if (workspaceId) {
    const existingWorkspace = await loadWorkspace(workspaceId);
    if (existingWorkspace) {
      if (!ownerUserId && existingWorkspace.ownerUserId) {
        throw new HttpError(401, 'Workspace requires authentication.');
      }

      if (
        ownerUserId &&
        existingWorkspace.ownerUserId &&
        existingWorkspace.ownerUserId !== ownerUserId
      ) {
        throw new HttpError(403, 'Workspace does not belong to the current account.');
      }

      if (ownerUserId && !existingWorkspace.ownerUserId) {
        return saveWorkspace({
          ...existingWorkspace,
          ownerUserId,
        });
      }

      return existingWorkspace;
    }
  }

  return saveWorkspace({
    ...createEmptyWorkspace(workspaceId),
    ownerUserId: ownerUserId ?? null,
  });
}

export async function listWorkspacesForUser(ownerUserId: string) {
  const db = await getDatabase();
  const rows = await db<{ id: string }[]>`
    SELECT id
    FROM workspaces
    WHERE owner_user_id = ${ownerUserId}
    ORDER BY updated_at DESC
  `;

  const workspaces = await Promise.all(rows.map((row) => loadWorkspace(row.id)));
  return workspaces.filter((workspace) => workspace !== null) as WorkspaceRecord[];
}
