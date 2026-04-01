import { createHash, randomBytes } from 'node:crypto';
import type { Response, Request } from 'express';

export const SESSION_COOKIE_NAME = 'matrix001_session';
const DEFAULT_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export function parseCookies(request: Request) {
  const header = request.headers.cookie;
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(';').map((part) => {
      const [name, ...rest] = part.trim().split('=');
      return [name, decodeURIComponent(rest.join('='))];
    })
  );
}

export function getSessionTokenFromRequest(request: Request) {
  return parseCookies(request)[SESSION_COOKIE_NAME] ?? null;
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function setSessionCookie(response: Response, token: string, maxAgeMs = DEFAULT_SESSION_MAX_AGE_MS) {
  response.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
