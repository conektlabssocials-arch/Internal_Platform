const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type ApiOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | object | null;
};

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

    throw new Error(message);
  }

  return response.json() as Promise<T>;
};
