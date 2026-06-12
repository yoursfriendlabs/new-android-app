function normalizeApiBaseUrl(rawValue: string) {
  let value = rawValue.trim();

  if (!value) {
    return '';
  }

  // Common typo: "https:example.com" instead of "https://example.com".
  value = value.replace(/^(https?):(?!\/\/)/i, '$1://');

  return value.replace(/\/$/, '');
}

function getApiBaseUrlError(value: string) {
  if (!value) {
    return 'Missing EXPO_PUBLIC_API_BASE_URL';
  }

  try {
    const parsed = new URL(value);
    if (!parsed.protocol || !parsed.host) {
      return 'Invalid EXPO_PUBLIC_API_BASE_URL';
    }
    return null;
  } catch {
    return 'Invalid EXPO_PUBLIC_API_BASE_URL';
  }
}

const rawApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const apiBaseUrl = normalizeApiBaseUrl(rawApiBaseUrl);

export const env = {
  rawApiBaseUrl,
  apiBaseUrl,
  apiBaseUrlError: getApiBaseUrlError(apiBaseUrl),
};

export function hasApiBaseUrl() {
  return !env.apiBaseUrlError;
}
