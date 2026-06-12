import { env } from '@/src/lib/env';
import { loadSession } from '@/src/lib/session';

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const INVALID_SESSION_ERROR_MESSAGE = 'Session expired. Please sign in again.';

export function buildQueryString(params?: Record<string, unknown>) {
  if (!params) return '';

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    searchParams.append(key, String(value));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

let unauthorizedHandler: null | (() => void | Promise<void>) = null;
let isHandlingUnauthorized = false;

export function setUnauthorizedHandler(handler: null | (() => void | Promise<void>)) {
  unauthorizedHandler = handler;
}

async function notifyUnauthorized() {
  if (!unauthorizedHandler || isHandlingUnauthorized) {
    return;
  }

  isHandlingUnauthorized = true;
  try {
    await unauthorizedHandler();
  } finally {
    isHandlingUnauthorized = false;
  }
}

function shouldInvalidateSession(status: number, auth: boolean, message: string) {
  if (!auth) {
    return false;
  }

  if (/current password|incorrect password/i.test(message)) {
    return false;
  }

  if (status === 401 && !message) {
    return true;
  }

  if (status !== 401 && status !== 403) {
    return false;
  }

  return /invalid token|token expired|expired token|jwt|unauthorized|not authenticated|session expired/i.test(
    message,
  );
}

export function isInvalidSessionError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (/missing session token/i.test(String(error.message ?? ''))) {
    return true;
  }

  return shouldInvalidateSession(
    Number(error.status ?? 0),
    true,
    String(error.message ?? ''),
  );
}

interface RequestConfig<TBody> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  query?: object;
  body?: TBody;
  auth?: boolean;
  businessScoped?: boolean;
  headers?: Record<string, string>;
}

export async function apiRequest<TResponse, TBody = undefined>({
  method = 'GET',
  path,
  query,
  body,
  auth = true,
  businessScoped = auth,
  headers: extraHeaders,
}: RequestConfig<TBody>): Promise<TResponse> {
  if (env.apiBaseUrlError) {
    throw new ApiError(
      `${env.apiBaseUrlError}. Use a full base URL like https://devapi.yoursfriend.com`,
    );
  }

  const session = auth ? await loadSession() : null;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extraHeaders ?? {}),
  };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (!isFormData && body !== undefined && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = session?.token || (global as any).apiToken;
    const businessId = session?.businessId || (global as any).apiBusinessId;

    if (!token) {
      throw new ApiError('Missing session token');
    }

    if (businessScoped && !businessId) {
      throw new ApiError('Missing business id');
    }

    headers.Authorization = `Bearer ${token}`;
    if (businessScoped && businessId) {
      headers['x-business-id'] = businessId;
    }
  }

  const requestUrl = `${env.apiBaseUrl}${path}${buildQueryString((query ?? {}) as Record<string, unknown>)}`;

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? (body as BodyInit) : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(
      `Network request failed for ${requestUrl}. Check that EXPO_PUBLIC_API_BASE_URL is correct and includes https://`,
      undefined,
      error,
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String(payload.message)
        : `Request failed with status ${response.status}`;

    console.warn(`[API ERROR] ${method} ${requestUrl} -> Status ${response.status}: ${message}`);

    if (shouldInvalidateSession(response.status, auth, message)) {
      await notifyUnauthorized();
      throw new ApiError(INVALID_SESSION_ERROR_MESSAGE, response.status, payload);
    }

    throw new ApiError(message, response.status, payload);
  }

  return payload as TResponse;
}

export async function uploadMultipart<TResponse>({
  path,
  formData,
  auth = true,
  businessScoped = true,
}: {
  path: string;
  formData: FormData;
  auth?: boolean;
  businessScoped?: boolean;
}) {
  return apiRequest<TResponse, FormData>({
    method: 'POST',
    path,
    body: formData,
    auth,
    businessScoped,
  });
}
