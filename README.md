<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Matrix001

Matrix001 is now structured as a frontend + backend application:

- `src/`: React + Vite frontend
- `server/`: Express API server
- `shared/`: shared contracts used by both sides

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

## Production Build

1. Build frontend and backend:
   `npm run build`
2. Start the production server:
   `npm run start`

The production server serves the built frontend from `dist/` and exposes the backend API from the same origin.

## Provider Extension Guide

If you want to add a new AI provider, model, or logo, see:

- [docs/add-provider-and-logo.md](/Users/zhixian/Desktop/gemini-canvas2/docs/add-provider-and-logo.md)
- [docs/dual-mode-architecture-checklist.md](/Users/zhixian/Desktop/gemini-canvas2/docs/dual-mode-architecture-checklist.md)
