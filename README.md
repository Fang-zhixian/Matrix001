<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Matrix001

Matrix001 is now structured as a frontend + backend application:

- `src/`: React + Vite frontend
- `server/`: Express API server
- `shared/`: shared contracts used by both sides

The backend now owns:

- account registration and login
- httpOnly session cookies
- Supabase/Postgres-backed workspace persistence
- plan / quota state
- model credential resolution
- model streaming and usage accounting

## Local Development

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` from [.env.example](/Users/zhixian/Desktop/gemini-canvas2/.env.example)
3. Start the backend:
   `npm run dev:server`
4. Start the frontend in another terminal:
   `npm run dev`

The frontend talks to the backend through `/api/*` and no longer calls model vendors directly from the browser.

## Environment Notes

Important backend environment variables:

- `APP_DEPLOYMENT_MODE`
  - `self-hosted`: guest access is allowed by default and BYOK stays enabled unless disabled
  - `saas`: platform-managed model access can be gated by plans and login
- `APP_ENABLE_BYOK`
  - set to `false` if you do not want end users to store their own provider keys
- `APP_ALLOW_GUEST`
  - explicitly allow or disable guest workspaces
- `DATABASE_URL` / `SUPABASE_DB_URL`
  - Postgres connection string used by the backend
  - for Supabase, use the pooled Postgres connection string
- `APP_LEGACY_SQLITE_PATH`
  - optional one-time source file for migrating the old local SQLite workspace store into Postgres

Credential behavior:

- `PLATFORM_*` keys are preferred for platform-managed SaaS access
- plain `GEMINI_API_KEY`, `QWEN_API_KEY`, etc. act as shared environment credentials, especially useful for self-hosted deployments

Database behavior:

- the backend initializes its Postgres schema at startup
- old JSON workspace files and the previous local SQLite file can be migrated into Postgres on first boot if the database is empty
- workspace and session state is now server-owned instead of browser-owned

## Supabase Setup

For the fastest path to production, create a Supabase project and copy its Postgres connection string into `DATABASE_URL` or `SUPABASE_DB_URL`.

Recommended setup:

1. Create a Supabase project
2. Open the database connection settings in Supabase
3. Copy the pooled Postgres connection string
4. Put it in `.env.local` as:
   `DATABASE_URL="postgresql://..."`
5. Start the backend:
   `npm run dev:server`

The backend will:

- connect directly to Supabase Postgres
- create missing tables and indexes
- seed default plans
- optionally migrate old local workspace data if the new database is empty

## Auth & Billing

The product now includes:

- user registration and login through backend APIs
- httpOnly cookie sessions
- owned workspaces
- guest fallback in self-hosted mode
- plan switching with token/message quotas
- usage accounting hooks for platform-managed model calls

The current product surface exposes these flows from the sidebar account menu:

- `Sign In` / `Create Account`
- `Account`
- `Billing`
- `Settings`

## Production Build

1. Build frontend and backend:
   `npm run build`
2. Start the production server:
   `npm run start`

The production server serves the built frontend from `dist/` and exposes the backend API from the same origin.

## Production Caveats

The current stack is much closer to production than the earlier frontend-direct version, but there are still two important follow-up items before a public paid launch:

- payment processor integration is not wired yet
- storage has moved to Postgres, but file uploads are still not backed by a managed object store such as Supabase Storage

## Provider Extension Guide

If you want to add a new AI provider, model, or logo, see:

- [docs/add-provider-and-logo.md](/Users/zhixian/Desktop/gemini-canvas2/docs/add-provider-and-logo.md)
- [docs/dual-mode-architecture-checklist.md](/Users/zhixian/Desktop/gemini-canvas2/docs/dual-mode-architecture-checklist.md)
