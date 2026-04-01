import type {
  ChatStreamRequest,
  StreamChunk,
  UpdateWorkspaceSettingsRequest,
  WorkspaceBootstrapResponse,
} from '../../shared/api';
import type { Canvas } from '../types/canvas';

const WORKSPACE_STORAGE_KEY = 'matrix001_workspace_id';

function getStoredWorkspaceId() {
  return window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

function setStoredWorkspaceId(workspaceId: string) {
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspaceId);
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const workspaceId = getStoredWorkspaceId();
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  const data = (await response.json()) as T;
  const nextWorkspaceId =
    typeof data === 'object' && data && 'workspaceId' in data
      ? String((data as Record<string, unknown>).workspaceId)
      : null;

  if (nextWorkspaceId) {
    setStoredWorkspaceId(nextWorkspaceId);
  }

  return data;
}

export async function bootstrapWorkspace() {
  return requestJson<WorkspaceBootstrapResponse>('/api/bootstrap');
}

export async function updateWorkspaceSettings(payload: UpdateWorkspaceSettingsRequest) {
  return requestJson<WorkspaceBootstrapResponse>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function saveCanvasToBackend(canvas: Canvas) {
  return requestJson<{ canvas: Canvas; workspaceId: string }>(`/api/canvases/${canvas.id}`, {
    method: 'PUT',
    body: JSON.stringify({ canvas }),
  });
}

export async function deleteCanvasFromBackend(canvasId: string) {
  return requestJson<{ success: boolean; workspaceId: string }>(`/api/canvases/${canvasId}`, {
    method: 'DELETE',
  });
}

export async function* streamBackendChat(payload: ChatStreamRequest): AsyncGenerator<StreamChunk> {
  const workspaceId = getStoredWorkspaceId();
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Chat request failed with ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Chat response body is empty.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .map((item) => item.trim())
        .find((item) => item.startsWith('data:'));

      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      yield JSON.parse(data) as StreamChunk;
    }

    if (done) {
      break;
    }
  }
}
