import test from 'node:test';
import assert from 'node:assert/strict';

import {
  atMost,
  firstFieldError,
  hasFieldError,
  minLengthText,
  nonNegativeNumber,
  optionalEmail,
  optionalNumber,
  optionalPanVat,
  optionalPhone,
  panVatHint,
  positiveNumber,
  requiredEmail,
  requiredPhone,
  requiredText,
} from '../src/shared/lib/validation.ts';

test('requiredText only accepts something typed', () => {
  assert.equal(requiredText('', 'Enter a name.'), 'Enter a name.');
  assert.equal(requiredText('   ', 'Enter a name.'), 'Enter a name.');
  assert.equal(requiredText(' Ram ', 'Enter a name.'), '');
});

test('minLengthText counts trimmed characters', () => {
  assert.equal(minLengthText('R', 2, 'Too short'), 'Too short');
  assert.equal(minLengthText(' Ra ', 2, 'Too short'), '');
});

test('an optional email is fine when blank, checked when typed', () => {
  assert.equal(optionalEmail(''), '');
  assert.equal(optionalEmail('  '), '');
  assert.equal(optionalEmail('ram@'), 'Enter a valid email address.');
  assert.equal(optionalEmail('ram@shop.com'), '');
  assert.equal(optionalEmail(' Ram@Shop.COM '), '');
});

test('a required email says so when blank', () => {
  assert.equal(requiredEmail(''), 'Enter an email address.');
  assert.equal(requiredEmail('nope'), 'Enter a valid email address.');
  assert.equal(requiredEmail('ram@shop.com'), '');
});

test('a phone number needs enough digits to dial', () => {
  assert.equal(optionalPhone(''), '');
  assert.equal(optionalPhone('98'), 'A phone number needs at least 7 digits.');
  assert.equal(optionalPhone('01-4567890'), '');
  assert.equal(optionalPhone('abc'), 'A phone number is only digits.');
  assert.equal(requiredPhone(''), 'Enter a phone number.');
  assert.equal(requiredPhone('980000000'), 'A phone number needs at least 10 digits.');
  assert.equal(requiredPhone('9800000000'), '');
});

test('PAN rejects letters but allows an unusual length with a hint', () => {
  assert.equal(optionalPanVat(''), '');
  assert.equal(optionalPanVat('123456789'), '');
  assert.equal(optionalPanVat('123-456 789'), '');
  assert.equal(optionalPanVat('PAN12345'), 'A PAN or VAT number is only digits.');
  assert.equal(panVatHint('123456789'), '');
  assert.equal(panVatHint(''), '');
  assert.match(panVatHint('12345'), /9 digits/);
});

test('number checks tell blank, zero and negative apart', () => {
  assert.equal(positiveNumber('5'), '');
  assert.equal(positiveNumber('0'), 'Enter an amount greater than zero.');
  assert.equal(positiveNumber('-2'), 'Enter an amount greater than zero.');
  assert.equal(positiveNumber('abc'), 'Enter a number.');
  assert.equal(nonNegativeNumber(''), '');
  assert.equal(nonNegativeNumber('0'), '');
  assert.equal(nonNegativeNumber('-1'), 'Enter zero or more.');
  assert.equal(optionalNumber(''), '');
  assert.equal(optionalNumber('12.5'), '');
  assert.equal(optionalNumber('twelve'), 'Enter a number.');
  assert.equal(atMost('5', 10, 'Too much'), '');
  assert.equal(atMost('50', 10, 'Too much'), 'Too much');
});

test('an error map reports whether anything is wrong, and what came first', () => {
  assert.equal(hasFieldError({ name: '', price: '' }), false);
  assert.equal(hasFieldError({ name: '', price: 'Enter a price.' }), true);
  assert.equal(firstFieldError({ name: '', price: 'Enter a price.' }), 'Enter a price.');
  assert.equal(firstFieldError({ name: '' }), '');
});
