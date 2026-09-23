import { PEKKA_DAILY_QUESTIONS } from '@/src/features/pekka/lib/quota';

/**
 * What each plan includes.
 *
 * Prices are left empty on purpose: set them here once they are decided, in the
 * currency you bill in. A plan with no price shows "Ask us" instead of a number,
 * so nothing wrong is ever shown to a shopkeeper.
 *
 * Note for Android: Google Play does not allow taking payment for a plan inside
 * the app outside Play Billing. This page shows what each plan includes and
 * where the account stands — it never collects money.
 */

export interface PekkaPlan {
  code: string;
  /** i18n key for the plan's name. */
  nameKey: string;
  /** i18n key for the one-line summary. */
  summaryKey: string;
  /** Price per month in the billing currency. Null until it is decided. */
  price: number | null;
  /** i18n keys for the lines under the plan. */
  featureKeys: string[];
  /** AI questions a day, kept in step with the quota table. */
  aiQuestions: number;
  popular?: boolean;
}

export const PLANS: PekkaPlan[] = [
  {
    code: 'free',
    nameKey: 'billing.plans.free.name',
    summaryKey: 'billing.plans.free.summary',
    price: 0,
    aiQuestions: PEKKA_DAILY_QUESTIONS.free,
    featureKeys: ['billing.features.records', 'billing.features.pekkaBasics', 'billing.features.oneUser'],
  },
  {
    code: 'pro',
    nameKey: 'billing.plans.pro.name',
    summaryKey: 'billing.plans.pro.summary',
    price: null,
    aiQuestions: PEKKA_DAILY_QUESTIONS.pro,
    featureKeys: ['billing.features.everythingFree', 'billing.features.pekkaAi', 'billing.features.staff', 'billing.features.reports'],
    popular: true,
  },
  {
    code: 'business',
    nameKey: 'billing.plans.business.name',
    summaryKey: 'billing.plans.business.summary',
    price: null,
    aiQuestions: PEKKA_DAILY_QUESTIONS.business,
    featureKeys: ['billing.features.everythingPro', 'billing.features.moreAi', 'billing.features.seats', 'billing.features.support'],
  },
];

export function planByCode(code: string): PekkaPlan | undefined {
  return PLANS.find((plan) => plan.code === String(code || '').toLowerCase());
}
