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
