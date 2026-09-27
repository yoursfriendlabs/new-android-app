import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { useSubmissionLock } from '../src/shared/hooks/useSubmissionLock.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('rapid confirm and print taps submit once, show busy, and release after completion', async () => {
  let lock;
  let renderer;
  function Form() { lock = useSubmissionLock(); return null; }
  await act(async () => { renderer = create(React.createElement(Form)); });
  let complete;
  const request = new Promise((resolve) => { complete = resolve; });
  let writes = 0;
  async function submit() {
    if (!lock.tryStart()) return;
    try { writes++; await request; } finally { lock.finish(); }
  }
  let first;
  await act(async () => {
    first = submit();
    await submit(); // Same render, before the disabled button can appear.
  });
  assert.equal(writes, 1);
  assert.equal(lock.busy, true);
  await act(async () => { await submit(); });
  assert.equal(writes, 1);
  await act(async () => { complete(); await first; });
  assert.equal(lock.busy, false);
  await act(async () => { await submit(); });
  assert.equal(writes, 2);
  await act(async () => { renderer.unmount(); });
});

test('a failed save releases the lock so the user can retry', async () => {
  let lock;
  let renderer;
  function Form() { lock = useSubmissionLock(); return null; }
  await act(async () => { renderer = create(React.createElement(Form)); });
  let calls = 0;
  async function submit() {
    if (!lock.tryStart()) return;
    try { calls++; throw new Error('Network unavailable'); } finally { lock.finish(); }
  }
  await act(async () => { await assert.rejects(submit, /Network unavailable/); });
  assert.equal(lock.busy, false);
  await act(async () => { await assert.rejects(submit, /Network unavailable/); });
  assert.equal(calls, 2);
  await act(async () => { renderer.unmount(); });
});
