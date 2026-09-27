import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { useFieldErrors } from '../src/shared/hooks/useFieldErrors.ts';
import { positiveNumber } from '../src/shared/lib/validation.ts';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('field errors appear after save, clear when corrected, and reset when a sheet reopens', async () => {
  let fields;
  let renderer;
  function Form({ amount, visible }) {
    fields = useFieldErrors(() => ({ amount: positiveNumber(amount) }), visible);
    return null;
  }
  const render = (amount, visible = true) => React.createElement(Form, { amount, visible });
  await act(async () => { renderer = create(render('')); });
  assert.deepEqual(fields.errors, {});
  await act(async () => { assert.equal(fields.check(), false); });
  assert.match(fields.errors.amount, /greater than zero/);
  await act(async () => { renderer.update(render('12')); });
  assert.equal(fields.errors.amount, '');
  await act(async () => { assert.equal(fields.check(), true); });
  await act(async () => { renderer.update(render('', false)); });
  await act(async () => { renderer.update(render('')); });
  assert.deepEqual(fields.errors, {});
  await act(async () => { assert.equal(fields.check(), false); });
  await act(async () => { fields.reset(); });
  assert.deepEqual(fields.errors, {});
  await act(async () => { renderer.unmount(); });
});
