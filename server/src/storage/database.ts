import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import postgres, { type Sql, type TransactionSql } from 'postgres';
import type { PlanSummary, WorkspaceRecord } from '../../../shared/api.js';

const DATA_ROOT = path.resolve(process.cwd(), 'server/data');
const LEGACY_JSON_WORKSPACES_DIR = path.join(DATA_ROOT, 'workspaces');
const DEFAULT_LEGACY_SQLITE_PATH = path.join(DATA_ROOT, 'matrix001.sqlite');

type LegacyWorkspaceFile = WorkspaceRecord;
type TimestampValue = string | number | Date | null | undefined;
type DatabaseExecutor = Sql | TransactionSql;

let database: Sql | null = null;
let databaseInitializationPromise: Promise<Sql> | null = null;

const DEFAULT_PLANS: PlanSummary[] = [
  {
    id: 'free',
    label: 'Free',
    description: 'Starter plan for evaluation and self-host setups.',
    priceCentsMonthly: 0,
    monthlyTokenLimit: 250000,
    monthlyMessageLimit: 150,
    features: ['Canvas history', 'BYOK support', 'Single workspace'],
    isDefault: true,
  },
  {
    id: 'pro',
    label: 'Pro',
    description: 'For power users running hosted models with higher limits.',
    priceCentsMonthly: 1900,
    monthlyTokenLimit: 4000000,
    monthlyMessageLimit: 2500,
    features: ['Platform-hosted models', 'Reasoning models', 'Priority quotas'],
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Shared usage pool for collaborative production workspaces.',
    priceCentsMonthly: 7900,
    monthlyTokenLimit: 20000000,
    monthlyMessageLimit: 12000,
    features: ['Higher platform quotas', 'Shared workspaces', 'Extended usage history'],
  },
];

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
}

function getLegacySqlitePath() {
  return process.env.APP_LEGACY_SQLITE_PATH || DEFAULT_LEGACY_SQLITE_PATH;
}

function shouldRequireSsl(databaseUrl: string) {
  return !/localhost|127\.0\.0\.1/.test(databaseUrl);
}

function normalizeTimestamp(value: TimestampValue) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value instanceof Date) return value.getTime();
  return Date.now();
}

function toJsonValue<T>(value: T) {
  return value as any;
}

async function initializeSchema(db: Sql) {
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      last_seen_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents_monthly INTEGER NOT NULL,
      monthly_token_limit INTEGER NOT NULL,
      monthly_message_limit INTEGER NOT NULL,
      features_json JSONB NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES plans(id),
      status TEXT NOT NULL,
      current_period_start BIGINT NOT NULL,
      current_period_end BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      selected_provider_id TEXT NOT NULL,
      selected_model TEXT NOT NULL,
      provider_configs_json JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canvases (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      folder_id TEXT NULL,
      folder_name TEXT NULL,
      is_incognito BOOLEAN NOT NULL DEFAULT FALSE,
      data_json JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sidebar_folders (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      credential_source TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      estimated_cost_micros BIGINT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_canvases_workspace_id ON canvases(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON sidebar_folders(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_usage_user_period ON usage_events(user_id, created_at);
  `);
}

async function seedPlans(db: DatabaseExecutor) {
  const now = Date.now();

  for (const plan of DEFAULT_PLANS) {
    await db.unsafe(
      `
      INSERT INTO plans (
        id, label, description, price_cents_monthly, monthly_token_limit,
        monthly_message_limit, features_json, is_default, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      ON CONFLICT (id) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        price_cents_monthly = EXCLUDED.price_cents_monthly,
        monthly_token_limit = EXCLUDED.monthly_token_limit,
        monthly_message_limit = EXCLUDED.monthly_message_limit,
        features_json = EXCLUDED.features_json,
        is_default = EXCLUDED.is_default,
        updated_at = EXCLUDED.updated_at
    `,
      [
        plan.id,
        plan.label,
        plan.description,
        plan.priceCentsMonthly,
        plan.monthlyTokenLimit,
        plan.monthlyMessageLimit,
        db.json(toJsonValue(plan.features)),
        plan.isDefault ?? false,
        now,
        now,
      ]
    );
  }
}

async function workspaceCount(db: DatabaseExecutor) {
  const rows = await db.unsafe<{ count: number }[]>(
    `
      SELECT COUNT(*)::int AS count
      FROM workspaces
    `
  );
  return rows[0]?.count ?? 0;
}

async function upsertWorkspaceSnapshot(db: DatabaseExecutor, workspace: WorkspaceRecord) {
  await db.unsafe(
    `
    INSERT INTO workspaces (
      id, owner_user_id, selected_provider_id, selected_model,
      provider_configs_json, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
    ON CONFLICT (id) DO UPDATE SET
      owner_user_id = EXCLUDED.owner_user_id,
      selected_provider_id = EXCLUDED.selected_provider_id,
      selected_model = EXCLUDED.selected_model,
      provider_configs_json = EXCLUDED.provider_configs_json,
      updated_at = EXCLUDED.updated_at
  `,
    [
      workspace.id,
      workspace.ownerUserId ?? null,
      workspace.selectedProviderId,
      workspace.selectedModel,
      db.json(toJsonValue(workspace.providerConfigs)),
      workspace.createdAt,
      workspace.updatedAt,
    ]
  );

  await db.unsafe('DELETE FROM canvases WHERE workspace_id = $1', [workspace.id]);
  await db.unsafe('DELETE FROM sidebar_folders WHERE workspace_id = $1', [workspace.id]);

  for (const canvas of workspace.canvases) {
    await db.unsafe(
      `
      INSERT INTO canvases (
        id, workspace_id, name, folder_id, folder_name,
        is_incognito, data_json, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
    `,
      [
        canvas.id,
        workspace.id,
        canvas.name,
        canvas.folderId ?? null,
        canvas.folderName ?? null,
        canvas.isIncognito ?? false,
        db.json(toJsonValue(canvas)),
        canvas.createdAt,
        canvas.lastModified,
      ]
    );
  }

  for (const folder of workspace.sidebarFolders) {
    await db.unsafe(
      `
      INSERT INTO sidebar_folders (
        id, workspace_id, name, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5
      )
    `,
      [
        folder.id,
        workspace.id,
        folder.name,
        folder.createdAt,
        folder.lastModified,
      ]
    );
  }
}

async function migrateLegacyJsonWorkspacesIfNeeded(db: Sql) {
  if ((await workspaceCount(db)) > 0) return;
  if (!existsSync(LEGACY_JSON_WORKSPACES_DIR)) return;

  const files = readdirSync(LEGACY_JSON_WORKSPACES_DIR).filter((file) => file.endsWith('.json'));
  if (files.length === 0) return;

  await db.begin(async (tx) => {
    for (const file of files) {
      const workspace = JSON.parse(
        readFileSync(path.join(LEGACY_JSON_WORKSPACES_DIR, file), 'utf8')
      ) as LegacyWorkspaceFile;

      await upsertWorkspaceSnapshot(tx, {
        ...workspace,
        ownerUserId: workspace.ownerUserId ?? null,
      });
    }
  });
}

async function migrateLegacySqliteIfNeeded(db: Sql) {
  if ((await workspaceCount(db)) > 0) return;

  const legacyPath = getLegacySqlitePath();
  if (!existsSync(legacyPath)) return;

  const legacyDatabase = new DatabaseSync(legacyPath, { open: true });

  try {
    const hasWorkspacesTable = legacyDatabase
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'workspaces'
      `)
      .get() as { name: string } | undefined;

    if (!hasWorkspacesTable) {
      return;
    }

    const workspaces = legacyDatabase.prepare(`
      SELECT id, owner_user_id, selected_provider_id, selected_model, provider_configs_json, created_at, updated_at
      FROM workspaces
      ORDER BY updated_at DESC
    `).all() as Array<{
      id: string;
      owner_user_id: string | null;
      selected_provider_id: WorkspaceRecord['selectedProviderId'];
      selected_model: string;
      provider_configs_json: string;
      created_at: number;
      updated_at: number;
    }>;

    if (workspaces.length === 0) {
      return;
    }

    await db.begin(async (tx) => {
      for (const workspaceRow of workspaces) {
        const canvases = legacyDatabase.prepare(`
          SELECT data_json
          FROM canvases
          WHERE workspace_id = ?
          ORDER BY updated_at DESC
        `).all(workspaceRow.id) as Array<{ data_json: string }>;

        const sidebarFolders = legacyDatabase.prepare(`
          SELECT id, name, created_at, updated_at
          FROM sidebar_folders
          WHERE workspace_id = ?
          ORDER BY updated_at DESC
        `).all(workspaceRow.id) as Array<{
          id: string;
          name: string;
          created_at: number;
          updated_at: number;
        }>;

        await upsertWorkspaceSnapshot(tx, {
          id: workspaceRow.id,
          ownerUserId: workspaceRow.owner_user_id,
          selectedProviderId: workspaceRow.selected_provider_id,
          selectedModel: workspaceRow.selected_model,
          providerConfigs: JSON.parse(workspaceRow.provider_configs_json) as WorkspaceRecord['providerConfigs'],
          canvases: canvases.map((row) => JSON.parse(row.data_json) as WorkspaceRecord['canvases'][number]),
          sidebarFolders: sidebarFolders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            createdAt: normalizeTimestamp(folder.created_at),
            lastModified: normalizeTimestamp(folder.updated_at),
          })),
          createdAt: normalizeTimestamp(workspaceRow.created_at),
          updatedAt: normalizeTimestamp(workspaceRow.updated_at),
        });
      }
    });
  } finally {
    legacyDatabase.close();
  }
}

async function initializeDatabase() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('Missing Supabase/Postgres connection string. Set DATABASE_URL or SUPABASE_DB_URL.');
  }

  const sql = postgres(databaseUrl, {
    ssl: shouldRequireSsl(databaseUrl) ? 'require' : false,
    max: Number(process.env.APP_DB_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 30,
    prepare: false,
  });

  await initializeSchema(sql);
  await seedPlans(sql);
  await migrateLegacySqliteIfNeeded(sql);
  await migrateLegacyJsonWorkspacesIfNeeded(sql);

  database = sql;
  return sql;
}

export async function getDatabase() {
  if (database) {
    return database;
  }

  if (!databaseInitializationPromise) {
    databaseInitializationPromise = initializeDatabase().catch((error) => {
      databaseInitializationPromise = null;
      throw error;
    });
  }

  return databaseInitializationPromise;
}

export async function ensureDatabaseReady() {
  await getDatabase();
}

export async function withTransaction<T>(callback: (tx: TransactionSql) => Promise<T>) {
  const db = await getDatabase();
  return db.begin(callback);
}

export function getSeedPlans() {
  return DEFAULT_PLANS;
}
