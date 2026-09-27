import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceDraftLineErrors } from '../src/features/services/lib/service-draft-validation.ts';
import { hasFieldError } from '../src/shared/lib/validation.ts';

const labor = { id: 'line-1', itemType: 'labor', description: 'Repair', quantity: 1, unitPrice: 50, taxRate: 0, unitType: 'primary', product: null };

test('service drafts reject invalid lines before saving, including restored drafts', () => {
  assert.equal(hasFieldError(serviceDraftLineErrors(labor)), false);
  for (const patch of [{ quantity: 0 }, { quantity: NaN }, { unitPrice: -1 }, { unitPrice: Infinity }, { taxRate: 101 }, { description: ' ' }]) {
    assert.equal(hasFieldError(serviceDraftLineErrors({ ...labor, ...patch })), true);
  }
  assert.equal(hasFieldError(serviceDraftLineErrors({ ...labor, unitPrice: 0 })), false);
});

test('stock service lines require a product and a valid secondary conversion', () => {
  const part = { ...labor, itemType: 'part', description: '' };
  assert.match(serviceDraftLineErrors(part).product, /Pick the product/);
  assert.equal(hasFieldError(serviceDraftLineErrors({ ...part, product: { id: 'product-1' } })), false);
  assert.match(serviceDraftLineErrors({ ...part, product: { id: 'product-1' }, unitType: 'secondary' }).unitType, /conversion rate/);
  assert.equal(hasFieldError(serviceDraftLineErrors({ ...part, product: { id: 'product-1', secondaryConversionRate: 12 }, unitType: 'secondary' })), false);
});
