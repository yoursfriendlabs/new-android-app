import { normalizeQuestion } from './intent';

/**
 * Everyday talk, not records. Pekka is meant to feel like a friend behind the
 * counter, so "how are you", "I'm tired", "you're useless" and "tell me a joke"
 * all get a human answer instead of being pushed at the database.
 */

export type PekkaConversation =
  | 'hello'
  | 'wellbeing'
  | 'thanks'
  | 'goodbye'
  | 'identity'
  | 'capabilities'
  | 'acknowledge'
  | 'clarify'
  | 'checkIn'
  | 'mood'
  | 'praise'
  | 'sorry'
  | 'joke'
  | 'offTopic';

const GREETING = /^(?:(?:hello|helo|hlo|hi|hii+|hey+|yo|namaste|namaskar|नमस्ते|नमस्कार|good morning|good afternoon|good evening|subha prabhat|शुभ प्रभात)(?: |$))+/;
const ADDRESS = /^(?:pekka|पेक्का|there|friend)(?: |$)| (?:pekka|पेक्का|friend)$/g;
// Words people tack on that carry no meaning for us: "how are you bro", "ok na".
const FILLER = /^(?:please|plz)(?: |$)| (?:please|plz|bro|bhai|dai|didi|sir|madam|maam|yaar|hajur|hai|na|ni|la|today|aaja)$/g;

const RESPONSES: Array<{ id: PekkaConversation; pattern: RegExp }> = [
  {
    id: 'wellbeing',
    pattern:
      /^(?:how (?:are|r|is|s) (?:you|u|yo|it|things|life|everything)(?: doing| going| today| there)?|hows (?:it going|life|everything|your day)|whats up|what is up|sup|how have you been|how you doing|you (?:good|ok|okay|alright)|all good|and (?:you|u)|what about you|k(?:e|a)? (?:cha|chha|xa|khabar)|kasto (?:cha|chha|xa|chhau|chau)|sanchai (?:chau|chhau|cha|chha|hunuhunchha|hunuhuncha)|तिमीलाई कस्तो छ|तपाईंलाई कस्तो छ|तपाईलाई कस्तो छ|कस्तो छ|के छ|के खबर|सन्चै (?:छौ|हुनुहुन्छ))$/,
  },
  {
    id: 'thanks',
    pattern: /^(?:thanks(?: a lot| so much| a ton)?|thank (?:you|u)(?: very much| so much)?|thankyou|thx|tysm|dhanyabad|dhanyavaad|dherai dhanyabad|धन्यवाद|धेरै धन्यवाद)$/,
  },
  {
    id: 'goodbye',
    pattern: /^(?:bye|bye bye|goodbye|good bye|see you(?: later| tomorrow)?|talk (?:to you )?later|catch you later|good night|gn|im (?:off|leaving)|i am (?:off|leaving)|jaanchu|jancu|pheri bhetaula|शुभ रात्री|शुभ रात्रि|फेरि भेटौँ|गएँ)$/,
  },
  {
    id: 'identity',
    pattern:
      /^(?:who (?:are|r) (?:you|u)|what(?: is|s) your name|do you have a name|are you (?:a bot|a robot|ai|an ai|real|human|a human|a person|alive)|who made you|who built you|who created you|where are you from|how old are you|tim(?:i|ro) (?:ko ho|naam ke ho)|तिमी को हौ|तपाईं को हुनुहुन्छ|तिम्रो नाम के हो|तिमीलाई कसले बनायो)$/,
  },
  {
    id: 'capabilities',
    pattern:
      /^(?:help(?: me)?|what can you do(?: for me)?|how can you help(?: me)?|what can i ask(?: you)?|what do you do|what do you know|how do you work|what are you for|मद्दत(?: गर| गर्नुहोस्)?|के गर्न सक्छौ|तिमी के गर्न सक्छौ|तिमीले के जान्दछौ)$/,
  },
  {
    id: 'checkIn',
    pattern:
      /^(?:are you (?:there|here|busy|awake|listening|free)|you there|hello there|anyone there|what are you doing|whatre you doing|what you doing|k gardai (?:cha|chau|chhau)|के गर्दैछौ|छौ\?*)$/,
  },
  {
    id: 'mood',
    pattern:
      /^(?:i(?:m| am)? (?:tired|sad|bored|upset|stressed|worried|angry|sick|unwell|not (?:good|well|ok|okay|fine)|feeling (?:low|bad|sad|tired)|so tired)|im not (?:good|well|ok|okay|fine)|not (?:good|great|so good)|feeling (?:low|bad|sad|tired|down)|today was (?:bad|hard|tough|slow)|business is (?:slow|bad|down|not good)|no (?:customers|sales|business)(?: today)?|bikri (?:chaina|bhaena|ramro chaina)|thakai lagyo|dikka lagyo|man ramro chaina|aaja ramro bhaena|थकाइ लाग्यो|दिक्क लाग्यो|मन राम्रो छैन|बिक्री भएन|आज राम्रो भएन)$/,
  },
  {
    id: 'praise',
    pattern:
      /^(?:good (?:job|work|one|boy)|well done|nice(?: work| one| job)?|great(?: work| job)?|awesome|amazing|excellent|perfect|wow|super|youre (?:the best|great|good|smart|helpful|amazing)|you are (?:the best|great|good|smart|helpful|amazing)|i love you|love you|ramro (?:cha|chha|xa)|badhiya|ekdam ramro|राम्रो छ|बढिया|एकदम राम्रो)$/,
  },
  {
    id: 'sorry',
    pattern:
      /^(?:youre (?:useless|stupid|dumb|bad|wrong|no help|not helpful)|you are (?:useless|stupid|dumb|bad|wrong|no help|not helpful)|you (?:dont|do not) (?:know|understand)(?: anything| nothing| me)?|thats wrong|wrong answer|that(?: is|s) not (?:right|correct)|not helpful|useless|kaam lagdaina|kaam lagena|galat|गलत|काम लाग्दैन)$/,
  },
  {
    id: 'joke',
    pattern: /^(?:tell (?:me )?a joke|say something funny|make me laugh|any jokes|joke sunau|joke suna|एउटा जोक सुनाऊ|हँसाऊ)$/,
  },
  {
    id: 'offTopic',
    pattern:
      /^(?:(?:what(?: is|s)? the )?weather(?: today| like)?|will it rain(?: today)?|what time is it|whats the time|what(?: is|s) the date|todays news|whats the news|any news|who is the prime minister|cricket score|football score|sing (?:me )?a song|tell me a story|what should i eat|पानी पर्छ|मौसम कस्तो छ|अहिले कति बज्यो|समाचार)$/,
  },
  {
    id: 'acknowledge',
    pattern:
      /^(?:ok|oki|okay|k|alright|got it|understood|sure|fine|cool|yes|yeah|yep|yup|no|nope|hmm+|im (?:fine|good|well|ok|okay)|i am (?:fine|good|well|ok|okay)|sanchai chu|thik cha|thik chha|huncha|hunchha|ठीक छ|हुन्छ|सन्चै छु)$/,
  },
  {
    id: 'clarify',
    pattern:
      /^(?:i dont understand|i didnt understand|that(?: is|s) (?:wrong|not what i asked)|you (?:didnt|dont) understand|what do you mean|come again|say (?:that )?again|repeat(?: that| please)?|मैले बुझिन|बुझिन|फेरि भन)$/,
  },
];

/** Match the whole message so "hello, how much did I spend?" still asks for money. */
export function matchPekkaConversation(question: string): PekkaConversation | null {
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;
  const withoutGreeting = normalized.replace(GREETING, '');
  const addressed = withoutGreeting.replace(ADDRESS, '').trim();
  // Strip trailing "bro", "hai", "please" — twice, so "ok na bro" still lands.
  const text = addressed.replace(FILLER, '').replace(FILLER, '').trim();
  if (!text) return withoutGreeting !== normalized || addressed !== withoutGreeting ? 'hello' : null;
  return RESPONSES.find(({ pattern }) => pattern.test(text))?.id ?? null;
}
