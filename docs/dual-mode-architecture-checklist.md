# Dual-Mode Architecture Checklist

This checklist is for evolving the current project into a dual-mode product:

- `SaaS mode`: users pay for access and the platform provides model usage.
- `Self-hosted / BYOK mode`: users deploy it themselves and use their own API keys.

The recommended long-term rule is:

`Frontend -> your backend -> model providers`

The frontend should no longer call model vendors directly.

## Target Outcome

- [x] One frontend supports both `platform-managed credentials` and `user-provided credentials`.
- [x] API keys are never permanently stored in browser state.
- [x] All model calls stream through one backend contract.
- [ ] File upload, image understanding, PDF support, and reasoning output are normalized by backend adapters.
- [x] Canvas/chat persistence can run in SaaS mode and self-hosted mode with the same frontend.

## Current State

These parts were the original frontend-direct paths. The model path and persistence path now run behind the backend, and the remaining work should continue from the new API layer:

- `src/lib/ai.ts`
- parts of `src/App.tsx`
- parts of `src/store.ts`

These parts are already frontend-only and should mostly stay in the frontend:

- `src/components/CanvasViewport.tsx`
- `src/components/ChatComposer.tsx`
- `src/components/ConversationNode.tsx`
- `src/components/Sidebar.tsx`
- `src/components/AttachmentPreviewModal.tsx`
- `src/lib/nodeLayout.ts`
- `src/lib/startNode.ts`

## Architecture Decision

Use a BFF layer.

- Frontend:
  - canvas UI
  - composer UI
  - file preview UI
  - streaming rendering
  - local interaction state
- Backend:
  - auth/session
  - provider/model registry
  - credential resolution
  - file upload and storage
  - model routing
  - streaming proxy
  - usage accounting
  - canvas persistence API

## Phase 0: Freeze the Contract

- [x] Define a single backend stream contract for all models.
- [x] Define a single model metadata contract for all providers.
- [x] Define one credential resolution strategy.
- [x] Decide the first auth mode for rollout.

Recommended contracts:

- `GET /api/models`
  - returns `provider`, `model`, `logo`, `supportsImage`, `supportsPdf`, `supportsReasoning`, `availability`, `credentialMode`
- `POST /api/chat/stream`
  - accepts `canvasId`, `nodeId`, `messages`, `attachments`, `provider`, `model`
  - streams normalized events:
    - `content`
    - `reasoning`
    - `usage`
    - `error`
- `POST /api/files`
  - accepts image/PDF uploads
  - returns backend file references
- `GET /api/canvases`
- `POST /api/canvases`
- `PATCH /api/canvases/:id`
- `DELETE /api/canvases/:id`
- `GET /api/me`

Credential modes to support:

- `platform`
- `user`
- `environment`

## Phase 1: Introduce a Backend Skeleton

- [x] Create a `server/` workspace.
- [x] Add an Express entrypoint.
- [x] Add route modules.
- [x] Add provider adapter modules.
- [x] Add shared API types.

Suggested structure:

- `server/src/index.ts`
- `server/src/routes/chat.ts`
- `server/src/routes/models.ts`
- `server/src/routes/files.ts`
- `server/src/routes/canvases.ts`
- `server/src/routes/auth.ts`
- `server/src/services/ai/`
- `server/src/services/files/`
- `server/src/services/canvases/`
- `server/src/services/auth/`
- `server/src/services/credentials/`
- `server/src/types/api.ts`

## Phase 2: Move Model Calls Behind the Backend

This is the highest-value first migration.

- [x] Move the logic from `src/lib/ai.ts` into backend adapters.
- [x] Create a backend streaming endpoint.
- [x] Update the frontend to call `/api/chat/stream` instead of vendor APIs.
- [x] Keep the existing streaming UI in place.

Current frontend files to change:

- `src/lib/ai.ts`
- `src/App.tsx`
- `src/store.ts`

Backend deliverables:

- [x] `gemini` adapter
- [x] `openai-compatible` adapter
- [x] unified chunk normalizer for `content` and `reasoning`
- [x] provider-aware error normalization

Definition of done:

- [x] Frontend never sends vendor API keys to model vendors directly.
- [x] Existing streaming UX still works.
- [x] Existing reasoning panel still works.

## Phase 3: Move File Upload Behind the Backend

- [ ] Stop sending large file payloads directly from browser to model vendors.
- [ ] Upload files to the backend first.
- [ ] Return a backend file reference.
- [ ] Let adapters decide how each provider consumes the file.

Current frontend files to change:

- `src/components/ChatComposer.tsx`
- `src/lib/attachmentUtils.ts`
- `src/App.tsx`
- `src/types/canvas.ts`

Backend deliverables:

- [ ] file validation
- [ ] MIME normalization
- [ ] size limits
- [ ] temporary or durable storage
- [ ] image/PDF capability checks

Definition of done:

- [ ] frontend no longer depends on inline base64 as the main provider transport
- [ ] provider-specific file behavior is centralized

## Phase 4: Add Credential Resolution for Dual Mode

- [x] Implement one resolver that decides which credential source applies to a request.
- [x] Support SaaS mode and BYOK mode through the same API.
- [x] Store user-provided credentials only on the backend.

Suggested backend rule:

1. If deployment mode is `saas`, use platform credentials.
2. If deployment mode is `self-hosted`, allow environment credentials.
3. If BYOK is enabled for the user, prefer the user's saved credential when selected.

Suggested fields:

- `credentialSource`
- `provider`
- `model`
- `workspaceId`
- `userId`

Definition of done:

- [x] frontend settings page edits backend-managed credentials, not browser-only state
- [x] no long-lived secret stays in Zustand/localStorage

## Phase 5: Move Canvas Persistence Behind the Backend

This can be incremental. Do not block earlier phases on it.

- [x] Replace direct frontend persistence calls with backend APIs.
- [x] Decide whether Firebase remains an implementation detail or is replaced.
- [x] Move ownership of persistence subscriptions out of the browser-vendor direct path.

Legacy frontend files this phase replaces:

- `src/store.ts`
- `src/App.tsx`

Options:

- `Option A`: keep Firebase behind backend service methods
- `Option B`: move to SQL/NoSQL owned by your backend

Decision taken:

- Firebase was removed from the runtime path.
- The backend now owns persistence with Supabase/Postgres.
- Auth, billing, and workspace ownership now share one database layer.

Definition of done:

- [ ] frontend reads and writes canvases through `/api/canvases/*`
- [ ] logout/login/session ownership is centralized

## Phase 6: SaaS-Specific Features

- [x] add user accounts and session handling
- [x] add plan/entitlement checks
- [x] add usage metering
- [x] add cost accounting
- [ ] add rate limiting
- [ ] add abuse protection
- [ ] add request logs and audit trails

New backend concepts:

- `subscriptionPlan`
- `credits`
- `usageRecords`
- `providerCost`
- `requestQuota`

Definition of done:

- [ ] you can charge for usage without exposing vendor keys
- [ ] users can see what models they are allowed to use

## Phase 7: Self-Hosted Productization

- [ ] document `.env` configuration for self-host deploys
- [ ] allow admin-level model registry overrides
- [ ] support environment-managed credentials without any SaaS billing dependency
- [ ] keep the same frontend contract

Self-host mode should support:

- platform disabled
- BYOK enabled
- local model registry config
- local storage config

Definition of done:

- [ ] a self-host user can deploy the app and connect their own provider keys
- [ ] the same frontend build works with a different backend config

## Frontend Refactor Checklist

- [ ] Replace direct provider config use in `src/App.tsx` with `/api/models` response.
- [ ] Replace direct stream logic import path with one frontend API client.
- [ ] Keep `ChatComposer`, `CanvasViewport`, and node rendering vendor-agnostic.
- [ ] Move provider capability display to backend-fed metadata.
- [ ] Keep only UI state in Zustand.

Recommended new frontend modules:

- `src/api/client.ts`
- `src/api/chat.ts`
- `src/api/models.ts`
- `src/api/files.ts`
- `src/api/canvases.ts`

## Backend Refactor Checklist

- [ ] Normalize all vendors to one stream event format.
- [ ] Normalize capability metadata for every model.
- [ ] Centralize error mapping.
- [ ] Centralize credential lookup.
- [ ] Centralize usage accounting.

## Data Model Checklist

- [ ] Add `credentialSource` to requests and saved run metadata.
- [ ] Add `provider` and `model` to stored conversation metadata.
- [ ] Add `usagePromptTokens`, `usageCompletionTokens`, and `usageCost`.
- [ ] Add `supportsImage`, `supportsPdf`, and `supportsReasoning` to model metadata.
- [ ] Add `deploymentMode` config: `saas` or `self-hosted`.

## Recommended Delivery Order

Do the work in this order:

1. Backend skeleton
2. Chat streaming proxy
3. File upload API
4. Credential resolution
5. Models registry API
6. Canvas persistence API
7. Billing and quotas
8. Self-host docs and environment support

## Short-Term MVP Path

If you want the fastest path without overbuilding, do only this first:

- [ ] build `server/`
- [ ] move `src/lib/ai.ts` logic to backend
- [ ] add `/api/chat/stream`
- [ ] change frontend to use the backend stream
- [ ] keep current Firebase path temporarily
- [ ] keep current canvas UI unchanged

That gives you the biggest gain:

- safer key handling
- cleaner multi-provider architecture
- easier future billing
- easier future self-hosting

## Do Not Do Yet

- [ ] do not redesign all canvas UI for this migration
- [ ] do not rebuild Zustand from scratch
- [ ] do not block the backend migration on billing
- [ ] do not block the backend migration on full database replacement

## Definition of Success

The migration is successful when:

- [ ] the browser never talks to model vendors directly
- [ ] one frontend supports SaaS mode and BYOK mode
- [ ] model/file/reasoning behavior is controlled by backend metadata
- [ ] the current canvas UX still works
- [ ] future billing can be added without changing the frontend contract
