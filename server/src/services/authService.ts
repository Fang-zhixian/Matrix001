import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthResponse, AuthUser } from '../../../shared/api.js';
import { getDatabase } from '../storage/database.js';
import {
  clearSessionCookie,
  createSessionToken,
  getSessionTokenFromRequest,
  hashSessionToken,
  setSessionCookie,
} from '../utils/cookies.js';
import { hashPassword, verifyPassword } from '../utils/passwords.js';
import { HttpError } from '../utils/httpError.js';
import { getBillingSummary, ensureUserSubscription } from './billingService.js';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: string | number;
  updated_at: string | number;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string | number;
  created_at: string | number;
  last_seen_at: string | number;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: Number(row.created_at),
  };
}

export async function getUserById(userId: string) {
  const db = await getDatabase();
  const [row] = await db<UserRow[]>`
    SELECT *
    FROM users
    WHERE id = ${userId}
  `;
  return row ? toAuthUser(row) : null;
}

export async function getUserByEmail(email: string) {
  const db = await getDatabase();
  const [row] = await db<UserRow[]>`
    SELECT *
    FROM users
    WHERE lower(email) = lower(${email})
  `;
  return row;
}

async function createSession(userId: string, response: Response) {
  const db = await getDatabase();
  const now = Date.now();
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const sessionId = randomUUID();

  await db`
    INSERT INTO sessions (
      id, user_id, token_hash, expires_at, created_at, last_seen_at
    ) VALUES (
      ${sessionId},
      ${userId},
      ${tokenHash},
      ${now + SESSION_TTL_MS},
      ${now},
      ${now}
    )
  `;

  setSessionCookie(response, token, SESSION_TTL_MS);
}

export async function registerUser(params: {
  email: string;
  password: string;
  displayName: string;
}, response: Response): Promise<AuthResponse> {
  const db = await getDatabase();
  const normalizedEmail = params.email.trim().toLowerCase();
  if (!normalizedEmail || !params.password.trim() || !params.displayName.trim()) {
    throw new HttpError(400, 'Email, password, and display name are required.');
  }

  if (await getUserByEmail(normalizedEmail)) {
    throw new HttpError(409, 'An account with this email already exists.');
  }

  const now = Date.now();
  const userId = randomUUID();
  await db`
    INSERT INTO users (id, email, password_hash, display_name, created_at, updated_at)
    VALUES (
      ${userId},
      ${normalizedEmail},
      ${hashPassword(params.password)},
      ${params.displayName.trim()},
      ${now},
      ${now}
    )
  `;

  await ensureUserSubscription(userId);
  await createSession(userId, response);

  const user = await getUserById(userId);
  if (!user) {
    throw new HttpError(500, 'Failed to create user.');
  }

  return {
    user,
    workspaceId: null,
    billingSummary: await getBillingSummary(userId),
  };
}

export async function loginUser(params: {
  email: string;
  password: string;
}, response: Response): Promise<AuthResponse> {
  const userRow = await getUserByEmail(params.email.trim().toLowerCase());
  if (!userRow || !verifyPassword(params.password, userRow.password_hash)) {
    throw new HttpError(401, 'Invalid email or password.');
  }

  await createSession(userRow.id, response);

  return {
    user: toAuthUser(userRow),
    workspaceId: null,
    billingSummary: await getBillingSummary(userRow.id),
  };
}

export async function getAuthenticatedUser(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return null;
  }

  const db = await getDatabase();
  const tokenHash = hashSessionToken(token);
  const [session] = await db<SessionRow[]>`
    SELECT *
    FROM sessions
    WHERE token_hash = ${tokenHash}
  `;

  if (!session) {
    return null;
  }

  if (Number(session.expires_at) <= Date.now()) {
    await db`
      DELETE FROM sessions
      WHERE id = ${session.id}
    `;
    return null;
  }

  await db`
    UPDATE sessions
    SET last_seen_at = ${Date.now()}
    WHERE id = ${session.id}
  `;
  return getUserById(session.user_id);
}

export async function logoutUser(request: Request, response: Response) {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    const db = await getDatabase();
    await db`
      DELETE FROM sessions
      WHERE token_hash = ${hashSessionToken(token)}
    `;
  }

  clearSessionCookie(response);
}
