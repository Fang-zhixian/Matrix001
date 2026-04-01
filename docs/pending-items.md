# Pending Items

## P0

- [ ] Delete undo is still not verified as working
  Problem: the current undo flow has been refactored several times, but the user still reports that the undo button and `Cmd/Ctrl + Z` are not appearing or not responding reliably.
  Suggested direction: trace the actual delete trigger path in the running UI, verify whether the delete action reaches the local snapshot path in `App`, and reduce the implementation to a single source of truth for delete/restore.
  Files: `src/App.tsx`, `src/store.ts`, `src/components/ContextMenu.tsx`

- [ ] Deletion semantics are ambiguous when a node is right-clicked while other nodes are selected
  Problem: the context menu delete action currently prefers deleting the selected set when `selectedCount > 0`, which may not match the user's expectation of deleting the node they just right-clicked.
  Suggested direction: define one rule explicitly, either "delete right-clicked node only" or "delete selection if target is within selection", then implement it consistently.
  Files: `src/App.tsx`, `src/components/ContextMenu.tsx`

## P1

- [ ] Backend session/bootstrap lifecycle still needs polish
  Problem: the app now bootstraps through the backend, but workspace initialization, recovery, and future authenticated session handling still need a cleaner central ownership model.
  Suggested direction: keep workspace bootstrap in one place, formalize revalidation and failure recovery, and prepare the path for real authenticated accounts.
  Files: `src/store.ts`, `src/App.tsx`, `server/src/routes/api.ts`

- [ ] Firestore sync strategy is still too chatty
  Problem: many canvas mutations save immediately, which is functional but not efficient and will become noisy under frequent edits or multiple tabs.
  Suggested direction: add debounced persistence for non-critical updates and keep immediate sync only for actions that truly require it.
  Files: `src/store.ts`

- [ ] Provider capability rules are only partially modeled
  Problem: image/PDF support is currently gated by a hand-maintained capability list, but not every provider/model combination has been validated end-to-end.
  Suggested direction: complete the capability matrix and add provider-specific validation messaging where actual API support differs.
  Files: `src/lib/modelCatalog.ts`, `src/lib/ai.ts`, `src/App.tsx`

- [ ] Multi-modal PDF path is not fully verified across providers
  Problem: image flow has been tested more thoroughly than PDF flow; PDF behavior likely varies by provider and model.
  Suggested direction: run provider-by-provider validation and mark unsupported combinations explicitly in UI.
  Files: `src/lib/ai.ts`, `src/App.tsx`, `src/components/ConversationNode.tsx`

- [ ] Canvas workspace is not yet lazy-loaded as a separate runtime layer
  Problem: bundle splitting is much better now, but `reactflow` and canvas-specific runtime are still part of the initial app path.
  Suggested direction: split the ready screen / shell from the canvas workspace so the infinite canvas stack loads only when the user actually enters canvas mode.
  Files: `src/App.tsx`, `src/components/CanvasViewport.tsx`, `src/components/ConversationNode.tsx`

## P2

- [ ] No automated regression coverage for canvas editing flows
  Problem: branch creation, delete/undo, archive/unarchive, and multi-provider composer behavior are currently protected only by manual checking.
  Suggested direction: add focused tests around store mutations and a small number of UI integration tests for critical flows.
  Files: `src/store.ts`, `src/App.tsx`, `src/components/ChatComposer.tsx`

- [ ] Settings and composer still mix Chinese and English copy
  Problem: the UI language is not fully consistent, especially in system labels, provider descriptions, and helper notices.
  Suggested direction: decide on one product language strategy and normalize copy.
  Files: `src/components/ChatComposer.tsx`, `src/components/ModelSettingsPanel.tsx`, `src/components/ContextMenu.tsx`

- [ ] Expanded composer and model menu need mobile-specific verification
  Problem: the current layout is built for desktop first, but the expanded composer and floating menu have not been explicitly validated for smaller screens.
  Suggested direction: test narrow widths, constrain modal height more aggressively, and ensure the menu never renders off-screen.
  Files: `src/components/ChatComposer.tsx`
