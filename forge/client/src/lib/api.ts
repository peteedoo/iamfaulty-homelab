// Shared client helpers for talking to the Forge API.

export function getAuthToken(): string | undefined {
  const fromEnv = import.meta.env.VITE_FORGE_AUTH_TOKEN as string | undefined;
  if (fromEnv) return fromEnv;
  try {
    return localStorage.getItem("forge_auth_token") ?? undefined;
  } catch {
    return undefined;
  }
}

export function authHeaders(
  base: Record<string, string> = {}
): Record<string, string> {
  const token = getAuthToken();
  return token ? { ...base, Authorization: `Bearer ${token}` } : { ...base };
}

// Turns a non-2xx API response into an Error carrying the server's message,
// so callers never treat a 401/403/500 as a successful empty result.
export async function assertOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let detail = "";
  try {
    const body = (await res.clone().json()) as { error?: string };
    detail = body.error ?? "";
  } catch {
    detail = "";
  }
  throw new Error(detail || `Request failed (${res.status} ${res.statusText})`);
}

// crypto.randomUUID is only defined in secure contexts (https / localhost).
// Fall back so the UI keeps working over plain http on a LAN IP.
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
