import { apiRequest } from './client';

export interface PekkaChoice { id: string; name: string; detail: string; kind: 'product' | 'party' }
export interface PekkaReply {
  status: 'answer' | 'choose' | 'not-found' | 'help' | 'personal';
  kind?: 'product' | 'party';
  name?: string;
  amount?: number;
  unit?: string | null;
  currency?: string;
  direction?: 'receive' | 'pay' | 'settled';
  candidates?: PekkaChoice[];
}
export function askPekka(question: string, selection?: Pick<PekkaChoice, 'id' | 'kind'>) {
  return apiRequest<PekkaReply, { question: string; selection?: typeof selection }>({
    method: 'POST', path: '/api/pekka/ask', body: { question, selection },
  });
}

export interface PekkaNudgesResponse {
  overdue: Array<{ id: string; name: string; amount: number; days: number }>;
}
export function getPekkaNudges() {
  return apiRequest<PekkaNudgesResponse>({ path: '/api/pekka/nudges' });
}

export interface PekkaMatch { id: string; name: string; detail: string; score: number }
export interface PekkaMatchResponse {
  kind: 'product' | 'party';
  results: Array<{ name: string; matches: PekkaMatch[] }>;
}
/** Closest products or contacts for names Pekka heard; tolerant of spelling and voice errors. */
export function matchPekkaNames(kind: 'product' | 'party', names: string[]) {
  return apiRequest<PekkaMatchResponse, { kind: typeof kind; names: string[] }>({
    method: 'POST', path: '/api/pekka/match', body: { kind, names },
  });
}

export interface PekkaChatTurn {
  role: 'user' | 'pekka';
  text: string;
}
export interface PekkaChatReply {
  answer: string;
  /** Where to send the user next, when the answer points at a screen. */
  action?: { label: string; route: string };
  /** Questions used and allowed today, counted by the server. */
  usage?: { used: number; limit: number };
}
/**
 * The open-ended question path. The AI lives behind our server — the phone
 * never holds a provider key — and the server counts every call against the
 * plan's daily allowance. A 402 or 429 means the allowance is used up.
 */
export function askPekkaChat(question: string, history: PekkaChatTurn[] = []) {
  return apiRequest<PekkaChatReply, { question: string; history: PekkaChatTurn[] }>({
    method: 'POST', path: '/api/pekka/chat', body: { question, history: history.slice(-6) },
  });
}

export interface PekkaQuotaReply {
  /** The plan as the pricing page names it: free, pro, business. */
  planCode: string;
  aiEnabled: boolean;
  /** Why the AI is off, when it is: plan_without_ai, subscription_expired, ai_not_configured… */
  reason: string | null;
  /** The shop's date these counts belong to. */
  day: string;
  used: number;
  limit: number;
  remaining: number;
}
/**
 * Where this account stands on AI questions today.
 *
 * Unlike /api/subscription, which only an owner may read, this is open to
 * everyone in the workspace — so a staff member is told the same thing as the
 * owner without being shown any billing.
 */
export function getPekkaQuota() {
  return apiRequest<PekkaQuotaReply>({ path: '/api/pekka/quota' });
}
