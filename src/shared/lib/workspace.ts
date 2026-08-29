export function firstNonEmptyId(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && trimmed !== 'undefined' && trimmed !== 'null') return trimmed;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const record = value as Record<string, unknown>;
    for (const key of ['id', 'businessId', 'business_id']) {
      const field = record[key];
      if (typeof field === 'string' && field.trim() && field.trim() !== 'undefined') {
        return field.trim();
      }
    }
    if (record.business && typeof record.business === 'object') {
      const nested = firstNonEmptyId(record.business);
      if (nested) return nested;
    }
  }
  return '';
}

export function isNoAccessToBusinessError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /no access to business/i.test(message);
}

export function workspaceAccessMessage(error: unknown, fallback: string) {
  if (isNoAccessToBusinessError(error)) {
    return 'This space is still linking. Wait a moment and try again, or sign out and sign back in.';
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function personalWorkspaceName(name: string) {
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/).filter(Boolean)[0] || 'My';
  return `${first}'s workspace`;
}
