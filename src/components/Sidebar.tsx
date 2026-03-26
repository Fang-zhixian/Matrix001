import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronUp,
  Edit2,
  EyeOff,
  Folder,
  FolderOpen,
  FolderPlus,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  MoveRight,
  PanelLeft,
  Search,
  Settings2,
  Trash2,
  User,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import useStore, { Canvas, ConversationNodeData, SidebarFolder } from '../store';

const SIDEBAR_WIDTH = 292;

const Sidebar = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
  const {
    canvases,
    sidebarFolders,
    currentCanvasId,
    setCurrentCanvas,
    addCanvas,
    deleteCanvas,
    updateCanvasName,
    createSidebarFolder,
    renameSidebarFolder,
    deleteSidebarFolder,
    moveCanvasToFolder,
    user,
  } = useStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingCanvasId, setEditingCanvasId] = useState<string | null>(null);
  const [deletingCanvasId, setDeletingCanvasId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [moveMenuCanvasId, setMoveMenuCanvasId] = useState<string | null>(null);
  const [canvasEditValue, setCanvasEditValue] = useState('');
  const [groupEditValue, setGroupEditValue] = useState('');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [draggingCanvasId, setDraggingCanvasId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | 'chat' | null>(null);

  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
        setMoveMenuCanvasId(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const visibleCanvases = useMemo(
    () => canvases.filter((canvas) => !canvas.isIncognito),
    [canvases]
  );

  const groups = useMemo(() => {
    const folderMap = new Map<string, SidebarFolder>();

    sidebarFolders.forEach((folder) => {
      folderMap.set(folder.id, folder);
    });

    visibleCanvases.forEach((canvas) => {
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
  }, [sidebarFolders, visibleCanvases]);

  useEffect(() => {
    if (selectedGroupId && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, selectedGroupId]);

  useEffect(() => {
    if (selectedGroupId && !showAllGroups) {
      const topThreeIds = groups.slice(0, 3).map((group) => group.id);
      if (!topThreeIds.includes(selectedGroupId)) {
        setShowAllGroups(true);
      }
    }
  }, [groups, selectedGroupId, showAllGroups]);

  const getChatLabel = (canvas: Canvas) => {
    if (!/^Untitled Canvas \d+$/.test(canvas.name) && canvas.name !== 'Private Chat') {
      return canvas.name;
    }

    for (const node of canvas.nodes) {
      if (node.type !== 'conversation') continue;
      const data = node.data as ConversationNodeData;
      const message = data.messages.find((item) => item.role === 'user' && item.content.trim().length > 0);
      if (message) {
        return message.content.replace(/\s+/g, ' ').trim();
      }
    }

    return canvas.name;
  };

  const matchesSearch = (canvas: Canvas) => {
    if (!searchQuery.trim()) return true;
    const keyword = searchQuery.trim().toLowerCase();
    if (getChatLabel(canvas).toLowerCase().includes(keyword)) return true;

    return canvas.nodes.some((node) => {
      if (node.type !== 'conversation') return false;
      const data = node.data as ConversationNodeData;
      return data.messages.some((message) => message.content.toLowerCase().includes(keyword));
    });
  };

  const chats = useMemo(() => {
    return visibleCanvases
      .filter(matchesSearch)
      .sort((a, b) => b.lastModified - a.lastModified);
  }, [visibleCanvases, searchQuery]);

  const visibleGroups = showAllGroups ? groups : groups.slice(0, 3);
  const hiddenGroupCount = Math.max(groups.length - 3, 0);

  const getGroupChatCount = (groupId: string) =>
    visibleCanvases.filter((canvas) => canvas.folderId === groupId).length;

  const closeCanvasModes = () => {
    setEditingCanvasId(null);
    setDeletingCanvasId(null);
    setMoveMenuCanvasId(null);
  };

  const closeGroupModes = () => {
    setEditingGroupId(null);
    setDeletingGroupId(null);
  };

  const handleCreateGroup = () => {
    const groupId = createSidebarFolder(newGroupName.trim() || undefined);
    setShowAllGroups(true);
    setSelectedGroupId(groupId);
    setIsCreatingGroup(false);
    setNewGroupName('');
  };

  const handleCanvasDragStart = (event: React.DragEvent<HTMLDivElement>, canvasId: string) => {
    setDraggingCanvasId(canvasId);
    setMoveMenuCanvasId(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', canvasId);
  };

  const handleCanvasDragEnd = () => {
    setDraggingCanvasId(null);
    setDragOverTarget(null);
  };

  const handleDropTarget = (event: React.DragEvent<HTMLElement>, target: string | 'chat') => {
    if (!draggingCanvasId) return;
    event.preventDefault();
    moveCanvasToFolder(draggingCanvasId, target === 'chat' ? null : target);
    if (target !== 'chat') {
      setSelectedGroupId(target);
      setShowAllGroups(true);
    }
    setDraggingCanvasId(null);
    setDragOverTarget(null);
  };

  const renderMoveMenu = (canvas: Canvas) => {
    if (moveMenuCanvasId !== canvas.id) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        className="absolute right-2 top-11 z-30 w-[218px] rounded-[1rem] border border-[#d9d9dc] bg-white/98 p-2 shadow-[0_18px_40px_rgba(25,28,34,0.12)]"
      >
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Move To Group
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            moveCanvasToFolder(canvas.id, null);
            setMoveMenuCanvasId(null);
          }}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
            !canvas.folderId ? 'bg-[#111827]/6 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Chat</span>
          {!canvas.folderId && <Check className="w-4 h-4" />}
        </button>
        {groups.map((group) => (
          <button
            key={group.id}
            onClick={(event) => {
              event.stopPropagation();
              moveCanvasToFolder(canvas.id, group.id);
              setMoveMenuCanvasId(null);
              setSelectedGroupId(group.id);
            }}
            className={`mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
              canvas.folderId === group.id ? 'bg-[#111827]/6 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder className="w-4 h-4" />
              <span className="truncate">{group.name}</span>
            </div>
            {canvas.folderId === group.id && <Check className="w-4 h-4" />}
          </button>
        ))}
      </motion.div>
    );
  };

  const renderChatRow = (canvas: Canvas) => {
    const isActive = canvas.id === currentCanvasId;
    const label = getChatLabel(canvas);

    return (
      <div
        key={canvas.id}
        draggable={editingCanvasId !== canvas.id && deletingCanvasId !== canvas.id}
        onDragStart={(event) => handleCanvasDragStart(event, canvas.id)}
        onDragEnd={handleCanvasDragEnd}
      >
        <div
          onClick={() => {
            setCurrentCanvas(canvas.id);
            setMoveMenuCanvasId(null);
          }}
          className={`group relative rounded-[0.95rem] px-2 py-1.5 transition-all ${
            isActive ? 'bg-black/[0.05] text-slate-900' : 'text-slate-700 hover:bg-black/[0.03]'
          } ${draggingCanvasId === canvas.id ? 'opacity-50' : ''}`}
        >
          {editingCanvasId === canvas.id ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={canvasEditValue}
                onChange={(event) => setCanvasEditValue(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-700 outline-none"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === 'Enter' && canvasEditValue.trim()) {
                    updateCanvasName(canvas.id, canvasEditValue.trim());
                    setEditingCanvasId(null);
                  }
                  if (event.key === 'Escape') setEditingCanvasId(null);
                }}
              />
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (canvasEditValue.trim()) updateCanvasName(canvas.id, canvasEditValue.trim());
                  setEditingCanvasId(null);
                }}
                className="rounded-md p-1 text-slate-500 hover:bg-black/[0.04]"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : deletingCanvasId === canvas.id ? (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[12px] text-red-500">Delete this chat?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteCanvas(canvas.id);
                    setDeletingCanvasId(null);
                  }}
                  className="rounded-md bg-red-500 px-2 py-1 text-[10px] font-semibold text-white"
                >
                  Delete
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeletingCanvasId(null);
                  }}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate pr-12 text-[14px] leading-6">{label}</span>
                <div className="absolute right-1 top-1 hidden items-center gap-0.5 rounded-full bg-white/92 px-1 py-0.5 shadow-sm group-hover:flex">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setMoveMenuCanvasId((current) => (current === canvas.id ? null : canvas.id));
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-black/[0.04] hover:text-slate-700"
                  >
                    <MoveRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      closeGroupModes();
                      setCanvasEditValue(canvas.name);
                      setDeletingCanvasId(null);
                      setEditingCanvasId(canvas.id);
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-black/[0.04] hover:text-slate-700"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      closeGroupModes();
                      setEditingCanvasId(null);
                      setDeletingCanvasId(canvas.id);
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <AnimatePresence>{renderMoveMenu(canvas)}</AnimatePresence>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderGroupChatRow = (canvas: Canvas) => {
    const isActive = canvas.id === currentCanvasId;
    const label = getChatLabel(canvas);

    return (
      <button
        key={`${canvas.id}_group`}
        onClick={(event) => {
          event.stopPropagation();
          setCurrentCanvas(canvas.id);
          setMoveMenuCanvasId(null);
        }}
        className={`flex w-full items-center gap-2 rounded-[0.85rem] px-2 py-1.5 text-left transition ${
          isActive ? 'bg-black/[0.05] text-slate-900' : 'text-slate-600 hover:bg-black/[0.03]'
        }`}
        type="button"
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate text-[13px] leading-5">{label}</span>
      </button>
    );
  };

  const renderGroupRow = (group: SidebarFolder) => {
    const isActive = selectedGroupId === group.id;
    const chatCount = getGroupChatCount(group.id);
    const groupChats = visibleCanvases
      .filter((canvas) => canvas.folderId === group.id)
      .filter(matchesSearch)
      .sort((a, b) => b.lastModified - a.lastModified);

    return (
      <div
        key={group.id}
        onDragOver={(event) => {
          if (!draggingCanvasId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDragOverTarget(group.id);
        }}
        onDragLeave={() => {
          if (dragOverTarget === group.id) setDragOverTarget(null);
        }}
        onDrop={(event) => handleDropTarget(event, group.id)}
      >
        <div
          onClick={() => setSelectedGroupId((current) => (current === group.id ? null : group.id))}
          className={`group flex items-center gap-3 rounded-[0.95rem] px-2 py-2 transition-all ${
            dragOverTarget === group.id
              ? 'bg-[#0071e3]/7 text-[#0071e3]'
              : isActive
                ? 'bg-black/[0.05] text-slate-900'
                : 'text-slate-700 hover:bg-black/[0.03]'
          }`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white shadow-sm">
            {isActive ? <FolderOpen className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
          </div>

          {editingGroupId === group.id ? (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                autoFocus
                value={groupEditValue}
                onChange={(event) => setGroupEditValue(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-700 outline-none"
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === 'Enter' && groupEditValue.trim()) {
                    renameSidebarFolder(group.id, groupEditValue.trim());
                    setEditingGroupId(null);
                  }
                  if (event.key === 'Escape') setEditingGroupId(null);
                }}
              />
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  if (groupEditValue.trim()) renameSidebarFolder(group.id, groupEditValue.trim());
                  setEditingGroupId(null);
                }}
                className="rounded-md p-1 text-slate-500 hover:bg-black/[0.04]"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : deletingGroupId === group.id ? (
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <span className="truncate text-[12px] text-red-500">Remove group?</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSidebarFolder(group.id);
                    setDeletingGroupId(null);
                    if (selectedGroupId === group.id) setSelectedGroupId(null);
                  }}
                  className="rounded-md bg-red-500 px-2 py-1 text-[10px] font-semibold text-white"
                >
                  Delete
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeletingGroupId(null);
                  }}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] leading-6">{group.name}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-400">{chatCount}</span>
                <div className="hidden items-center gap-0.5 rounded-full bg-white/92 px-1 py-0.5 shadow-sm group-hover:flex">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      closeCanvasModes();
                      setDeletingGroupId(null);
                      setGroupEditValue(group.name);
                      setEditingGroupId(group.id);
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-black/[0.04] hover:text-slate-700"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      closeCanvasModes();
                      setEditingGroupId(null);
                      setDeletingGroupId(group.id);
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <AnimatePresence initial={false}>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-1 space-y-1 border-l border-slate-200/80 pl-4 ml-5">
                {groupChats.length > 0 ? (
                  groupChats.map(renderGroupChatRow)
                ) : (
                  <div className="px-2 py-2 text-[12px] text-slate-400">
                    This group is empty for now.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      <motion.aside
        ref={sidebarRef}
        animate={{
          width: isCollapsed ? 0 : SIDEBAR_WIDTH,
          opacity: isCollapsed ? 0 : 1,
          x: isCollapsed ? -SIDEBAR_WIDTH : 0,
        }}
        transition={{ type: 'spring', damping: 24, stiffness: 210 }}
        className="relative z-20 flex h-full flex-col overflow-hidden border-r border-[#e7e7ea] bg-[#f7f7f8]/96 shadow-[0_8px_24px_rgba(18,22,33,0.04)]"
      >
        <div className="border-b border-[#e6e6ea] px-4 pb-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCollapsed(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-black/[0.04]"
              title="Hide history"
            >
              <PanelLeft className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => addCanvas()}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-black/[0.04]"
              title="New chat"
            >
              <MessageSquarePlus className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => addCanvas({ incognito: true })}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-black/[0.04]"
              title="Private chat"
            >
              <EyeOff className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              className="h-10 w-full rounded-[0.95rem] border border-[#e1e1e5] bg-[#efeff1] pl-10 pr-3 text-[15px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#d1d1d6]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <button
                onClick={() => setSelectedGroupId(null)}
                className={`text-[13px] font-semibold transition ${selectedGroupId ? 'text-slate-400 hover:text-slate-700' : 'text-slate-600'}`}
              >
                Group
              </button>
              <button
                onClick={() => setIsCreatingGroup((current) => !current)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-black/[0.04] hover:text-slate-700"
                title="New group"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            <AnimatePresence>
              {isCreatingGroup && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mb-2 rounded-[1rem] border border-[#e3e3e7] bg-white px-2 py-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      placeholder="Group name"
                      className="h-9 w-full rounded-xl bg-[#f5f5f6] px-3 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
                      onKeyDown={(event) => {
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter') handleCreateGroup();
                        if (event.key === 'Escape') {
                          setIsCreatingGroup(false);
                          setNewGroupName('');
                        }
                      }}
                    />
                    <button
                      onClick={handleCreateGroup}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white"
                    >
                      Add
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              {visibleGroups.map(renderGroupRow)}

              {!showAllGroups && hiddenGroupCount > 0 && (
                <button
                  onClick={() => setShowAllGroups(true)}
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-2 py-2 text-left text-slate-700 transition hover:bg-black/[0.03]"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Folder className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[14px]">More Group ({hiddenGroupCount})</span>
                </button>
              )}

              {groups.length === 0 && (
                <div className="px-2 py-2 text-[13px] text-slate-400">
                  Create a group, then drag chats into it.
                </div>
              )}
            </div>
          </section>

          <section
            className={`mt-6 rounded-[1rem] transition-all ${
              dragOverTarget === 'chat' ? 'bg-[#111827]/[0.03]' : ''
            }`}
            onDragOver={(event) => {
              if (!draggingCanvasId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverTarget('chat');
            }}
            onDragLeave={() => {
              if (dragOverTarget === 'chat') setDragOverTarget(null);
            }}
            onDrop={(event) => handleDropTarget(event, 'chat')}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <div className="text-[13px] font-semibold text-slate-600">Chat</div>
              <div className="text-[12px] text-slate-400">{chats.length}</div>
            </div>

            <div className="space-y-0.5">
              {chats.map(renderChatRow)}

              {chats.length === 0 && (
                <div className="px-2 py-2 text-[13px] text-slate-400">
                  {searchQuery.trim()
                    ? 'No chat matches your search.'
                    : 'Your chat history will appear here.'}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="border-t border-[#e6e6ea] px-3 py-3">
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-[1rem] px-2 py-2 transition hover:bg-black/[0.03]"
            >
              <div className="flex min-w-0 items-center gap-3">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="h-9 w-9 rounded-[0.9rem]" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-white shadow-sm">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <div className="truncate text-[13px] font-medium text-slate-700">{user?.displayName || 'Workspace'}</div>
                  <div className="text-[11px] text-slate-400">Open menu</div>
                </div>
              </div>
              {isProfileMenuOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronLeft className="w-4 h-4 -rotate-90 text-slate-400" />
              )}
            </button>

            <AnimatePresence>
              {isProfileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  className="absolute bottom-[calc(100%+8px)] left-0 right-0 rounded-[1rem] border border-[#e0e0e4] bg-white p-2 shadow-[0_18px_40px_rgba(25,28,34,0.12)]"
                >
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[14px] text-slate-700 transition hover:bg-black/[0.03]"
                  >
                    <Settings2 className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      <AnimatePresence>
        {isCollapsed && (
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={() => setIsCollapsed(false)}
            className="fixed left-5 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-[#e3e3e7] bg-white text-slate-600 shadow-[0_10px_24px_rgba(25,28,34,0.08)] transition hover:bg-slate-50"
            title="Show history"
          >
            <Menu className="w-4.5 h-4.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
