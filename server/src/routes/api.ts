import express from 'express';
import type { Request, Response } from 'express';
import type { WorkspaceBootstrapResponse, WorkspaceRecord } from '../../../shared/api.js';
import {
  getDefaultBaseUrlForProvider,
  getDefaultModelForProvider,
  PROVIDER_CATALOG,
  type ProviderCatalogId,
} from '../../../shared/modelCatalog.js';
import {
  createEmptyWorkspace,
  ensureWorkspace,
  listWorkspacesForUser,
  saveWorkspace,
} from '../storage/workspaceStore.js';
import {
  buildProviderStatusMap,
  getDeploymentMode,
  isByokEnabled,
  resolveProviderCredentials,
  sanitizeProviderConfigsForClient,
} from '../services/providerRuntime.js';
import { streamProviderText, toChatStreamRequest } from '../services/chatService.js';
import {
  getAuthenticatedUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../services/authService.js';
import {
  changeUserPlan,
  enforceQuota,
  getBillingSummary,
  listPlans,
  recordUsageEvent,
} from '../services/billingService.js';

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

function allowGuestAccess() {
  if (process.env.APP_ALLOW_GUEST === 'true') return true;
  if (process.env.APP_ALLOW_GUEST === 'false') return false;
  return getDeploymentMode() !== 'saas';
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateInputTokens(messages: Array<{ content: string; attachments?: Array<{ kind: 'image' | 'document' }> }>) {
  return messages.reduce((sum, message) => {
    const attachmentTokenCost = (message.attachments ?? []).reduce((attachmentSum, attachment) => {
      return attachmentSum + (attachment.kind === 'image' ? 1200 : 2200);
    }, 0);

    return sum + estimateTokens(message.content) + attachmentTokenCost;
  }, 0);
}

function estimateCostMicros(providerId: string, totalTokens: number) {
  const ratePerThousandMicros: Record<string, number> = {
    gemini: 3500,
    deepseek: 2200,
    qwen: 2600,
    moonshot: 2800,
    zhipu: 2500,
  };

  return Math.round((totalTokens / 1000) * (ratePerThousandMicros[providerId] ?? 3000));
}

type RequestContext = {
  currentUser: Awaited<ReturnType<typeof getAuthenticatedUser>>;
  workspace: WorkspaceRecord | null;
  allowGuest: boolean;
  requiresLogin: boolean;
};

async function loadRequestContext(request: Request): Promise<RequestContext> {
  const currentUser = await getAuthenticatedUser(request);
  const allowGuest = allowGuestAccess();
  const requestedWorkspaceId = getWorkspaceIdFromRequest(request);

  if (currentUser) {
    if (requestedWorkspaceId) {
      let requestedWorkspace: WorkspaceRecord | null = null;

      try {
        requestedWorkspace = await ensureWorkspace(requestedWorkspaceId, currentUser.id);
      } catch {
        requestedWorkspace = null;
      }

      if (requestedWorkspace) {
        return {
          currentUser,
          workspace: requestedWorkspace,
          allowGuest,
          requiresLogin: false,
        };
      }

      return {
        currentUser,
        workspace: (await listWorkspacesForUser(currentUser.id))[0] ?? await ensureWorkspace(undefined, currentUser.id),
        allowGuest,
        requiresLogin: false,
      };
    }

    const ownedWorkspaces = await listWorkspacesForUser(currentUser.id);
    return {
      currentUser,
      workspace: ownedWorkspaces[0] ?? await ensureWorkspace(undefined, currentUser.id),
      allowGuest,
      requiresLogin: false,
    };
  }

  if (!allowGuest) {
    return {
      currentUser: null,
      workspace: null,
      allowGuest,
      requiresLogin: true,
    };
  }

  if (requestedWorkspaceId) {
    try {
      return {
        currentUser: null,
        workspace: await ensureWorkspace(requestedWorkspaceId),
        allowGuest,
        requiresLogin: false,
      };
    } catch {
      return {
        currentUser: null,
        workspace: await ensureWorkspace(undefined),
        allowGuest,
        requiresLogin: false,
      };
    }
  }

  return {
    currentUser: null,
    workspace: await ensureWorkspace(undefined),
    allowGuest,
    requiresLogin: false,
  };
}

async function toBootstrapResponse(context: RequestContext): Promise<WorkspaceBootstrapResponse> {
  const fallbackWorkspace = context.workspace ?? createEmptyWorkspace('bootstrap');
  const plans = await listPlans();
  const billingSummary = context.currentUser ? await getBillingSummary(context.currentUser.id) : null;

  return {
    workspaceId: context.workspace?.id ?? null,
    deploymentMode: getDeploymentMode(),
    byokEnabled: isByokEnabled(),
    allowGuest: context.allowGuest,
    requiresLogin: context.requiresLogin,
    currentUser: context.currentUser,
    billingSummary,
    plans,
    providers: PROVIDER_CATALOG,
    providerStatus: buildProviderStatusMap(fallbackWorkspace.providerConfigs),
    providerConfigs: sanitizeProviderConfigsForClient(fallbackWorkspace.providerConfigs),
    selectedProviderId: fallbackWorkspace.selectedProviderId,
    selectedModel: fallbackWorkspace.selectedModel,
    canvases: context.workspace?.canvases ?? [],
    sidebarFolders: context.workspace?.sidebarFolders ?? [],
  };
}

apiRouter.get('/bootstrap', async (request, response, next) => {
  try {
    response.json(await toBootstrapResponse(await loadRequestContext(request)));
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/models', async (request, response, next) => {
  try {
    const context = await loadRequestContext(request);
    const workspace = context.workspace ?? createEmptyWorkspace('bootstrap');
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
    const context = await loadRequestContext(request);
    if (!context.workspace) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    const workspace = context.workspace;
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
    response.json(
      await toBootstrapResponse({
        ...context,
        workspace: savedWorkspace,
      })
    );
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/canvases', async (request, response, next) => {
  try {
    const context = await loadRequestContext(request);
    if (!context.workspace) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    response.json({ canvases: context.workspace.canvases, workspaceId: context.workspace.id });
  } catch (error) {
    next(error);
  }
});

apiRouter.put('/canvases/:canvasId', async (request, response, next) => {
  try {
    const context = await loadRequestContext(request);
    if (!context.workspace) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    const workspace = context.workspace;
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
    const context = await loadRequestContext(request);
    if (!context.workspace) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    const workspace = context.workspace;
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
    const context = await loadRequestContext(request);
    if (!context.workspace) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    const workspace = context.workspace;
    const chatRequest = toChatStreamRequest(request.body);
    const providerConfig = workspace.providerConfigs[chatRequest.providerId];
    const credentials = resolveProviderCredentials(chatRequest.providerId, providerConfig);
    const activeBilling = context.currentUser ? await getBillingSummary(context.currentUser.id) : null;

    if (credentials.credentialSource === 'platform') {
      if (!context.currentUser) {
        response.status(401).json({ error: 'Sign in to use platform-managed model access.' });
        return;
      }

      if (getDeploymentMode() === 'saas' && activeBilling && !activeBilling.canUsePlatformModels) {
        response.status(402).json({ error: 'Upgrade your plan to use platform-hosted models.' });
        return;
      }

      await enforceQuota(context.currentUser.id);
    }

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();
    let outputText = '';

    for await (const chunk of streamProviderText({
      protocol: credentials.protocol,
      model: chatRequest.model,
      apiKey: credentials.apiKey,
      baseUrl: credentials.baseUrl,
      messages: chatRequest.messages,
      systemInstruction: chatRequest.systemInstruction,
      })) {
      if (chunk.type === 'content') {
        outputText += chunk.text;
      }

      response.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    if (context.currentUser && credentials.credentialSource === 'platform') {
      const inputTokens = estimateInputTokens(chatRequest.messages);
      const outputTokens = estimateTokens(outputText);
      const totalTokens = inputTokens + outputTokens;
      await recordUsageEvent({
        userId: context.currentUser.id,
        workspaceId: workspace.id,
        providerId: chatRequest.providerId,
        modelId: chatRequest.model,
        credentialSource: credentials.credentialSource,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostMicros: estimateCostMicros(chatRequest.providerId, totalTokens),
      });
    }

    response.write('data: [DONE]\n\n');
    response.end();
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/auth/me', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request);
    response.json({
      user,
      billingSummary: user ? await getBillingSummary(user.id) : null,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/auth/register', async (request, response, next) => {
  try {
    const auth = await registerUser(request.body as { email: string; password: string; displayName: string }, response);
    const workspaceId = getWorkspaceIdFromRequest(request);
    const workspace = await ensureWorkspace(workspaceId, auth.user.id);
    response.status(201).json({
      ...auth,
      workspaceId: workspace.id,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/auth/login', async (request, response, next) => {
  try {
    const auth = await loginUser(request.body as { email: string; password: string }, response);
    const requestedWorkspaceId = getWorkspaceIdFromRequest(request);
    let workspace = null;

    if (requestedWorkspaceId) {
      try {
        workspace = await ensureWorkspace(requestedWorkspaceId, auth.user.id);
      } catch {
        workspace = null;
      }
    }

    if (!workspace) {
      const userWorkspaces = await listWorkspacesForUser(auth.user.id);
      workspace = userWorkspaces[0] ?? await ensureWorkspace(undefined, auth.user.id);
    }

    response.json({
      ...auth,
      workspaceId: workspace.id,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/auth/logout', async (request, response, next) => {
  try {
    await logoutUser(request, response);
    response.json({ success: true });
  } catch (error) {
    next(error);
  }
});

apiRouter.get('/billing/plans', async (_request, response, next) => {
  try {
    response.json({ plans: await listPlans() });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/billing/subscribe', async (request, response, next) => {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    const planId = String((request.body as { planId?: string }).planId ?? '');
    if (!planId) {
      response.status(400).json({ error: 'Missing planId.' });
      return;
    }

    const billingSummary = await changeUserPlan(user.id, planId);
    response.json({ billingSummary, plans: await listPlans() });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/workspaces', async (_request, response, next) => {
  try {
    const user = await getAuthenticatedUser(_request);
    if (!user && !allowGuestAccess()) {
      response.status(401).json({ error: 'Login required.' });
      return;
    }

    const workspace = await saveWorkspace({
      ...createEmptyWorkspace(),
      ownerUserId: user?.id ?? null,
    });
    response.status(201).json(
      await toBootstrapResponse({
        currentUser: user,
        workspace,
        allowGuest: allowGuestAccess(),
        requiresLogin: false,
      })
    );
  } catch (error) {
    next(error);
  }
});

export default apiRouter;
