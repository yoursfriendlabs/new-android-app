import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeStoredSession,
  migrateLegacySecureSession,
  sanitizeSession,
  splitSessionForStorage,
} from '../src/shared/lib/session-storage.ts';

test('splitSessionForStorage keeps token out of SQLite meta payload', () => {
  const session = {
    token: 'jwt-token-value',
    businessId: 'biz-1',
    role: 'owner',
    businesses: [
      {
        id: 'biz-1',
        businessId: 'biz-1',
        name: 'Home',
        type: 'personal',
        label: 'Personal',
        role: 'owner',
        isOwner: true,
        isPersonal: true,
        isActive: true,
      },
    ],
    canCreateBusiness: true,
    user: {
      id: 'user-1',
      name: 'Dipesh',
      email: 'dipesh@example.com',
      role: 'owner',
    },
  };

  const split = splitSessionForStorage(session);
  assert.equal(split.token, 'jwt-token-value');
  assert.equal('token' in (split.meta ?? {}), false);
  assert.equal(split.meta?.businessId, 'biz-1');
  assert.equal(split.meta?.businesses?.length, 1);
});

test('mergeStoredSession rebuilds a session from token and meta', () => {
  const merged = mergeStoredSession('jwt-token-value', {
    businessId: 'biz-1',
    role: 'owner',
    businesses: [],
    canCreateBusiness: false,
    user: { id: 'user-1', name: 'Dipesh' },
  });

  assert.equal(merged?.token, 'jwt-token-value');
  assert.equal(merged?.businessId, 'biz-1');
});

test('migrateLegacySecureSession moves oversized legacy secure payloads into split storage', () => {
  const legacy = JSON.stringify({
    token: 'legacy-token',
    businessId: 'biz-legacy',
    role: 'owner',
    businesses: Array.from({ length: 12 }, (_, index) => ({
      id: `biz-${index}`,
      businessId: `biz-${index}`,
      name: `Workspace ${index}`,
      type: 'retail',
      label: 'Standard',
      role: 'owner',
      isOwner: true,
      isPersonal: false,
      isActive: true,
    })),
    canCreateBusiness: true,
    user: { id: 'user-1', name: 'Legacy User', email: 'legacy@example.com', role: 'owner' },
  });

  const migrated = migrateLegacySecureSession(legacy);
  assert.equal(migrated.token, 'legacy-token');
  assert.equal(migrated.meta?.businesses?.length, 12);
  assert.ok(JSON.stringify(migrated.meta).length > 2048);
  assert.ok(JSON.stringify(sanitizeSession({ token: migrated.token, ...migrated.meta })).length > 2048);
});
