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
