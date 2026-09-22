import { normalizeQuestion } from './intent';

export type PekkaConversation = 'hello' | 'wellbeing' | 'thanks' | 'goodbye' | 'identity' | 'capabilities' | 'acknowledge' | 'clarify';

const GREETING = /^(?:(?:hello|hi|hey|namaste|namaskar|नमस्ते|नमस्कार|good morning|good afternoon|good evening)(?: |$))+/;
const ADDRESS = /^(?:pekka|पेक्का|there|friend)(?: |$)| (?:pekka|पेक्का|friend)$/g;
const RESPONSES: Array<{ id: PekkaConversation; pattern: RegExp }> = [
  { id: 'wellbeing', pattern: /^(?:how (?:are|r) (?:you|u)(?: doing| today)?|how is it going|hows it going|whats up|what is up|and you|what about you|k(?:e|a)? (?:cha|chha)|kasto (?:cha|chha|chhau)|sanchai (?:chau|chhau|cha)|तिमीलाई कस्तो छ|तपाईंलाई कस्तो छ|तपाईलाई कस्तो छ|कस्तो छ|के छ|सन्चै (?:छौ|हुनुहुन्छ))$/ },
  { id: 'thanks', pattern: /^(?:thanks(?: a lot| so much)?|thank you(?: very much| so much)?|dhanyabad|dhanyavaad|धन्यवाद)$/ },
  { id: 'goodbye', pattern: /^(?:bye|goodbye|good bye|see you(?: later)?|good night|शुभ रात्री|शुभ रात्रि|फेरि भेटौँ)$/ },
  { id: 'identity', pattern: /^(?:who are you|what(?: is|s) your name|are you (?:a bot|a robot|ai|human)|tim(?:i|ro) (?:ko ho|naam ke ho)|तिमी को हौ|तपाईं को हुनुहुन्छ|तिम्रो नाम के हो)$/ },
  { id: 'capabilities', pattern: /^(?:help(?: me)?|what can you do(?: for me)?|how can you help(?: me)?|what can i ask(?: you)?|what do you do|मद्दत(?: गर| गर्नुहोस्)?|के गर्न सक्छौ|तिमी के गर्न सक्छौ)$/ },
  { id: 'acknowledge', pattern: /^(?:ok|okay|alright|got it|great|nice|im (?:fine|good|well)|i am (?:fine|good|well)|ठीक छ|हुन्छ)$/ },
  { id: 'clarify', pattern: /^(?:i dont understand|that(?: is|s) (?:wrong|not what i asked)|you (?:didnt|dont) understand|what do you mean|मैले बुझिन|बुझिन)$/ },
];

/** Match the whole message so "hello, how much did I spend?" still asks for money. */
export function matchPekkaConversation(question: string): PekkaConversation | null {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;
  const withoutGreeting = normalized.replace(GREETING, '');
  const text = withoutGreeting.replace(ADDRESS, '').trim();
  if (!text && withoutGreeting !== normalized) return 'hello';
  return RESPONSES.find(({ pattern }) => pattern.test(text))?.id ?? null;
}
