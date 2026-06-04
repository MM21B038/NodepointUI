import { buildApiUrl } from "@/database/apiUrl";

const ACCESS_KEY = "np_access";
const REFRESH_KEY = "np_refresh";

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

function flattenFieldErrors(data: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === "error" || key === "detail" || key === "message") continue;
    if (Array.isArray(value)) {
      const text = value.map(String).join(", ");
      if (text) parts.push(`${key}: ${text}`);
    } else if (typeof value === "string" && value.trim()) {
      parts.push(`${key}: ${value}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : undefined;
}

export async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      return (
        (typeof obj.error === "string" ? obj.error : undefined) ||
        (typeof obj.detail === "string" ? obj.detail : undefined) ||
        (typeof obj.message === "string" ? obj.message : undefined) ||
        (Array.isArray(obj.non_field_errors)
          ? obj.non_field_errors.join(", ")
          : undefined) ||
        flattenFieldErrors(obj) ||
        response.statusText
      );
    }
    return response.statusText;
  } catch {
    return response.statusText;
  }
}

/** User-facing message for group membership POST/DELETE failures. */
export async function formatMembershipMutationError(
  response: Response,
  fallback = "Update failed."
): Promise<string> {
  const message = await parseErrorResponse(response);
  if (message && message !== response.statusText) return message;
  if (response.status === 404) {
    return "Resource not found or not accessible.";
  }
  if (response.status === 403) {
    return "You cannot add this resource to this group.";
  }
  return fallback;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const SESSION_EXPIRED_EVENT = "np:session-expired";

export function notifySessionExpired(): void {
  clearTokens();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearTokens();
    return null;
  }

  const response = await fetch(buildApiUrl("/auth/token/refresh/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) {
    notifySessionExpired();
    return null;
  }

  const data = (await response.json()) as { access?: string; refresh?: string };
  if (!data.access) {
    notifySessionExpired();
    return null;
  }

  setTokens(data.access, data.refresh ?? refresh);
  return data.access;
}

function coordinatedRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export type ApiFetchInit = RequestInit & {
  /** Skip Authorization header (public endpoints). */
  public?: boolean;
  /** Skip automatic refresh on 401. */
  skipAuthRetry?: boolean;
};

function isFormData(body: RequestInit["body"]): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export async function apiFetch(
  path: string,
  init: ApiFetchInit = {},
  params?: Record<string, string | undefined>
): Promise<Response> {
  const { public: isPublic, skipAuthRetry, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);

  if (!isFormData(requestInit.body) && !headers.has("Content-Type")) {
    if (
      requestInit.body !== undefined &&
      requestInit.body !== null &&
      typeof requestInit.body === "string"
    ) {
      headers.set("Content-Type", "application/json");
    }
  }

  if (!isPublic) {
    const access = getAccessToken();
    if (access) {
      headers.set("Authorization", `Bearer ${access}`);
    }
  }

  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = buildApiUrl(normalized, params);
  let response = await fetch(url, { ...requestInit, headers });

  if (
    response.status === 401 &&
    !isPublic &&
    !skipAuthRetry &&
    getRefreshToken()
  ) {
    const newAccess = await coordinatedRefresh();
    if (newAccess) {
      headers.set("Authorization", `Bearer ${newAccess}`);
      response = await fetch(url, { ...requestInit, headers });
    }
  }

  if (response.status === 401 && !isPublic) {
    notifySessionExpired();
    throw new AuthError("Session expired. Please sign in again.");
  }

  return response;
}

export async function apiFetchPublic(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return apiFetch(path, { ...init, public: true, skipAuthRetry: true });
}

export async function apiFetchJson<T>(
  path: string,
  init: ApiFetchInit = {}
): Promise<T> {
  const response = await apiFetch(path, init);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function apiFetchPublicJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await apiFetchPublic(path, init);
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return (await response.json()) as T;
}
