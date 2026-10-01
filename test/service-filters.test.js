import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countServiceFilters,
  EMPTY_SERVICE_FILTERS,
  matchesServiceFilters,
  resolveServiceCreator,
  resolveServiceType,
  serviceTypeLabel,
} from '../src/features/services/lib/service-view.ts';

function job(overrides = {}) {
  return {
    id: 's1',
    orderNo: 'SO-001',
    status: 'in_progress',
    partyId: 'p1',
    createdBy: 'u1',
    storeType: 'physical',
    laborTotal: 0,
    partsTotal: 0,
    subTotal: 0,
    taxTotal: 0,
    grandTotal: 0,
    receivedTotal: 0,
    items: [],
    ...overrides,
  };
}

test('an empty filter set matches everything and counts nothing', () => {
  assert.equal(countServiceFilters(EMPTY_SERVICE_FILTERS), 0);
  assert.equal(matchesServiceFilters(job(), EMPTY_SERVICE_FILTERS), true);
});

test('countServiceFilters counts only the ones that are set', () => {
  assert.equal(countServiceFilters({ partyId: 'p1', createdBy: '', storeType: '' }), 1);
  assert.equal(countServiceFilters({ partyId: 'p1', createdBy: 'u1', storeType: 'online' }), 3);
});

test('the customer filter keeps only that customer', () => {
  const filters = { ...EMPTY_SERVICE_FILTERS, partyId: 'p1' };
  assert.equal(matchesServiceFilters(job(), filters), true);
  assert.equal(matchesServiceFilters(job({ partyId: 'p2' }), filters), false);
  assert.equal(matchesServiceFilters(job({ partyId: undefined }), filters), false);
});

test('the opened-by filter reads createdBy or the nested creator', () => {
  const filters = { ...EMPTY_SERVICE_FILTERS, createdBy: 'u9' };
  assert.equal(matchesServiceFilters(job({ createdBy: 'u9' }), filters), true);
  assert.equal(matchesServiceFilters(job({ createdBy: '' , Creator: { id: 'u9', name: 'Sita' } }), filters), true);
  assert.equal(matchesServiceFilters(job(), filters), false);
});

test('resolveServiceCreator falls back to the nested creator for the name', () => {
  assert.deepEqual(resolveServiceCreator(job({ createdBy: '', Creator: { id: 'u3', name: 'Hari' } })), {
    id: 'u3',
    name: 'Hari',
  });
  assert.deepEqual(resolveServiceCreator(job({ createdByName: 'Ram' })), { id: 'u1', name: 'Ram' });
});

test('the type filter reads storeType first, then the older serviceType', () => {
  assert.equal(resolveServiceType(job({ storeType: 'ONLINE' })), 'online');
  assert.equal(resolveServiceType(job({ storeType: '', serviceType: 'online' })), 'online');

  const online = { ...EMPTY_SERVICE_FILTERS, storeType: 'online' };
  assert.equal(matchesServiceFilters(job({ storeType: 'online' }), online), true);
  assert.equal(matchesServiceFilters(job({ storeType: '', serviceType: 'online' }), online), true);
  assert.equal(matchesServiceFilters(job(), online), false);
});

test('a job with no type at all counts as physical, like the column default', () => {
  const physical = { ...EMPTY_SERVICE_FILTERS, storeType: 'physical' };
  assert.equal(matchesServiceFilters(job({ storeType: '', serviceType: '' }), physical), true);

  const online = { ...EMPTY_SERVICE_FILTERS, storeType: 'online' };
  assert.equal(matchesServiceFilters(job({ storeType: '', serviceType: '' }), online), false);
});

test('filters stack: all three have to agree', () => {
  const filters = { partyId: 'p1', createdBy: 'u1', storeType: 'physical' };
  assert.equal(matchesServiceFilters(job(), filters), true);
  assert.equal(matchesServiceFilters(job({ createdBy: 'u2' }), filters), false);
  assert.equal(matchesServiceFilters(job({ storeType: 'online' }), filters), false);
});

test('serviceTypeLabel reads back the way a shopkeeper would say it', () => {
  assert.equal(serviceTypeLabel('physical'), 'Physical');
  assert.equal(serviceTypeLabel('ONLINE'), 'Online');
  assert.equal(serviceTypeLabel(''), '');
  assert.equal(serviceTypeLabel('workshop'), 'Workshop');
});
