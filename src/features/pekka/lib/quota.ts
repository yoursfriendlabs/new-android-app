import { localIsoDate } from '@/src/shared/lib/format';
import type { Subscription } from '@/src/types/models';

/**
 * How many questions Pekka may send to the AI service in a day.
 *
 * Answers Pekka works out on the phone — totals, how-to help, small talk — are
 * free and unlimited; they cost nothing to serve. Only questions that need the
 * AI behind the server are counted, because those cost real money per answer.
 * The server has the final say; this is the copy and the brake in the app, so
 * a user is told where they stand before they type.
 */

export const PEKKA_AI_FEATURE = 'pekka_ai';

export const PEKKA_DAILY_QUESTIONS: Record<string, number> = {
  free: 5,
  basic: 20,
  pro: 60,
  business: 120,
};

export const PEKKA_DEFAULT_DAILY_QUESTIONS = PEKKA_DAILY_QUESTIONS.free;

export interface PekkaUsage {
  /** The day these questions were counted against (local date). */
  day: string;
  used: number;
}

export const EMPTY_USAGE: PekkaUsage = { day: '', used: 0 };

export function planCode(subscription?: Subscription | null): string {
  const code = String(subscription?.planCode ?? subscription?.planName ?? '').trim().toLowerCase();
  return code || 'free';
}

/** The AI is on only when the plan says so — it is never assumed. */
export function aiEnabled(subscription?: Subscription | null): boolean {
  if (!subscription?.isActive) return false;
  const features = Array.isArray(subscription.features) ? subscription.features : [];
  return features.some((feature) => String(feature).toLowerCase() === PEKKA_AI_FEATURE);
}

export function dailyLimit(subscription?: Subscription | null): number {
  const limit = Number(subscription?.pekkaDailyQuestions);
  if (Number.isFinite(limit) && limit >= 0) return Math.round(limit);
  return PEKKA_DAILY_QUESTIONS[planCode(subscription)] ?? PEKKA_DEFAULT_DAILY_QUESTIONS;
}

/** Yesterday's count never carries over. */
export function normalizeUsage(raw: Partial<PekkaUsage> | null | undefined, today = localIsoDate()): PekkaUsage {
  const day = String(raw?.day ?? '').slice(0, 10);
  const used = Math.max(0, Math.round(Number(raw?.used ?? 0)));
  if (day !== today) return { day: today, used: 0 };
  return { day, used: Number.isFinite(used) ? used : 0 };
}

export function remainingQuestions(usage: PekkaUsage, limit: number, today = localIsoDate()): number {
  return Math.max(0, limit - normalizeUsage(usage, today).used);
}

export function canAskAi(usage: PekkaUsage, limit: number, today = localIsoDate()): boolean {
  return remainingQuestions(usage, limit, today) > 0;
}

export function countQuestion(usage: PekkaUsage, today = localIsoDate()): PekkaUsage {
  const current = normalizeUsage(usage, today);
  return { day: today, used: current.used + 1 };
}

/** What the server reports wins, so two phones on one account stay honest. */
export function mergeServerUsage(usage: PekkaUsage, server?: { used?: number; limit?: number } | null, today = localIsoDate()): PekkaUsage {
  const current = normalizeUsage(usage, today);
  const used = Number(server?.used);
  if (!Number.isFinite(used) || used < 0) return current;
  return { day: today, used: Math.max(current.used, Math.round(used)) };
}
