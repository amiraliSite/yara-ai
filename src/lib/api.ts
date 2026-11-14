const TOKEN_KEY = "yara_auth_token_v1";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

const API_BASE = ((import.meta.env?.VITE_API_BASE_URL as string | undefined) || "").replace(/\/+$/, "");

export function resolveApiUrl(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return API_BASE ? `${API_BASE}${input}` : input;
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(resolveApiUrl(input), {
    ...init,
    headers,
    credentials: "include",
  });
}
