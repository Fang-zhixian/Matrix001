import type { Canvas, ConversationNodeData, SidebarFolder } from '../types/canvas';

const UNTITLED_CANVAS_PATTERN = /^Untitled Canvas \d+$/;

export function getChatLabel(canvas: Canvas) {
  if (!UNTITLED_CANVAS_PATTERN.test(canvas.name) && canvas.name !== 'Private Chat') {
    return canvas.name;
  }

  for (const node of canvas.nodes) {
    if (node.type !== 'conversation') {
      continue;
    }

    const data = node.data as ConversationNodeData;
    const message = data.messages.find((item) => item.role === 'user' && item.content.trim().length > 0);
    if (message) {
      return message.content.replace(/\s+/g, ' ').trim();
    }
  }

  return canvas.name;
}

export function canvasMatchesSearch(canvas: Canvas, searchQuery: string) {
  if (!searchQuery.trim()) {
    return true;
  }

  const keyword = searchQuery.trim().toLowerCase();
  if (getChatLabel(canvas).toLowerCase().includes(keyword)) {
    return true;
  }

  return canvas.nodes.some((node) => {
    if (node.type !== 'conversation') {
      return false;
    }

    const data = node.data as ConversationNodeData;
    return data.messages.some((message) => message.content.toLowerCase().includes(keyword));
  });
}

export function sortCanvasesByLastModified(canvases: Canvas[]) {
  return [...canvases].sort((a, b) => b.lastModified - a.lastModified);
}

export function deriveSidebarGroups(sidebarFolders: SidebarFolder[], canvases: Canvas[]) {
  const folderMap = new Map<string, SidebarFolder>();

  sidebarFolders.forEach((folder) => {
    folderMap.set(folder.id, folder);
  });

  canvases.forEach((canvas) => {
    if (canvas.folderId && canvas.folderName && !folderMap.has(canvas.folderId)) {
      folderMap.set(canvas.folderId, {
        id: canvas.folderId,
        name: canvas.folderName,
        createdAt: canvas.createdAt,
        lastModified: canvas.lastModified,
      });
    }
  });

  return Array.from(folderMap.values()).sort((a, b) => b.lastModified - a.lastModified);
}

export function getGroupChats(canvases: Canvas[], groupId: string, searchQuery: string) {
  return sortCanvasesByLastModified(
    canvases.filter((canvas) => canvas.folderId === groupId && canvasMatchesSearch(canvas, searchQuery))
  );
}
