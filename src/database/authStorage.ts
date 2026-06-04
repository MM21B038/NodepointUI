import {
  apiFetch,
  apiFetchJson,
  apiFetchPublicJson,
  clearTokens,
  setTokens,
} from "@/database/apiClient";

export type UserRole = "user" | "admin" | "superadmin";
export type AccountState = "active" | "inactive" | "pending_deletion";
export type UserStatus = "active" | "pending_deletion" | "purged";
export type ApiKeyStatus = "active" | "inactive" | "expired";

export interface AuthPagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  managed_by?: number | null;
  managed_by_username?: string | null;
  date_joined?: string;
  is_active?: boolean;
  status?: UserStatus;
  account_state?: AccountState;
  purge_scheduled_at?: string | null;
  allowed_scopes?: string[] | null;
  api_keys_total?: number;
  api_keys_active?: number;
  workspaces_total?: number;
  can_activate?: boolean;
  can_deactivate?: boolean;
  can_purge_permanently?: boolean;
  can_recover?: boolean;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface AuthUserRecord extends AuthUser {
  password?: string;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  user_id?: number;
  user?: number;
  username?: string;
  user_username?: string;
  user_role?: UserRole;
  allowed_scopes: string[];
  scopes?: string[];
  expires_at: string;
  is_active?: boolean;
  key_status?: ApiKeyStatus;
  is_expired?: boolean;
  last_used_at?: string | null;
  created_at: string;
  prefix?: string;
}

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string;
  secret?: string;
  prefix?: string;
  allowed_scopes?: string[];
  scopes?: string[];
  expires_at: string;
  created_at: string;
}

export interface AuthScopeOption {
  id: string;
  label: string;
}

export interface AuthScopesResponse {
  scopes?: unknown;
  expiry_presets?: unknown;
  available_scopes?: unknown;
  expiries?: unknown;
}

export interface ListUsersParams {
  role?: UserRole;
  account_state?: AccountState;
  status?: "active" | "pending_deletion";
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ListUsersResult {
  users: AuthUserRecord[];
  pagination: AuthPagination | null;
}

export interface ListApiKeysParams {
  user_id?: number;
  role?: UserRole;
  is_active?: boolean;
  include_expired?: boolean;
  page?: number;
  page_size?: number;
}

export interface ListApiKeysResult {
  apiKeys: ApiKeyRecord[];
  pagination: AuthPagination | null;
}

export interface MeAllowedScopesData {
  allowedScopes: string[] | null;
  availableScopes: AuthScopeOption[];
}

export interface DeletionStatus {
  pending_deletion?: boolean;
  purge_scheduled_at?: string | null;
  days_remaining?: number | null;
  account_state?: AccountState;
  [key: string]: unknown;
}

export interface PurgeUserResult {
  user_id: number;
  username: string;
  workspaces_removed?: number;
  purged: boolean;
  recoverable: boolean;
}

/** Minimal fallback when /auth/scopes/ is unreachable — must match server codes. */
const FALLBACK_API_KEY_SCOPES = [
  "workspace:read",
  "workspace:write",
  "chat:read",
  "chat:write",
  "document:read",
  "document:write",
  "preprocess:read",
  "preprocess:write",
];

const FALLBACK_EXPIRY_PRESETS = [
  "3_months",
  "6_months",
  "12_months",
  "2_years",
];

function optionFromEntry(
  id: string,
  label: unknown
): AuthScopeOption | null {
  const key = id.trim();
  if (!key) return null;
  const text =
    typeof label === "string" && label.trim()
      ? label.trim()
      : key;
  return { id: key, label: text };
}

/** Normalize scopes or expiry presets from string[], object map, or object[]. */
export function normalizeAuthScopeOptions(value: unknown): AuthScopeOption[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    const out: AuthScopeOption[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        const opt = optionFromEntry(item, item);
        if (opt) out.push(opt);
        continue;
      }
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const id = String(
          o.scope ?? o.id ?? o.value ?? o.key ?? o.name ?? ""
        ).trim();
        const label = o.label ?? o.description ?? o.title ?? o.name ?? id;
        const opt = optionFromEntry(id, label);
        if (opt) out.push(opt);
      }
    }
    return out;
  }

  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([id, label]) => optionFromEntry(id, label))
      .filter((x): x is AuthScopeOption => x !== null);
  }

  if (typeof value === "string" && value.trim()) {
    return [{ id: value.trim(), label: value.trim() }];
  }

  return [];
}

function normalizePagination(raw: unknown): AuthPagination | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.page !== "number") return null;
  return {
    page: Number(p.page),
    page_size: Number(p.page_size ?? 20),
    total_items: Number(p.total_items ?? 0),
    total_pages: Number(p.total_pages ?? 1),
    has_next: Boolean(p.has_next),
    has_previous: Boolean(p.has_previous),
  };
}

export function normalizeUserRecord(raw: Record<string, unknown>): AuthUserRecord {
  return {
    id: Number(raw.id),
    username: String(raw.username ?? ""),
    role: (raw.role as UserRole) ?? "user",
    managed_by:
      raw.managed_by != null ? Number(raw.managed_by) : raw.managed_by_id != null
        ? Number(raw.managed_by_id)
        : null,
    managed_by_username:
      raw.managed_by_username != null
        ? String(raw.managed_by_username)
        : null,
    date_joined:
      raw.date_joined != null ? String(raw.date_joined) : undefined,
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    status: raw.status as UserStatus | undefined,
    account_state: raw.account_state as AccountState | undefined,
    purge_scheduled_at:
      raw.purge_scheduled_at != null
        ? String(raw.purge_scheduled_at)
        : null,
    allowed_scopes: Array.isArray(raw.allowed_scopes)
      ? (raw.allowed_scopes as string[])
      : Array.isArray(raw.access)
        ? (raw.access as string[])
        : raw.allowed_scopes === null
          ? null
          : undefined,
    api_keys_total:
      raw.api_keys_total != null ? Number(raw.api_keys_total) : undefined,
    api_keys_active:
      raw.api_keys_active != null ? Number(raw.api_keys_active) : undefined,
    workspaces_total:
      raw.workspaces_total != null
        ? Number(raw.workspaces_total)
        : undefined,
    can_activate: Boolean(raw.can_activate),
    can_deactivate: Boolean(raw.can_deactivate),
    can_purge_permanently: Boolean(raw.can_purge_permanently),
    can_recover: Boolean(raw.can_recover),
  };
}

export function normalizeApiKeyRecord(raw: Record<string, unknown>): ApiKeyRecord {
  const scopes = Array.isArray(raw.allowed_scopes)
    ? (raw.allowed_scopes as string[])
    : Array.isArray(raw.scopes)
      ? (raw.scopes as string[])
      : [];
  return {
    id: String(raw.id),
    name: String(raw.name ?? ""),
    user_id:
      raw.user_id != null
        ? Number(raw.user_id)
        : raw.user != null
          ? Number(raw.user)
          : undefined,
    user:
      raw.user != null
        ? Number(raw.user)
        : raw.user_id != null
          ? Number(raw.user_id)
          : undefined,
    username:
      raw.user_username != null
        ? String(raw.user_username)
        : raw.username != null
          ? String(raw.username)
          : undefined,
    user_username:
      raw.user_username != null ? String(raw.user_username) : undefined,
    user_role: raw.user_role as UserRole | undefined,
    allowed_scopes: scopes,
    scopes,
    expires_at: String(raw.expires_at ?? ""),
    is_active: raw.is_active !== undefined ? Boolean(raw.is_active) : true,
    key_status: raw.key_status as ApiKeyStatus | undefined,
    is_expired: Boolean(raw.is_expired),
    last_used_at:
      raw.last_used_at != null ? String(raw.last_used_at) : null,
    created_at: String(raw.created_at ?? ""),
    prefix: raw.prefix != null ? String(raw.prefix) : undefined,
  };
}

export function accountStateLabel(state: AccountState | undefined): string {
  switch (state) {
    case "inactive":
      return "Inactive";
    case "pending_deletion":
      return "Pending deletion";
    case "active":
    default:
      return "Active";
  }
}

export function isAdminRole(role: UserRole | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

function isAuthenticatedRole(role: UserRole | undefined): boolean {
  return role === "user" || isAdminRole(role);
}

/** Workspace preprocess-status on Documents — all authenticated roles (API: preprocess:read). */
export function canViewWorkspacePreprocessStatus(
  role: UserRole | undefined
): boolean {
  return isAuthenticatedRole(role);
}

/** POST workspace preprocess / retry — default user scope includes preprocess:write. */
export function canTriggerWorkspacePreprocess(
  role: UserRole | undefined
): boolean {
  return isAuthenticatedRole(role);
}

/** Global RQ queue panel, workspace-card Extract — admin operators only. */
export function canViewGlobalPreprocessQueue(role: UserRole | undefined): boolean {
  return isAdminRole(role);
}

/** @deprecated Use canViewGlobalPreprocessQueue */
export function canViewPreprocessPipeline(role: UserRole | undefined): boolean {
  return canViewGlobalPreprocessQueue(role);
}

/** Scope ids ending in `:read` (typical end-user default). */
export function readOnlyScopeIds(options: AuthScopeOption[]): string[] {
  return options.map((o) => o.id).filter((id) => id.endsWith(":read"));
}

export interface UserAllowedScopesData {
  allowedScopes: string[] | null;
  availableScopes: AuthScopeOption[];
}

export async function fetchUserAllowedScopes(
  userId: number
): Promise<UserAllowedScopesData> {
  const data = await apiFetchJson<Record<string, unknown>>(
    `/auth/users/${userId}/allowed-scopes/`
  );
  const raw = data.allowed_scopes ?? data.allowed ?? data.access;
  const allowedScopes =
    raw === null || raw === undefined
      ? null
      : Array.isArray(raw)
        ? (raw as string[])
        : [];

  let availableScopes = normalizeAuthScopeOptions(
    data.scopes ?? data.available_scopes
  );
  if (availableScopes.length === 0) {
    const { scopes } = await fetchAuthScopes();
    availableScopes = scopes;
  }

  return { allowedScopes, availableScopes };
}

export async function updateUserAllowedScopes(
  userId: number,
  allowedScopes: string[]
): Promise<void> {
  await apiFetchJson(`/auth/users/${userId}/allowed-scopes/`, {
    method: "PATCH",
    body: JSON.stringify({ allowed_scopes: allowedScopes }),
  });
}

export async function fetchMeAllowedScopes(): Promise<MeAllowedScopesData> {
  const data = await apiFetchJson<Record<string, unknown>>(
    "/auth/me/allowed-scopes/"
  );
  const raw = data.allowed_scopes ?? data.allowed ?? data.access;
  const allowedScopes =
    raw === null || raw === undefined
      ? null
      : Array.isArray(raw)
        ? (raw as string[])
        : [];
  let availableScopes = normalizeAuthScopeOptions(
    data.scopes ?? data.available_scopes
  );
  if (availableScopes.length === 0) {
    const { scopes } = await fetchAuthScopes();
    availableScopes = scopes;
  }
  return { allowedScopes, availableScopes };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiFetchJson("/auth/me/password/", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function scheduleAccountDeletion(
  confirmPassword: string
): Promise<void> {
  await apiFetchJson("/auth/account/delete/", {
    method: "POST",
    body: JSON.stringify({ confirm_password: confirmPassword }),
  });
}

export async function fetchDeletionStatus(): Promise<DeletionStatus> {
  return apiFetchJson<DeletionStatus>("/auth/account/deletion-status/");
}

export async function recoverAccount(
  username: string,
  password: string,
  role: "user" | "admin"
): Promise<TokenPair> {
  const data = await apiFetchPublicJson<TokenPair>("/auth/account/recover/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
  if (data.access && data.refresh) {
    setTokens(data.access, data.refresh);
  }
  return data;
}

export async function login(
  username: string,
  password: string
): Promise<TokenPair> {
  const data = await apiFetchPublicJson<TokenPair>("/auth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  setTokens(data.access, data.refresh);
  return data;
}

export async function register(
  username: string,
  password: string,
  role: "user" | "admin" = "user"
): Promise<AuthUser> {
  const data = await apiFetchPublicJson<AuthUser & TokenPair>(
    "/auth/register/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    }
  );
  if (data.access && data.refresh) {
    setTokens(data.access, data.refresh);
  }
  return data;
}

export function logout(): void {
  clearTokens();
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await apiFetchJson<Record<string, unknown>>("/auth/me/");
  return normalizeUserRecord(data);
}

export async function listUsers(
  params: ListUsersParams = {}
): Promise<ListUsersResult> {
  const qs = new URLSearchParams();
  if (params.role) qs.set("role", params.role);
  if (params.account_state) qs.set("account_state", params.account_state);
  if (params.status) qs.set("status", params.status);
  if (params.is_active !== undefined) {
    qs.set("is_active", params.is_active ? "true" : "false");
  }
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));

  const query = qs.toString();
  const path = query ? `/auth/users/?${query}` : "/auth/users/";
  const data = await apiFetchJson<
    | AuthUserRecord[]
    | { results: AuthUserRecord[] }
    | { users: Record<string, unknown>[]; pagination?: unknown }
  >(path);

  if (Array.isArray(data)) {
    return { users: data, pagination: null };
  }
  if ("users" in data && Array.isArray(data.users)) {
    return {
      users: data.users.map((u) =>
        normalizeUserRecord(u as Record<string, unknown>)
      ),
      pagination: normalizePagination(data.pagination),
    };
  }
  const results = "results" in data ? data.results ?? [] : [];
  return {
    users: results.map((u) =>
      normalizeUserRecord(u as unknown as Record<string, unknown>)
    ),
    pagination: null,
  };
}

export async function fetchUser(id: number): Promise<AuthUserRecord> {
  const data = await apiFetchJson<Record<string, unknown>>(
    `/auth/users/${id}/`
  );
  return normalizeUserRecord(data);
}

export async function createUser(body: {
  username: string;
  password: string;
  role: "user" | "admin";
  allowed_scopes?: string[];
  managed_by_id?: number;
}): Promise<AuthUserRecord> {
  const payload: Record<string, unknown> = {
    username: body.username,
    password: body.password,
    role: body.role,
  };
  if (body.allowed_scopes?.length) {
    payload.allowed_scopes = body.allowed_scopes;
  }
  if (body.managed_by_id != null) {
    payload.managed_by_id = body.managed_by_id;
  }
  const data = await apiFetchJson<Record<string, unknown>>("/auth/users/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeUserRecord(data);
}

export async function updateUser(
  id: number,
  body: Partial<{
    password: string;
    is_active: boolean;
    allowed_scopes: string[];
    access: string[];
  }>
): Promise<AuthUserRecord> {
  const data = await apiFetchJson<Record<string, unknown>>(
    `/auth/users/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return normalizeUserRecord(data);
}

/** Schedule recoverable deletion (30-day grace). */
export async function scheduleUserDeletion(id: number): Promise<void> {
  await apiFetch(`/auth/users/${id}/`, { method: "DELETE" });
}

export async function purgeUser(id: number): Promise<PurgeUserResult> {
  return apiFetchJson<PurgeUserResult>(`/auth/users/${id}/purge/`, {
    method: "POST",
  });
}

export async function listApiKeys(
  params: ListApiKeysParams = {}
): Promise<ListApiKeysResult> {
  const qs = new URLSearchParams();
  if (params.user_id != null) {
    qs.set("user_id", String(params.user_id));
  }
  if (params.role) qs.set("role", params.role);
  if (params.is_active !== undefined) {
    qs.set("is_active", params.is_active ? "true" : "false");
  }
  if (params.include_expired === false) {
    qs.set("include_expired", "false");
  }
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));

  const query = qs.toString();
  const path = query ? `/auth/api-keys/?${query}` : "/auth/api-keys/";
  const data = await apiFetchJson<
    | ApiKeyRecord[]
    | { results: ApiKeyRecord[] }
    | { api_keys: Record<string, unknown>[]; pagination?: unknown }
  >(path);

  if (Array.isArray(data)) {
    return {
      apiKeys: data.map((k) =>
        normalizeApiKeyRecord(k as unknown as Record<string, unknown>)
      ),
      pagination: null,
    };
  }
  if ("api_keys" in data && Array.isArray(data.api_keys)) {
    return {
      apiKeys: data.api_keys.map((k) => normalizeApiKeyRecord(k)),
      pagination: normalizePagination(data.pagination),
    };
  }
  const results = "results" in data ? data.results ?? [] : [];
  return {
    apiKeys: results.map((k) =>
      normalizeApiKeyRecord(k as unknown as Record<string, unknown>)
    ),
    pagination: null,
  };
}

export async function createApiKey(body: {
  name?: string;
  scopes: string[];
  expiry_preset: string;
  user_id?: number;
}): Promise<ApiKeyCreateResult> {
  const payload: Record<string, unknown> = {
    scopes: body.scopes,
    expiry_preset: body.expiry_preset,
  };
  if (body.name?.trim()) payload.name = body.name.trim();
  if (body.user_id != null) payload.user_id = body.user_id;

  const data = await apiFetchJson<Record<string, unknown>>("/auth/api-keys/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return {
    id: String(data.id ?? ""),
    name: String(data.name ?? body.name ?? ""),
    key: String(data.key ?? data.secret ?? ""),
    secret: data.secret != null ? String(data.secret) : undefined,
    prefix: data.prefix != null ? String(data.prefix) : undefined,
    allowed_scopes: Array.isArray(data.allowed_scopes)
      ? (data.allowed_scopes as string[])
      : body.scopes,
    expires_at: String(data.expires_at ?? ""),
    created_at: String(data.created_at ?? ""),
  };
}

export async function patchApiKey(
  id: string,
  body: Partial<{ is_active: boolean; name: string }>
): Promise<ApiKeyRecord> {
  const data = await apiFetchJson<Record<string, unknown>>(
    `/auth/api-keys/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return normalizeApiKeyRecord(data);
}

/** Hard-delete; key must be deactivated first. */
export async function deleteApiKey(id: string): Promise<void> {
  await apiFetch(`/auth/api-keys/${id}/`, { method: "DELETE" });
}

/** Deactivate then hard-delete. */
export async function revokeAndDeleteApiKey(id: string): Promise<void> {
  await patchApiKey(id, { is_active: false });
  await deleteApiKey(id);
}

export async function fetchAuthScopes(): Promise<{
  scopes: AuthScopeOption[];
  expiryPresets: AuthScopeOption[];
  fromServer: boolean;
}> {
  const fallbackScopes = FALLBACK_API_KEY_SCOPES.map((id) => ({
    id,
    label: id,
  }));
  const fallbackExpiries = FALLBACK_EXPIRY_PRESETS.map((id) => ({
    id,
    label: id.replace(/_/g, " "),
  }));

  const data = await apiFetchJson<AuthScopesResponse>("/auth/scopes/");
  const scopes = normalizeAuthScopeOptions(
    data.scopes ?? data.available_scopes
  );
  const expiryPresets = normalizeAuthScopeOptions(
    data.expiry_presets ?? data.expiries
  );
  return {
    scopes: scopes.length > 0 ? scopes : fallbackScopes,
    expiryPresets: expiryPresets.length > 0 ? expiryPresets : fallbackExpiries,
    fromServer: scopes.length > 0,
  };
}

/** Keep only scope ids the server advertises (avoids 400 on unknown codes). */
export function filterScopesToCatalog(
  selected: string[],
  catalog: AuthScopeOption[]
): string[] {
  const allowed = new Set(catalog.map((s) => s.id));
  return selected.filter((id) => allowed.has(id));
}

/** False only when `VITE_ALLOW_ADMIN_SIGNUP=false` (admin register UI stays visible either way). */
export const allowAdminSignup =
  import.meta.env.VITE_ALLOW_ADMIN_SIGNUP !== "false";
