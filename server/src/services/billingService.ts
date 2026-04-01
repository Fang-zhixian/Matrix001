import { randomUUID } from 'node:crypto';
import type { BillingSummary, PlanSummary, SubscriptionStatus } from '../../../shared/api.js';
import { getDatabase, getSeedPlans } from '../storage/database.js';
import { HttpError } from '../utils/httpError.js';

type PlanRow = {
  id: string;
  label: string;
  description: string;
  price_cents_monthly: number;
  monthly_token_limit: number;
  monthly_message_limit: number;
  features_json: string[];
  is_default: boolean;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string | number;
  current_period_end: string | number;
  created_at: string | number;
  updated_at: string | number;
};

function toPlanSummary(row: PlanRow): PlanSummary {
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    priceCentsMonthly: row.price_cents_monthly,
    monthlyTokenLimit: row.monthly_token_limit,
    monthlyMessageLimit: row.monthly_message_limit,
    features: Array.isArray(row.features_json) ? row.features_json : [],
    isDefault: Boolean(row.is_default),
  };
}

export async function listPlans() {
  const db = await getDatabase();
  const rows = await db<PlanRow[]>`
    SELECT *
    FROM plans
    ORDER BY price_cents_monthly ASC
  `;
  return rows.map(toPlanSummary);
}

export async function getPlanById(planId: string) {
  const db = await getDatabase();
  const [row] = await db<PlanRow[]>`
    SELECT *
    FROM plans
    WHERE id = ${planId}
  `;
  return row ? toPlanSummary(row) : null;
}

export async function getDefaultPlan() {
  return (await listPlans()).find((plan) => plan.isDefault) ?? getSeedPlans()[0];
}

export async function ensureUserSubscription(userId: string) {
  const db = await getDatabase();
  const [existing] = await db<SubscriptionRow[]>`
    SELECT *
    FROM subscriptions
    WHERE user_id = ${userId}
  `;

  if (existing) {
    return existing;
  }

  const plan = await getDefaultPlan();
  const now = Date.now();
  const periodEnd = now + 1000 * 60 * 60 * 24 * 30;
  const subscription: SubscriptionRow = {
    id: randomUUID(),
    user_id: userId,
    plan_id: plan.id,
    status: 'active',
    current_period_start: now,
    current_period_end: periodEnd,
    created_at: now,
    updated_at: now,
  };

  await db`
    INSERT INTO subscriptions (
      id, user_id, plan_id, status, current_period_start,
      current_period_end, created_at, updated_at
    ) VALUES (
      ${subscription.id},
      ${subscription.user_id},
      ${subscription.plan_id},
      ${subscription.status},
      ${subscription.current_period_start},
      ${subscription.current_period_end},
      ${subscription.created_at},
      ${subscription.updated_at}
    )
  `;

  return subscription;
}

export async function getUserSubscription(userId: string) {
  const db = await getDatabase();
  const [subscription] = await db<SubscriptionRow[]>`
    SELECT *
    FROM subscriptions
    WHERE user_id = ${userId}
  `;

  if (!subscription) {
    return ensureUserSubscription(userId);
  }

  return subscription;
}

async function rotateSubscriptionPeriodIfNeeded(subscription: SubscriptionRow) {
  const db = await getDatabase();
  const now = Date.now();
  if (Number(subscription.current_period_end) > now) {
    return subscription;
  }

  const nextSubscription: SubscriptionRow = {
    ...subscription,
    current_period_start: now,
    current_period_end: now + 1000 * 60 * 60 * 24 * 30,
    updated_at: now,
  };

  await db`
    UPDATE subscriptions
    SET current_period_start = ${nextSubscription.current_period_start},
        current_period_end = ${nextSubscription.current_period_end},
        updated_at = ${nextSubscription.updated_at}
    WHERE id = ${nextSubscription.id}
  `;

  return nextSubscription;
}

export async function getBillingSummary(userId: string): Promise<BillingSummary> {
  const db = await getDatabase();
  const subscription = await rotateSubscriptionPeriodIfNeeded(await getUserSubscription(userId));
  const plan = (await getPlanById(subscription.plan_id)) ?? await getDefaultPlan();
  const [usage] = await db<{ usedtokens: number; usedmessages: number }[]>`
    SELECT
      COALESCE(SUM(total_tokens), 0)::int AS usedTokens,
      COUNT(*)::int AS usedMessages
    FROM usage_events
    WHERE user_id = ${userId}
      AND created_at >= ${Number(subscription.current_period_start)}
      AND created_at < ${Number(subscription.current_period_end)}
  `;

  const usedTokens = Number(usage?.usedtokens ?? 0);
  const usedMessages = Number(usage?.usedmessages ?? 0);

  return {
    planId: plan.id,
    status: subscription.status,
    periodStart: Number(subscription.current_period_start),
    periodEnd: Number(subscription.current_period_end),
    usedTokens,
    usedMessages,
    remainingTokens: Math.max(plan.monthlyTokenLimit - usedTokens, 0),
    remainingMessages: Math.max(plan.monthlyMessageLimit - usedMessages, 0),
    priceCentsMonthly: plan.priceCentsMonthly,
    canUsePlatformModels: plan.id !== 'free' || process.env.APP_DEPLOYMENT_MODE !== 'saas',
  };
}

export async function changeUserPlan(userId: string, planId: string) {
  const db = await getDatabase();
  const plan = await getPlanById(planId);
  if (!plan) {
    throw new HttpError(400, 'Unknown plan.');
  }

  await getUserSubscription(userId);
  const now = Date.now();
  await db`
    UPDATE subscriptions
    SET plan_id = ${plan.id},
        status = 'active',
        current_period_start = ${now},
        current_period_end = ${now + 1000 * 60 * 60 * 24 * 30},
        updated_at = ${now}
    WHERE user_id = ${userId}
  `;

  return getBillingSummary(userId);
}

export async function recordUsageEvent(params: {
  userId: string | null;
  workspaceId: string;
  providerId: string;
  modelId: string;
  credentialSource: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: number;
}) {
  const db = await getDatabase();
  await db`
    INSERT INTO usage_events (
      id, user_id, workspace_id, provider_id, model_id,
      credential_source, input_tokens, output_tokens, total_tokens,
      estimated_cost_micros, created_at
    ) VALUES (
      ${randomUUID()},
      ${params.userId},
      ${params.workspaceId},
      ${params.providerId},
      ${params.modelId},
      ${params.credentialSource},
      ${params.inputTokens},
      ${params.outputTokens},
      ${params.totalTokens},
      ${params.estimatedCostMicros},
      ${Date.now()}
    )
  `;
}

export async function enforceQuota(userId: string) {
  const summary = await getBillingSummary(userId);
  if (summary.remainingMessages <= 0) {
    throw new HttpError(402, 'Monthly message quota reached for the current plan.');
  }

  if (summary.remainingTokens <= 0) {
    throw new HttpError(402, 'Monthly token quota reached for the current plan.');
  }

  return summary;
}
