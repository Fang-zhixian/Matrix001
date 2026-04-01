import type { NodeChange } from 'reactflow';
import type { Canvas, SidebarFolder } from '../types/canvas';

export function findCanvasById(canvases: Canvas[], canvasId: string) {
  return canvases.find((canvas) => canvas.id === canvasId);
}

export function replaceCanvas(canvases: Canvas[], updatedCanvas: Canvas) {
  return canvases.map((canvas) => (canvas.id === updatedCanvas.id ? updatedCanvas : canvas));
}

export function updateCanvasById(
  canvases: Canvas[],
  canvasId: string,
  updater: (canvas: Canvas) => Canvas
) {
  const currentCanvas = findCanvasById(canvases, canvasId);
  if (!currentCanvas) {
    return null;
  }

  const updatedCanvas = updater(currentCanvas);
  return {
    currentCanvas,
    updatedCanvas,
    canvases: replaceCanvas(canvases, updatedCanvas),
  };
}

export function updateCurrentCanvas(
  canvases: Canvas[],
  currentCanvasId: string | null,
  updater: (canvas: Canvas) => Canvas
) {
  if (!currentCanvasId) {
    return null;
  }

  return updateCanvasById(canvases, currentCanvasId, updater);
}

export function shouldPersistNodeChanges(changes: NodeChange[]) {
  return changes.some((change) => {
    if (change.type === 'position') {
      return change.dragging === false || change.dragging === undefined;
    }

    return change.type === 'dimensions' || change.type === 'remove' || change.type === 'add';
  });
}

export function getSidebarFolderSnapshotFromCanvas(canvas: Canvas): SidebarFolder | null {
  if (!canvas.folderId || !canvas.folderName) {
    return null;
  }

  return {
    id: canvas.folderId,
    name: canvas.folderName,
    createdAt: canvas.createdAt,
    lastModified: canvas.lastModified,
  };
}

export function mergeSidebarFolders(sidebarFolders: SidebarFolder[], canvases: Canvas[]) {
  return Array.from(
    new Map(
      [
        ...sidebarFolders,
        ...canvases
          .map(getSidebarFolderSnapshotFromCanvas)
          .filter((folder): folder is SidebarFolder => folder !== null),
      ].map((folder) => [folder.id, folder])
    ).values()
  ).sort((a, b) => b.lastModified - a.lastModified);
}

function sanitizeFirestoreValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' ? undefined : value;
  }

  if (value instanceof HTMLElement || (value.constructor && value.constructor.name === 'HTMLElement')) {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeFirestoreValue(item, seen))
      .filter((item) => item !== undefined);
  }

  const result: Record<string, unknown> = {};
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      continue;
    }

    if (key === 'onSendMessage' || key === 'onExpand') {
      continue;
    }

    const nextValue = sanitizeFirestoreValue((value as Record<string, unknown>)[key], seen);
    if (nextValue !== undefined) {
      result[key] = nextValue;
    }
  }

  return result;
}

export function sanitizeCanvasForFirestore(canvas: Canvas, ownerId: string) {
  return sanitizeFirestoreValue({
    id: canvas.id,
    name: canvas.name,
    createdAt: canvas.createdAt,
    lastModified: Date.now(),
    nodes: canvas.nodes,
    edges: canvas.edges,
    folderId: canvas.folderId ?? null,
    folderName: canvas.folderName ?? null,
    isIncognito: Boolean(canvas.isIncognito),
    ownerId,
  });
}
