import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateServicePayment } from '../src/features/services/lib/payment.ts';
import { normalizeService } from '../src/api/normalize.ts';

test('service payment records no more than the service total and returns the excess as change', () => {
  assert.deepEqual(calculateServicePayment(1_250, 1_500), {
    tendered: 1_500,
    receivedTotal: 1_250,
    changeDue: 250,
    balanceDue: 0,
  });
});

test('service payment keeps an unpaid balance for a partial advance', () => {
  assert.deepEqual(calculateServicePayment(1_250, 500), {
    tendered: 500,
    receivedTotal: 500,
    changeDue: 0,
    balanceDue: 750,
  });
});

test('a service without a target date stays unchecked and retains its service type', () => {
  const service = normalizeService({
    id: 'service-1',
    orderNo: 'SO-1',
    status: 'in_progress',
    service_type: 'online',
    createdAt: '2026-09-16',
  });

  assert.equal(service.deliveryDate, '');
  assert.equal(service.serviceType, 'online');
});
