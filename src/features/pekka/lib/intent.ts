import type { DatePeriod } from '@/src/shared/lib/format';

/**
 * Understands typed or spoken questions on the phone, before anything is sent
 * to the backend: "how do I add stock?" and "how much did I spend this month?".
 * Price and balance lookups ("price of sugar", "Ram ko baki") are left to the
 * backend, which can search products and contacts.
 */

export type PekkaHelpScope = 'all' | 'shop' | 'personal';

export interface PekkaHelpTopic {
  id: string;
  route: string;
  scope: PekkaHelpScope;
  keywords: string[];
}

// Longer, more specific words win, so "sales history" beats "sale".
export const PEKKA_HELP_TOPICS: PekkaHelpTopic[] = [
  { id: 'sale', route: '/(app)/(tabs)/pos', scope: 'shop', keywords: ['sale', 'sell', 'bill', 'pos', 'counter', 'bech', 'bechne', 'bechna', 'bechnu', 'bikri', 'बेच', 'बिक्री'] },
  { id: 'salesHistory', route: '/(app)/sales', scope: 'shop', keywords: ['sales history', 'past sale', 'old sale', 'invoice', 'receipt', 'print', 'reprint', 'purano bill', 'बिल हेर', 'रसिद'] },
  { id: 'stock', route: '/(app)/(tabs)/inventory', scope: 'shop', keywords: ['product', 'item', 'stock', 'inventory', 'saman', 'maal', 'सामान', 'माल', 'स्टक'] },
  { id: 'purchase', route: '/(app)/purchases', scope: 'shop', keywords: ['purchase', 'buy', 'bought', 'restock', 'kharid', 'kin', 'kinne', 'kinna', 'kinnu', 'kineko', 'खरिद', 'किन'] },
  { id: 'money', route: '/(app)/(tabs)/expenses', scope: 'all', keywords: ['expense', 'income', 'spend', 'spent', 'earn', 'kharcha', 'aamdani', 'amdani', 'खर्च', 'आम्दानी', 'कमाइ'] },
  { id: 'party', route: '/(app)/(tabs)/parties', scope: 'shop', keywords: ['customer', 'supplier', 'party', 'parties', 'contact', 'payment in', 'payment out', 'udhar', 'grahak', 'ग्राहक', 'उधार', 'पार्टी'] },
  { id: 'contacts', route: '/(app)/(tabs)/parties', scope: 'personal', keywords: ['contact', 'lend', 'lent', 'borrow', 'udhar', 'saapat', 'sapat', 'उधार', 'सापट', 'सम्पर्क'] },
  { id: 'service', route: '/(app)/service-create', scope: 'shop', keywords: ['service', 'repair', 'job', 'sewa', 'marmat', 'सेवा', 'मर्मत'] },
  { id: 'staff', route: '/(app)/staff', scope: 'shop', keywords: ['staff', 'employee', 'worker', 'salary', 'karmachari', 'talab', 'कर्मचारी', 'तलब'] },
  { id: 'attendance', route: '/(app)/attendance', scope: 'shop', keywords: ['attendance', 'check in', 'hajir', 'hajiri', 'हाजिर'] },
  { id: 'ledger', route: '/(app)/ledger', scope: 'shop', keywords: ['ledger', 'report', 'statement', 'khata', 'खाता', 'रिपोर्ट'] },
  { id: 'bank', route: '/(app)/banks', scope: 'all', keywords: ['bank', 'wallet', 'esewa', 'khalti', 'बैंक'] },
  { id: 'budgets', route: '/(app)/budgets', scope: 'all', keywords: ['budget', 'saving', 'goal', 'bachat', 'बचत', 'बजेट'] },
  { id: 'notes', route: '/(app)/notes', scope: 'personal', keywords: ['note', 'reminder', 'remind', 'samjhana', 'नोट', 'सम्झना', 'रिमाइन्डर'] },
  { id: 'settings', route: '/(app)/settings', scope: 'all', keywords: ['language', 'theme', 'dark mode', 'colour', 'color', 'password', 'setting', 'bhasa', 'भाषा', 'सेटिङ'] },
  { id: 'deleteAccount', route: '/(app)/delete-account', scope: 'all', keywords: ['delete account', 'delete my account', 'remove account', 'close account', 'खाता मेटा'] },
];

// "How do I / where is / add / kasari" — asking how to use the app, not for a number.
const HOW_TO = /(^| )(how (do|can|to|should)|where|kasari|kaha|kahan|add|create|record|make|new|enter|change|open|delete|remove|thap|halne|garne|rakhne)( |$)|कसरी|कहाँ|थप|गर्ने|राख्ने/;

export type PekkaTotalId = 'income' | 'expense' | 'profit' | 'sales' | 'toReceive' | 'toPay' | 'lowStock';

const TOTALS: Array<{ id: PekkaTotalId; shopOnly: boolean; keywords: string[] }> = [
  { id: 'profit', shopOnly: false, keywords: ['profit', 'loss', 'nafa', 'naafa', 'ghata', 'नाफा', 'घाटा', 'नोक्सान'] },
  { id: 'income', shopOnly: false, keywords: ['income', 'earn', 'earned', 'earning', 'aamdani', 'amdani', 'kamai', 'आम्दानी', 'कमाइ'] },
  { id: 'expense', shopOnly: false, keywords: ['expense', 'expenses', 'spend', 'spent', 'spending', 'kharcha', 'kharch', 'खर्च'] },
  { id: 'sales', shopOnly: true, keywords: ['sales', 'sold', 'bikri', 'बिक्री'] },
  { id: 'toReceive', shopOnly: true, keywords: ['receivable', 'receivables', 'पाउनुपर्ने'] },
  { id: 'toPay', shopOnly: true, keywords: ['payable', 'payables', 'तिर्नुपर्ने'] },
  { id: 'lowStock', shopOnly: true, keywords: ['low stock', 'running low', 'out of stock', 'stock kam', 'स्टक कम', 'सकिन लाग'] },
];

const PERIODS: Array<{ period: DatePeriod; pattern: RegExp }> = [
  { period: 'today', pattern: /(^| )(today|aaja|aja)( |$)|आज/ },
  { period: 'this_week', pattern: /(^| )(week|hapta)( |$)|हप्ता/ },
  { period: 'this_month', pattern: /(^| )(month|mahina)( |$)|महिना/ },
  { period: 'this_year', pattern: /(^| )(year|barsa|barsha|sal|saal)( |$)|वर्ष|बर्ष|साल/ },
];

// "spent on tea" / "income from rent" asks about one thing, not the total.
const NARROWED = /(^| )(on|from) (?!(today|this|the|last|my)( |$))\S/;

export type PekkaIntent =
  | { type: 'help'; topic: PekkaHelpTopic }
  | { type: 'total'; id: PekkaTotalId; period: DatePeriod | null }
  | null;

export function normalizeQuestion(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasWord(text: string, keyword: string): boolean {
  // Devanagari words bend at the end (खर्चको, बिक्रीमा), so match anywhere.
  if (/[^\x00-\x7F]/.test(keyword)) return text.includes(keyword);
  // Allow common endings ("selling"), but don't match "kin" in "kind" or "earn" in "earnest".
  return new RegExp(`(^| )${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es|ing|ed)?( |$)`).test(text);
}

function score(text: string, keywords: string[]): number {
  return keywords.reduce((best, keyword) => (hasWord(text, keyword) ? Math.max(best, keyword.length) : best), 0);
}

function inScope(scope: PekkaHelpScope, isPersonal: boolean): boolean {
  return scope === 'all' || (scope === 'personal' ? isPersonal : !isPersonal);
}

export function findHelpTopic(text: string, isPersonal: boolean): PekkaHelpTopic | null {
  let best: PekkaHelpTopic | null = null;
  let bestScore = 0;
  for (const topic of PEKKA_HELP_TOPICS) {
    if (!inScope(topic.scope, isPersonal)) continue;
    const value = score(text, topic.keywords);
    if (value > bestScore) {
      best = topic;
      bestScore = value;
    }
  }
  return best;
}

export function findPeriod(text: string): DatePeriod | null {
  return PERIODS.find((entry) => entry.pattern.test(text))?.period ?? null;
}

export function matchPekkaIntent(question: string, isPersonal: boolean): PekkaIntent {
  const text = normalizeQuestion(question);
  if (!text) return null;

  if (HOW_TO.test(text.replace(/how (much|many)/g, ' '))) {
    const topic = findHelpTopic(text, isPersonal);
    return topic ? { type: 'help', topic } : null;
  }

  if (NARROWED.test(text)) return null;
  for (const total of TOTALS) {
    if (total.shopOnly && isPersonal) continue;
    if (score(text, total.keywords) > 0) return { type: 'total', id: total.id, period: findPeriod(text) };
  }
  return null;
}
