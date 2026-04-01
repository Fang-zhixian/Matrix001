import express from 'express';
import type { Request, Response } from 'express';
import type { WorkspaceBootstrapResponse, WorkspaceRecord } from '../../../shared/api.js';
import {
  getDefaultBaseUrlForProvider,
  PROVIDER_CATALOG,
  type ProviderCatalogId,
} from '../../../shared/modelCatalog.js';
import { createEmptyWorkspace, ensureWorkspace, saveWorkspace } from '../storage/workspaceStore.js';
import {
  buildProviderStatusMap,
  getDeploymentMode,
  isByokEnabled,
  resolveProviderCredentials,
  sanitizeProviderConfigsForClient,
} from '../services/providerRuntime.js';
import { streamProviderText, toChatStreamRequest } from '../services/chatService.js';

const apiRouter = express.Router();

function getWorkspaceIdFromRequest(request: Request) {
  const headerWorkspaceId = request.header('x-workspace-id');
  const queryWorkspaceId = typeof request.query.workspaceId === 'string' ? request.query.workspaceId : undefined;
  const bodyWorkspaceId =
    request.body && typeof request.body === 'object' && 'workspaceId' in request.body
      ? String((request.body as Record<string, unknown>).workspaceId)
      : undefined;

  return headerWorkspaceId || queryWorkspaceId || bodyWorkspaceId;
}

function toBootstrapResponse(workspace: WorkspaceRecord): WorkspaceBootstrapResponse {
  return {
    workspaceId: workspace.id,
    deploymentMode: getDeploymentMode(),
    byokEnabled: isByokEnabled(),
    providers: PROVIDER_CATALOG,
    providerStatus: buildProviderStatusMap(workspace.providerConfigs),
    providerConfigs: sanitizeProviderConfigsForClient(workspace.providerConfigs),
    selectedProviderId: workspace.selectedProviderId,
    selectedModel: workspace.selectedModel,
    canvases: workspace.canvases,
    sidebarFolders: workspace.sidebarFolders,
  };
}

async function loadRequestWorkspace(request: Request) {
  return ensureWorkspace(getWorkspaceIdFromRequest(request));
}

apiRouter.get('/bootstrap', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    response.json(toBootstrapResponse(workspace));
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/models', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    response.json({
      providers: PROVIDER_CATALOG,
      providerStatus: buildProviderStatusMap(workspace.providerConfigs),
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.put('/settings', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    const patch = request.body as {
      selectedProviderId?: ProviderCatalogId;
      selectedModel?: string;
      providerConfigs?: Record<
        ProviderCatalogId,
        {
          apiKey?: string;
          baseUrl?: string;
          clearStoredApiKey?: boolean;
        }
      >;
      sidebarFolders?: WorkspaceRecord['sidebarFolders'];
    };

    const nextWorkspace: WorkspaceRecord = {
      ...workspace,
      selectedProviderId: patch.selectedProviderId ?? workspace.selectedProviderId,
      selectedModel: patch.selectedModel ?? workspace.selectedModel,
      sidebarFolders: patch.sidebarFolders ?? workspace.sidebarFolders,
      providerConfigs: { ...workspace.providerConfigs },
    };

    for (const provider of PROVIDER_CATALOG) {
      const providerPatch = patch.providerConfigs?.[provider.id];
      if (!providerPatch) continue;

      const currentConfig = workspace.providerConfigs[provider.id];
      nextWorkspace.providerConfigs[provider.id] = {
        ...currentConfig,
        baseUrl: providerPatch.baseUrl?.trim() || currentConfig.baseUrl || getDefaultBaseUrlForProvider(provider.id),
        apiKey: providerPatch.clearStoredApiKey
          ? ''
          : providerPatch.apiKey?.trim()
            ? providerPatch.apiKey.trim()
            : currentConfig.apiKey,
        hasStoredApiKey: undefined,
        credentialSource: undefined,
      };
    }

    const savedWorkspace = await saveWorkspace(nextWorkspace);
    response.json(toBootstrapResponse(savedWorkspace));
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/canvases', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    response.json({ canvases: workspace.canvases, workspaceId: workspace.id });
  } catch (error) {
    next(error);
  }
});

apiRouter.put('/canvases/:canvasId', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    const canvas = (request.body as { canvas?: WorkspaceRecord['canvases'][number] }).canvas;
    if (!canvas) {
      response.status(400).json({ error: 'Missing canvas payload.' });
      return;
    }

    const existingIndex = workspace.canvases.findIndex((entry) => entry.id === request.params.canvasId);
    const nextCanvases = [...workspace.canvases];
    if (existingIndex >= 0) {
      nextCanvases[existingIndex] = canvas;
    } else {
      nextCanvases.unshift(canvas);
    }

    const savedWorkspace = await saveWorkspace({
      ...workspace,
      canvases: nextCanvases,
    });

    response.json({
      canvas,
      workspaceId: savedWorkspace.id,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.delete('/canvases/:canvasId', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    const savedWorkspace = await saveWorkspace({
      ...workspace,
      canvases: workspace.canvases.filter((canvas) => canvas.id !== request.params.canvasId),
    });

    response.json({
      success: true,
      workspaceId: savedWorkspace.id,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/chat/stream', async (request: Request, response: Response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    const chatRequest = toChatStreamRequest(request.body);
    const providerConfig = workspace.providerConfigs[chatRequest.providerId];
    const credentials = resolveProviderCredentials(chatRequest.providerId, providerConfig);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    for await (const chunk of streamProviderText({
      protocol: credentials.protocol,
      model: chatRequest.model,
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
      messages: chatRequest.messages,
      systemInstruction: chatRequest.systemInstruction,
    })) {
      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    response.write('data: [DONE]\n\n');
    response.end();
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/session', async (request, response, next) => {
  try {
    const workspace = await loadRequestWorkspace(request);
    response.json({ workspaceId: workspace.id });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/workspaces', async (_request, response, next) => {
  try {
    const workspace = await saveWorkspace(createEmptyWorkspace());
    response.status(201).json(toBootstrapResponse(workspace));
  } catch (error) {
    next(error);
  }
});

export default apiRouter;
