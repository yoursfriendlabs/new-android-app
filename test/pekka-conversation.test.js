import test from 'node:test';
import assert from 'node:assert/strict';

import { matchPekkaConversation as match } from '../src/features/pekka/lib/conversation.ts';
import { matchPekkaIntent } from '../src/features/pekka/lib/intent.ts';
import { parseEntry } from '../src/features/pekka/lib/entry-parser.ts';
import { en } from '../src/i18n/translations/en.ts';
import { ne } from '../src/i18n/translations/ne.ts';

test('everyday greetings and questions get conversational answers', () => {
  for (const text of ['Hello How are you', 'Hello! How are you?', 'Hey Pekka, how are you doing?', 'How’s it going?', 'how r u', 'and you?']) {
    assert.equal(match(text), 'wellbeing', text);
  }
  for (const text of ['hello', 'Hi there!', 'Good morning Pekka', 'नमस्ते']) {
    assert.equal(match(text), 'hello', text);
  }
});

test('Nepali script and romanised conversation are supported', () => {
  for (const text of ['Namaste, k cha?', 'namaste kasto cha', 'नमस्ते तपाईंलाई कस्तो छ?', 'सन्चै हुनुहुन्छ?']) {
    assert.equal(match(text), 'wellbeing', text);
  }
  assert.equal(match('धन्यवाद'), 'thanks');
  assert.equal(match('तिमी को हौ?'), 'identity');
  assert.equal(match('मद्दत गर्नुहोस्'), 'capabilities');
});

test('thanks, identity, help and corrections each have a relevant response', () => {
  assert.equal(match('Thank you so much!'), 'thanks');
  assert.equal(match('Who are you?'), 'identity');
  assert.equal(match('What can you do for me?'), 'capabilities');
  assert.equal(match('I am fine'), 'acknowledge');
  assert.equal(match('That’s not what I asked'), 'clarify');
  assert.equal(match('See you later'), 'goodbye');
});

test('greetings never swallow a records question, entry or product lookup', () => {
  for (const text of ['Hello, how much did I spend this month?', 'Hi, how do I add stock?', 'Hi, price of Sugar', 'Hello, Ram ko baki', 'Hi, sold 2 coke', 'thanks, show sales today', '', '   ']) {
    assert.equal(match(text), null, text);
  }
  assert.equal(matchPekkaIntent('Hello, how much did I spend this month?', false)?.id, 'expense');
  assert.equal(matchPekkaIntent('Hi, how do I add stock?', false)?.topic.id, 'stock');
  assert.equal(parseEntry('spent 250 on tea')?.type, 'money');
});

test('everyday talk — mood, praise, complaints, jokes and off-topic — gets a human answer', () => {
  for (const text of ['I am tired', 'business is slow', 'no customers today', 'thakai lagyo', 'आज राम्रो भएन']) {
    assert.equal(match(text), 'mood', text);
  }
  for (const text of ['Good job!', 'you are the best', 'wow', 'ramro cha', 'nice work']) {
    assert.equal(match(text), 'praise', text);
  }
  for (const text of ['you are useless', 'that is not right', 'you dont understand', 'kaam lagdaina']) {
    assert.equal(match(text), 'sorry', text);
  }
  assert.equal(match('Tell me a joke'), 'joke');
  for (const text of ['What is the weather?', 'what time is it', 'any news', 'cricket score']) {
    assert.equal(match(text), 'offTopic', text);
  }
  for (const text of ['are you there?', 'what are you doing', 'hello, are you busy?']) {
    assert.equal(match(text), 'checkIn', text);
  }
  assert.equal(match('are you real?'), 'identity');
  assert.equal(match('how are you doing bro'), 'wellbeing');
  assert.equal(match('thanks pekka'), 'thanks');
  assert.equal(match('ok na'), 'acknowledge');
});

test('conversation responses are translated and personal fallback stays relevant', () => {
  for (const dictionary of [en, ne]) {
    for (const id of ['hello', 'wellbeing', 'thanks', 'goodbye', 'identity', 'acknowledge', 'clarify', 'checkIn', 'mood', 'praise', 'sorry', 'joke', 'offTopic']) {
      assert.ok(dictionary.pekka.conversation[id]?.length, id);
    }
    assert.ok(dictionary.pekka.lookupHelpPersonal);
  }
  assert.doesNotMatch(en.pekka.lookupHelpPersonal, /stock|shop|sale/i);
});
