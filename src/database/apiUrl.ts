/** Relative `/api` in dev uses the Vite proxy (see vite.config.ts). Override with VITE_API_BASE_URL. */
export const API_ROOT =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "/api";

/** WebSocket origin: VITE_WS_BASE_URL, else API host, else current page (Vite /ws proxy). */
export function wsBaseUrl(): string {
  const explicit = import.meta.env.VITE_WS_BASE_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");

  const api = API_ROOT;
  if (api.startsWith("https://")) {
    return `wss://${new URL(api).host}`;
  }
  if (api.startsWith("http://")) {
    return `ws://${new URL(api).host}`;
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }

  return "ws://localhost:8000";
}

/**
 * Build a URL safe for `fetch()` in the browser.
 * Relative paths (e.g. `/api/...`) must not be passed to `new URL()` without a base.
 */
export function buildApiUrl(
  path: string,
  params?: Record<string, string | undefined>
): string {
  const base = API_ROOT.replace(/\/$/, "");
  const segment = path.startsWith("/") ? path : `/${path}`;
  const pathname = `${base}${segment}`;

  const searchParams = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, value);
      }
    }
  }
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : "";

  if (base.startsWith("http://") || base.startsWith("https://")) {
    return `${pathname}${suffix}`;
  }

  return `${pathname}${suffix}`;
}
