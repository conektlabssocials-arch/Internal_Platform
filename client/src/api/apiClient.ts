const configuredLegacyUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
const configuredServerUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
const usesRelativeApiUrl = configuredLegacyUrl?.startsWith('/') || false;
const legacyServerUrl = usesRelativeApiUrl
  ? undefined
  : configuredLegacyUrl?.replace(/\/api$/, '');
export const SERVER_BASE_URL =
  configuredServerUrl ??
  legacyServerUrl ??
  (import.meta.env.DEV ? 'http://localhost:5000' : '');
export const API_BASE_URL =
  usesRelativeApiUrl && import.meta.env.DEV
    ? `${SERVER_BASE_URL}${configuredLegacyUrl}`
    : configuredLegacyUrl?.endsWith('/api')
      ? configuredLegacyUrl
      : `${SERVER_BASE_URL}/api`;

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null;
};

export const AUTH_UNAUTHORIZED_EVENT = 'conekt:auth-unauthorized';

export const apiRequest = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body,
    credentials: 'include',
  });

  if (!response.ok) {
    let message = 'Request failed';

    try {
      const data = (await response.json()) as { message?: string };
      message = data.message || message;
    } catch {
      message = response.statusText || message;
    }

    if (response.status === 401 && path !== '/auth/me') {
      window.dispatchEvent(
        new CustomEvent(AUTH_UNAUTHORIZED_EVENT, { detail: { message } }),
      );
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
};
