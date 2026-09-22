/**
 * Turns a spoken or typed sentence into a draft entry:
 *   "sold 2 coke and 1 chips to Ram, 100 baki"  → a sale draft
 *   "spent 250 on tea" / "चियामा २५० खर्च"        → an expense draft
 *   "got 5000 salary"                             → an income draft
 *
 * Rules only, English + romanised Nepali + Nepali. It never saves anything:
 * the result is shown to the user in the real form first. This is the piece
 * the Claude "second brain" can replace later, so it stays self-contained.
 */

export interface SaleLineGuess {
  name: string;
  quantity: number;
}

export type PekkaEntryGuess =
  | {
      type: 'sale';
      items: SaleLineGuess[];
      partyName: string | null;
      /** Total the person said out loud ("for 100"), if any. */
      total: number | null;
      /** 'paid' unless they said baki / udharo / on credit. */
      payment: 'paid' | 'credit';
      /** "100 baki" → what is still owed; null when not said. */
      dueAmount: number | null;
    }
  | {
      type: 'money';
      kind: 'expense' | 'income';
      amount: number;
      /** What it was for ("tea", "salary"), as said. */
      label: string | null;
      /** Income said as "from <someone>": that's a payment from a party, not income. */
      fromName: string | null;
    };

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

export function normalizeEntryText(value: string): string {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[०-९]/g, (digit) => String(DEVANAGARI_DIGITS.indexOf(digit)))
    .toLowerCase()
    .replace(/[’']/g, '')
    // Keep digits joined: "1,200" → "1200", "1.5k" stays.
    .replace(/(\d),(?=\d{2,3}\b)/g, '$1')
    .replace(/[^\p{L}\p{M}\p{N}.\s]/gu, ' ')
    .replace(/(^|\s)\.|\.(?=\s|$)/g, ' ')
    // Split "चियामा" / "रामलाई" / "150रु" so the parts can be read separately.
    .replace(/([\p{L}\p{M}])(लाई|मा|को)(?=\s|$)/gu, '$1 $2')
    .replace(/(\d)(रु|rs)/g, '$1 $2')
    .replace(/(रु|rs)(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const SALE_VERB = /(^| )(sold|sell|selling|sale of|becheko|bechyo|beche|bechen|bechey|bechiyo)( |$)|बेच/;
const EXPENSE_VERB = /(^| )(spent|spend|paid for|kharcha|kharch|expense of)( |$)|खर्च/;
const INCOME_VERB = /(^| )(earned|received|got|income of|aayo|aaeko|payo|paye|kamaye|kamayo)( |$)|कमाएँ|कमाए|आयो|पाएँ|पाए/;
const CREDIT = /(^| )(baki|baaki|udhar|udharo|udharma|credit|unpaid|not paid)( |$)|बाँकी|बाकी|उधार/;
const HOW_TO = /(^| )(how|kasari|where|kaha)( |$)|कसरी|कहाँ/;

const CURRENCY_WORDS = new Set(['rs', 'npr', 'rupees', 'rupee', 'rupiya', 'rupaiya', 'rupaiyan', 'रु', 'रुपैयाँ', 'रुपैया', 'रूपैयाँ']);
const MULTIPLIERS: Record<string, number> = { hajar: 1000, hazar: 1000, हजार: 1000, lakh: 100000, लाख: 100000, saya: 100, सय: 100 };
const COUNTERS = new Set(['ta', 'wota', 'wata', 'vata', 'ota', 'वटा', 'ओटा', 'pcs', 'pc', 'piece', 'pieces', 'x', 'packet', 'packets', 'poka', 'kg', 'kilo', 'kilos', 'के.जी', 'liter', 'litre', 'l', 'bottle', 'bottles', 'plate', 'plates', 'cup', 'cups', 'glass', 'dozen']);
const JOINERS = new Set(['and', 'ra', 'र', 'with', 'plus']);
const FILLER = new Set([
  'i', 'we', 'have', 'has', 'just', 'today', 'aaja', 'aja', 'आज', 'the', 'a', 'an', 'of', 'please', 'maile', 'mailey', 'मैले', 'hami', 'hamile',
  'sold', 'sell', 'selling', 'sale', 'becheko', 'bechyo', 'beche', 'bechen', 'bechey', 'bechiyo', 'gare', 'gareko', 'garyo', 'गरें', 'गरे', 'भयो', 'bhayo',
  'cash', 'nagad', 'paid', 'full', 'in', 'on', 'total', 'jamma', 'जम्मा',
]);
const MONEY_LEAD = new Set(['for', 'at', 'ma', 'मा', 'worth']);
const PARTY_STOP = new Set([...FILLER, ...JOINERS, 'for', 'at', 'ma', 'मा', 'le', 'ले', 'lai', 'लाई', 'ko', 'को', 'from', 'to']);

/** Reads "250", "1.5k", "2 hajar", "रु 150" style amounts. Returns the value and how many tokens it used. */
function readNumber(tokens: string[], index: number): { value: number; used: number } | null {
  const token = tokens[index];
  if (!token) return null;
  const match = token.match(/^(\d+(?:\.\d+)?)(k)?$/);
  if (!match) return null;
  let value = Number(match[1]) * (match[2] ? 1000 : 1);
  let used = 1;
  const multiplier = MULTIPLIERS[tokens[index + 1] ?? ''];
  if (multiplier) {
    value *= multiplier;
    used = 2;
  }
  return Number.isFinite(value) && value > 0 ? { value, used } : null;
}

interface NumberAt {
  value: number;
  start: number;
  end: number;
  /** Next to a currency word, or after "for" / "at" / "ma": money, not a count. */
  money: boolean;
}

function findNumbers(tokens: string[]): NumberAt[] {
  const found: NumberAt[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const number = readNumber(tokens, index);
    if (!number) continue;
    const end = index + number.used;
    const before = tokens[index - 1] ?? '';
    const after = tokens[end] ?? '';
    const money = CURRENCY_WORDS.has(before) || CURRENCY_WORDS.has(after) || MONEY_LEAD.has(before)
      || (CURRENCY_WORDS.has(before) && MONEY_LEAD.has(tokens[index - 2] ?? ''));
    found.push({ value: number.value, start: index, end, money });
    index = end - 1;
  }
  return found;
}

function cleanName(words: string[]): string {
  return words
    .filter((word) => !FILLER.has(word) && !CURRENCY_WORDS.has(word) && !COUNTERS.has(word) && !SALE_VERB.test(word))
    .join(' ')
    .trim();
}

/** "to Ram", "for Ram", "Ram lai", "रामलाई" → "ram". One or two words, never a number. */
function findPartyName(tokens: string[]): { name: string; start: number; end: number } | null {
  const isNameWord = (word?: string) => Boolean(word) && !PARTY_STOP.has(word!) && !/\d/.test(word!) && !CURRENCY_WORDS.has(word!) && !CREDIT.test(word!);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if ((token === 'to' || token === 'for') && isNameWord(tokens[index + 1])) {
      const two = isNameWord(tokens[index + 2]) && !COUNTERS.has(tokens[index + 2]) ? 2 : 1;
      return { name: tokens.slice(index + 1, index + 1 + two).join(' '), start: index, end: index + 1 + two };
    }
    if ((token === 'lai' || token === 'लाई') && isNameWord(tokens[index - 1])) {
      return { name: tokens[index - 1], start: index - 1, end: index + 1 };
    }
  }
  return null;
}

function parseSale(tokens: string[]): PekkaEntryGuess | null {
  const text = tokens.join(' ');
  const party = findPartyName(tokens);
  const numbers = findNumbers(tokens).filter((number) => !party || number.start < party.start || number.start >= party.end);
  const credit = CREDIT.test(text);

  // A number touching "baki" is what is still owed.
  const creditIndex = tokens.findIndex((token) => CREDIT.test(token));
  const due = creditIndex >= 0
    ? numbers.find((number) => number.end === creditIndex || number.start === creditIndex + 1)
    : undefined;
  const money = numbers.filter((number) => number !== due && number.money);
  const total = money.length ? money[money.length - 1].value : null;

  // Everything that isn't the party, money or the credit words is item text.
  const skip = new Set<number>();
  if (party) for (let index = party.start; index < party.end; index += 1) skip.add(index);
  for (const number of [...money, ...(due ? [due] : [])]) {
    for (let index = number.start; index < number.end; index += 1) skip.add(index);
    // "for 100", "for Rs 100", "Rs 100": the lead-in words belong to the amount.
    let lead = number.start - 1;
    if (CURRENCY_WORDS.has(tokens[lead] ?? '')) skip.add(lead--);
    if (MONEY_LEAD.has(tokens[lead] ?? '')) skip.add(lead);
    if (CURRENCY_WORDS.has(tokens[number.end] ?? '')) skip.add(number.end);
  }
  tokens.forEach((token, index) => { if (CREDIT.test(token)) skip.add(index); });

  // Split what's left into items: "2 coke 3 chips", "coke 2 and chips 3".
  const items: SaleLineGuess[] = [];
  let words: string[] = [];
  let quantity: number | null = null;
  const flush = () => {
    const name = cleanName(words);
    if (name) items.push({ name, quantity: quantity ?? 1 });
    words = [];
    quantity = null;
  };
  for (let index = 0; index < tokens.length; index += 1) {
    if (skip.has(index)) { flush(); continue; }
    const token = tokens[index];
    if (JOINERS.has(token)) { flush(); continue; }
    const number = readNumber(tokens, index);
    if (!number) { words.push(token); continue; }
    index += number.used - 1;
    if (cleanName(words) && quantity === null) {
      // "coke 2": the count comes after the name.
      quantity = number.value;
      flush();
    } else {
      if (quantity !== null) flush();
      quantity = number.value;
    }
  }
  flush();

  if (!items.length) return null;
  return {
    type: 'sale',
    items: items.slice(0, 8),
    partyName: party?.name ?? null,
    total,
    payment: credit ? 'credit' : 'paid',
    dueAmount: due?.value ?? null,
  };
}

function parseMoney(tokens: string[], kind: 'expense' | 'income'): PekkaEntryGuess | null {
  const numbers = findNumbers(tokens);
  if (!numbers.length) return null;
  const amount = (numbers.find((number) => number.money) ?? numbers[0]).value;

  const fromIndex = tokens.findIndex((token) => token === 'from' || token === 'bata' || token === 'बाट');
  let fromName: string | null = null;
  if (kind === 'income' && fromIndex >= 0) {
    const word = (token?: string): token is string =>
      Boolean(token) && !PARTY_STOP.has(token!) && !/\d/.test(token!) && !CURRENCY_WORDS.has(token!);
    // "from Ram" (English) or "Ram bata" (Nepali).
    const candidate = tokens[fromIndex] === 'from' ? tokens[fromIndex + 1] : tokens[fromIndex - 1];
    if (word(candidate)) fromName = candidate;
  }

  // "on tea", "for rent", "chiya ma", "चिया मा", or whatever words are left.
  const verbs = kind === 'expense' ? EXPENSE_VERB : INCOME_VERB;
  const skipWords = new Set([...FILLER, 'spent', 'spend', 'kharcha', 'kharch', 'खर्च', 'earned', 'received', 'got', 'aayo', 'payo', 'paye', 'kamaye', 'kamayo', 'income', 'expense', 'for', 'on', 'ma', 'मा', 'from', 'bata', 'बाट', 'paid', 'भयो', 'गरें']);
  const labelWords = tokens.filter((token, index) =>
    !skipWords.has(token)
    && !CURRENCY_WORDS.has(token)
    && !numbers.some((number) => index >= number.start && index < number.end)
    && !verbs.test(token)
    && token !== fromName);
  const label = labelWords.slice(0, 3).join(' ').trim() || null;
  return { type: 'money', kind, amount, label: fromName ? null : label, fromName };
}

export function parseEntry(sentence: string): PekkaEntryGuess | null {
  const text = normalizeEntryText(sentence);
  if (!text || HOW_TO.test(text)) return null;
  const tokens = text.split(' ');
  if (!findNumbers(tokens).length) return null;

  if (SALE_VERB.test(text)) return parseSale(tokens);
  if (EXPENSE_VERB.test(text)) return parseMoney(tokens, 'expense');
  if (INCOME_VERB.test(text)) return parseMoney(tokens, 'income');
  return null;
}
