import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSignupDetailsError,
  getSignupEmailError,
  resolveAuthMessage,
} from '../src/features/auth/lib/auth.ts';

const goodDetails = {
  name: 'Ram Bahadur',
  phone: '9800000000',
  password: 'Password123',
  confirmPassword: 'Password123',
};

test('getSignupEmailError only looks at the email', () => {
  assert.equal(getSignupEmailError(''), 'Enter your email address.');
  assert.equal(getSignupEmailError('ram@'), 'Enter a valid email address.');
  assert.equal(getSignupEmailError('  Ram@Example.com '), '');
});

test('getSignupDetailsError no longer needs the email', () => {
  assert.equal(getSignupDetailsError(goodDetails), '');
  assert.equal(getSignupDetailsError({ ...goodDetails, name: 'R' }), 'Enter your full name.');
  assert.match(getSignupDetailsError({ ...goodDetails, phone: '98' }), /at least 10 digits/);
  assert.equal(getSignupDetailsError({ ...goodDetails, password: 'short' }), 'Use at least 8 characters.');
  assert.equal(getSignupDetailsError({ ...goodDetails, confirmPassword: 'Password124' }), 'Passwords do not match.');
});

test('resolveAuthMessage explains Google-only accounts and linked emails', () => {
  assert.equal(
    resolveAuthMessage(new Error('This account uses Google sign-in'), 'x'),
    'This account signs in with Google. Tap Continue with Google.',
  );
  assert.match(
    resolveAuthMessage(new Error('This email is linked to a different Google account'), 'x'),
    /different Google account/,
  );
  assert.equal(
    resolveAuthMessage(new Error('Email already in use'), 'x'),
    'This email already has an account. Sign in or reset your password.',
  );
  assert.equal(resolveAuthMessage(new Error(''), 'fallback'), 'fallback');
});
