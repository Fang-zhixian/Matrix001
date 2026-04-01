import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { EyeOff, Folder, FolderPlus, Menu, MessageSquarePlus, PanelLeft, Search } from 'lucide-react';
import useStore from '../store';
import {
  canvasMatchesSearch,
  deriveSidebarGroups,
  getChatLabel,
  getGroupChats,
  sortCanvasesByLastModified,
} from '../lib/sidebarSelectors';
import SidebarChatRow from './sidebar/SidebarChatRow';
import SidebarGroupRow from './sidebar/SidebarGroupRow';
import SidebarProfileMenu from './sidebar/SidebarProfileMenu';

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

  const groups = useMemo(
    () => deriveSidebarGroups(sidebarFolders, visibleCanvases),
    [sidebarFolders, visibleCanvases]
  );

  const chats = useMemo(
    () => sortCanvasesByLastModified(visibleCanvases.filter((canvas) => canvasMatchesSearch(canvas, searchQuery))),
    [searchQuery, visibleCanvases]
  );

  const groupChatsById = useMemo(
    () =>
      new Map(
        groups.map((group) => [group.id, getGroupChats(visibleCanvases, group.id, searchQuery)])
      ),
    [groups, searchQuery, visibleCanvases]
  );
  const groupChatCountById = useMemo(
    () =>
      new Map(
        groups.map((group) => [
          group.id,
          visibleCanvases.filter((canvas) => canvas.folderId === group.id).length,
        ])
      ),
    [groups, visibleCanvases]
  );

  const visibleGroups = showAllGroups ? groups : groups.slice(0, 3);
  const hiddenGroupCount = Math.max(groups.length - 3, 0);

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

  const commitCanvasRename = () => {
    if (!editingCanvasId || !canvasEditValue.trim()) {
      setEditingCanvasId(null);
      return;
    }

    updateCanvasName(editingCanvasId, canvasEditValue.trim());
    setEditingCanvasId(null);
  };

  const commitGroupRename = () => {
    if (!editingGroupId || !groupEditValue.trim()) {
      setEditingGroupId(null);
      return;
    }

    renameSidebarFolder(editingGroupId, groupEditValue.trim());
    setEditingGroupId(null);
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
              type="button"
            >
              <PanelLeft className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => addCanvas()}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-black/[0.04]"
              title="New chat"
              type="button"
            >
              <MessageSquarePlus className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => addCanvas({ incognito: true })}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-black/[0.04]"
              title="Private chat"
              type="button"
            >
              <EyeOff className="h-4.5 w-4.5" />
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
                className={`text-[13px] font-semibold transition ${
                  selectedGroupId ? 'text-slate-400 hover:text-slate-700' : 'text-slate-600'
                }`}
                type="button"
              >
                Group
              </button>
              <button
                onClick={() => setIsCreatingGroup((current) => !current)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-black/[0.04] hover:text-slate-700"
                title="New group"
                type="button"
              >
                <FolderPlus className="h-4 w-4" />
              </button>
            </div>

            <AnimatePresence>
              {isCreatingGroup ? (
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
                      type="button"
                    >
                      Add
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="space-y-1">
              {visibleGroups.map((group) => (
                <SidebarGroupRow
                  key={group.id}
                  group={group}
                  chatCount={groupChatCountById.get(group.id) ?? 0}
                  groupChats={groupChatsById.get(group.id) ?? []}
                  currentCanvasId={currentCanvasId}
                  isExpanded={selectedGroupId === group.id}
                  isDragOver={dragOverTarget === group.id}
                  isEditing={editingGroupId === group.id}
                  isDeleting={deletingGroupId === group.id}
                  editValue={groupEditValue}
                  onToggleExpand={() => setSelectedGroupId((current) => (current === group.id ? null : group.id))}
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
                  onEditValueChange={setGroupEditValue}
                  onCommitEdit={commitGroupRename}
                  onCancelEdit={() => setEditingGroupId(null)}
                  onStartEdit={() => {
                    closeCanvasModes();
                    setDeletingGroupId(null);
                    setGroupEditValue(group.name);
                    setEditingGroupId(group.id);
                  }}
                  onStartDelete={() => {
                    closeCanvasModes();
                    setEditingGroupId(null);
                    setDeletingGroupId(group.id);
                  }}
                  onConfirmDelete={() => {
                    deleteSidebarFolder(group.id);
                    setDeletingGroupId(null);
                    if (selectedGroupId === group.id) {
                      setSelectedGroupId(null);
                    }
                  }}
                  onCancelDelete={() => setDeletingGroupId(null)}
                  onSelectCanvas={(canvasId) => {
                    setCurrentCanvas(canvasId);
                    setMoveMenuCanvasId(null);
                  }}
                  getChatLabel={getChatLabel}
                />
              ))}

              {!showAllGroups && hiddenGroupCount > 0 ? (
                <button
                  onClick={() => setShowAllGroups(true)}
                  className="flex w-full items-center gap-3 rounded-[0.95rem] px-2 py-2 text-left text-slate-700 transition hover:bg-black/[0.03]"
                  type="button"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Folder className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[14px]">More Group ({hiddenGroupCount})</span>
                </button>
              ) : null}

              {groups.length === 0 ? (
                <div className="px-2 py-2 text-[13px] text-slate-400">
                  Create a group, then drag chats into it.
                </div>
              ) : null}
            </div>
          </section>

          <section
            className={`mt-6 rounded-[1rem] transition-all ${dragOverTarget === 'chat' ? 'bg-[#111827]/[0.03]' : ''}`}
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
              {chats.map((canvas) => (
                <SidebarChatRow
                  key={canvas.id}
                  canvas={canvas}
                  label={getChatLabel(canvas)}
                  groups={groups}
                  isActive={canvas.id === currentCanvasId}
                  isDragging={draggingCanvasId === canvas.id}
                  isEditing={editingCanvasId === canvas.id}
                  isDeleting={deletingCanvasId === canvas.id}
                  isMoveMenuOpen={moveMenuCanvasId === canvas.id}
                  editValue={canvasEditValue}
                  onSelect={() => {
                    setCurrentCanvas(canvas.id);
                    setMoveMenuCanvasId(null);
                  }}
                  onDragStart={(event) => handleCanvasDragStart(event, canvas.id)}
                  onDragEnd={handleCanvasDragEnd}
                  onToggleMoveMenu={() =>
                    setMoveMenuCanvasId((current) => (current === canvas.id ? null : canvas.id))
                  }
                  onStartEdit={() => {
                    closeGroupModes();
                    setCanvasEditValue(canvas.name);
                    setDeletingCanvasId(null);
                    setEditingCanvasId(canvas.id);
                  }}
                  onEditValueChange={setCanvasEditValue}
                  onCommitEdit={commitCanvasRename}
                  onCancelEdit={() => setEditingCanvasId(null)}
                  onStartDelete={() => {
                    closeGroupModes();
                    setEditingCanvasId(null);
                    setDeletingCanvasId(canvas.id);
                  }}
                  onConfirmDelete={() => {
                    deleteCanvas(canvas.id);
                    setDeletingCanvasId(null);
                  }}
                  onCancelDelete={() => setDeletingCanvasId(null)}
                  onMoveToChat={() => {
                    moveCanvasToFolder(canvas.id, null);
                    setMoveMenuCanvasId(null);
                  }}
                  onMoveToGroup={(groupId) => {
                    moveCanvasToFolder(canvas.id, groupId);
                    setMoveMenuCanvasId(null);
                    setSelectedGroupId(groupId);
                  }}
                />
              ))}

              {chats.length === 0 ? (
                <div className="px-2 py-2 text-[13px] text-slate-400">
                  {searchQuery.trim() ? 'No chat matches your search.' : 'Your chat history will appear here.'}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="border-t border-[#e6e6ea] px-3 py-3">
          <SidebarProfileMenu
            isOpen={isProfileMenuOpen}
            user={user}
            onToggle={() => setIsProfileMenuOpen((current) => !current)}
            onOpenSettings={() => {
              setIsProfileMenuOpen(false);
              onOpenSettings();
            }}
          />
        </div>
      </motion.aside>

      <AnimatePresence>
        {isCollapsed ? (
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            onClick={() => setIsCollapsed(false)}
            className="fixed left-5 top-5 z-30 flex h-10 w-10 items-center justify-center rounded-xl border border-[#e3e3e7] bg-white text-slate-600 shadow-[0_10px_24px_rgba(25,28,34,0.08)] transition hover:bg-slate-50"
            title="Show history"
            type="button"
          >
            <Menu className="h-4.5 w-4.5" />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
