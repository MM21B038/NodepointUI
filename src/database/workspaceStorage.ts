import { API_ROOT, buildApiUrl } from "@/database/apiUrl";

export { API_ROOT };

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.detail || data.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

// --- Workspace ---

/** System group synced with `is_flag` on workspaces (alias: legacy `flagged=true` scope). */
export const FLAGGED_GROUP_NAME = "flagged";

/** Exactly one of workspace or group scope for KG, entity search, entity-types, chat summary. */
export type KgApiScope = { workspaceName: string } | { group: string };

export function isGroupScope(scope: KgApiScope): scope is { group: string } {
  return "group" in scope;
}

export function groupScope(groupName: string): KgApiScope {
  return { group: groupName };
}

/** @deprecated Use groupScope(activeGroup) */
export function flaggedGroupScope(): KgApiScope {
  return { group: FLAGGED_GROUP_NAME };
}

export async function listSelectableGroups(): Promise<WorkspaceGroupSummary[]> {
  const all = await listAllWorkspaceGroups();
  return all.filter(
    (g) => g.name !== FLAGGED_GROUP_NAME && !g.is_system
  );
}

export async function getGroupMemberNames(groupName: string): Promise<string[]> {
  const meta = await resolveGroupKgScopeMeta(groupName);
  return meta.graphWorkspaceNames;
}

export interface GroupKgScopeMeta {
  name: string;
  tag: GroupTag;
  /** Workspaces, files, entities, or relations — per group tag */
  memberCount: number;
  /** Workspaces that appear in group-scoped KG responses */
  graphWorkspaceNames: string[];
  /** Member document file names for files-tag groups */
  memberFileNames: string[];
  isWorkspaceTagGroup: boolean;
}

export async function resolveGroupKgScopeMeta(groupName: string): Promise<GroupKgScopeMeta> {
  const detail = await getGroup(groupName, { page: 1, page_size: 1 });
  const tag = detail.tag;
  const memberCount = detail.member_count;

  if (isWorkspaceGroupTag(tag)) {
    const graphWorkspaceNames = await getGroupWorkspaceNames(groupName);
    return {
      name: groupName,
      tag,
      memberCount,
      graphWorkspaceNames,
      memberFileNames: [],
      isWorkspaceTagGroup: true,
    };
  }

  const entityTypesResult = await getKnowledgeGraphEntityTypes(groupScope(groupName));
  const graphWorkspaceNames = (entityTypesResult.workspaces ?? [])
    .map((w) => w.workspace)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  let memberFileNames: string[] = [];
  if (tag === "files") {
    const members = (await getAllGroupMembers(groupName, {
      expectedTag: "files",
    })) as GroupFileMember[];
    memberFileNames = [
      ...new Set(members.map((m) => m.file_name).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
  }

  return {
    name: groupName,
    tag,
    memberCount,
    graphWorkspaceNames,
    memberFileNames,
    isWorkspaceTagGroup: false,
  };
}

export function scopeToQueryParams(scope: KgApiScope): Record<string, string> {
  if (isGroupScope(scope)) return { group: scope.group };
  return { workspace_name: scope.workspaceName };
}

export interface WorkspaceEntry {
  name: string;
  tag?: string | null;
  description?: string | null;
  is_flag: boolean;
  groups?: string[];
  created_at: string;
}

export interface WorkspaceListResponse {
  group: string | null;
  include_counts: boolean;
  pagination: WorkspacePagePagination;
  workspaces: WorkspaceEntry[];
}

function normalizeWorkspaceEntry(raw: {
  name: string;
  created_at: string;
  tag?: string | null;
  description?: string | null;
  is_flag?: boolean;
  groups?: string[];
}): WorkspaceEntry {
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  return {
    name: raw.name,
    tag: raw.tag ?? null,
    description: raw.description ?? null,
    created_at: raw.created_at,
    is_flag: Boolean(raw.is_flag) || groups.includes(FLAGGED_GROUP_NAME),
    groups,
  };
}

function isWorkspaceListPayload(
  data: unknown
): data is { workspaces: unknown[]; pagination?: WorkspacePagePagination } {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as { workspaces?: unknown }).workspaces)
  );
}

export async function getWorkspaceList(params?: {
  page?: number;
  page_size?: number;
  group?: string;
  signal?: AbortSignal;
}): Promise<WorkspaceListResponse> {
  const query: Record<string, string> = {};
  if (params?.page !== undefined) query.page = String(params.page);
  if (params?.page_size !== undefined) query.page_size = String(params.page_size);
  if (params?.group) query.group = params.group;

  const response = await fetch(buildApiUrl("/workspace/list/", query), {
    signal: params?.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data: unknown = await response.json();

  if (Array.isArray(data)) {
    const workspaces = data.map((ws) =>
      normalizeWorkspaceEntry(ws as { name: string; created_at: string })
    );
    return {
      group: params?.group ?? null,
      include_counts: false,
      pagination: {
        page: 1,
        page_size: workspaces.length,
        total_items: workspaces.length,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
      workspaces,
    };
  }

  if (!isWorkspaceListPayload(data)) {
    return {
      group: params?.group ?? null,
      include_counts: false,
      pagination: {
        page: 1,
        page_size: 0,
        total_items: 0,
        total_pages: 0,
        has_next: false,
        has_previous: false,
      },
      workspaces: [],
    };
  }

  const workspaces = data.workspaces.map((ws) =>
    normalizeWorkspaceEntry(
      ws as { name: string; created_at: string; is_flag?: boolean; groups?: string[] }
    )
  );
  const p = data.pagination;
  return {
    group: (data as { group?: string | null }).group ?? params?.group ?? null,
    include_counts: Boolean((data as { include_counts?: boolean }).include_counts),
    pagination: {
      page: p?.page ?? params?.page ?? 1,
      page_size: p?.page_size ?? params?.page_size ?? 20,
      total_items: p?.total_items ?? workspaces.length,
      total_pages: p?.total_pages ?? 1,
      has_next: Boolean(p?.has_next),
      has_previous: Boolean(p?.has_previous),
    },
    workspaces,
  };
}

/** Fetches every page from GET /workspace/list/ (for selectors, group dialogs). */
export async function getAllWorkspaces(): Promise<WorkspaceEntry[]> {
  const all: WorkspaceEntry[] = [];
  let page = 1;
  const page_size = 100;
  try {
    while (true) {
      const res = await getWorkspaceList({ page, page_size });
      all.push(...res.workspaces);
      if (!res.pagination.has_next) break;
      page += 1;
    }
    return all;
  } catch (error) {
    console.error("Error fetching all workspaces:", error);
    return all.length > 0 ? all : [];
  }
}

/** @deprecated Prefer getWorkspaceList (paginated) or getAllWorkspaces (full list). */
export async function getWorkspaces(): Promise<WorkspaceEntry[]> {
  return getAllWorkspaces();
}

export interface WorkspaceStats {
  total: number;
  /** @deprecated Prefer in_group / ungrouped when present */
  flagged?: number;
  /** @deprecated Prefer in_group / ungrouped when present */
  non_flagged?: number;
  in_group?: number;
  ungrouped?: number;
}

export interface WorkspaceCounts {
  files: number;
  chunks: number;
  entities: number;
  relations: number;
}

export interface WorkspacePageItem {
  name: string;
  tag?: string | null;
  description?: string | null;
  is_flag: boolean;
  created_at: string;
  counts: WorkspaceCounts;
  groups?: string[];
}

export interface WorkspacePagePagination {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface WorkspacePageResponse {
  group: string | null;
  include_counts: boolean;
  pagination: WorkspacePagePagination;
  workspaces: WorkspacePageItem[];
  /** @deprecated Legacy field; use `group` */
  filter?: string;
}

function normalizeWorkspaceCounts(raw: Partial<WorkspaceCounts> | undefined): WorkspaceCounts {
  return {
    files: raw?.files ?? 0,
    chunks: raw?.chunks ?? 0,
    entities: raw?.entities ?? 0,
    relations: raw?.relations ?? 0,
  };
}

function normalizeWorkspacePageItem(
  raw: Partial<WorkspacePageItem> & { name: string; created_at: string }
): WorkspacePageItem {
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  return {
    name: raw.name,
    tag: raw.tag ?? null,
    description: raw.description ?? null,
    is_flag: Boolean(raw.is_flag) || groups.includes(FLAGGED_GROUP_NAME),
    created_at: raw.created_at,
    counts: normalizeWorkspaceCounts(raw.counts),
    groups: groups.length > 0 ? groups : undefined,
  };
}

export async function getWorkspaceStats(): Promise<WorkspaceStats> {
  const response = await fetch(buildApiUrl("/workspace/stats/"));
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return {
    total: data.total ?? 0,
    flagged: data.flagged,
    non_flagged: data.non_flagged,
    in_group: data.in_group,
    ungrouped: data.ungrouped,
  };
}

export async function getWorkspacePage(params: {
  page?: number;
  page_size?: number;
  group?: string;
  include_counts?: boolean;
  signal?: AbortSignal;
}): Promise<WorkspacePageResponse> {
  const query: Record<string, string> = {};
  if (params.page !== undefined) query.page = String(params.page);
  if (params.page_size !== undefined) query.page_size = String(params.page_size);
  if (params.group) query.group = params.group;
  if (params.include_counts === false) query.include_counts = "false";

  const response = await fetch(buildApiUrl("/workspace/page/", query), {
    signal: params.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return {
    group: data.group ?? params.group ?? null,
    include_counts: data.include_counts !== false,
    pagination: {
      page: data.pagination?.page ?? 1,
      page_size: data.pagination?.page_size ?? params.page_size ?? 20,
      total_items: data.pagination?.total_items ?? 0,
      total_pages: data.pagination?.total_pages ?? 0,
      has_next: Boolean(data.pagination?.has_next),
      has_previous: Boolean(data.pagination?.has_previous),
    },
    workspaces: (data.workspaces ?? []).map(normalizeWorkspacePageItem),
  };
}

/** Build a name → counts map by paging GET /workspace/page/?include_counts=true. */
export async function getWorkspaceCountsByName(
  options?: { group?: string; signal?: AbortSignal }
): Promise<Map<string, WorkspaceCounts>> {
  const map = new Map<string, WorkspaceCounts>();
  let page = 1;
  const page_size = 100;

  while (true) {
    const res = await getWorkspacePage({
      page,
      page_size,
      group: options?.group,
      include_counts: true,
      signal: options?.signal,
    });
    for (const w of res.workspaces) {
      map.set(w.name, w.counts);
    }
    if (!res.pagination.has_next) break;
    page += 1;
  }

  return map;
}

export class WorkspaceCreateError extends Error {
  constructor(
    message: string,
    readonly code: "empty" | "exists" | "network" | "api"
  ) {
    super(message);
    this.name = "WorkspaceCreateError";
  }
}

export interface CreateWorkspaceOptions {
  tag?: string | null;
  description?: string | null;
}

export async function createWorkspace(
  name: string,
  options?: CreateWorkspaceOptions
): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new WorkspaceCreateError("Workspace name cannot be empty.", "empty");
  }

  const body: { name: string; tag?: string; description?: string } = {
    name: normalizedName,
  };
  const tag = options?.tag?.trim();
  const description = options?.description?.trim();
  if (tag) body.tag = tag;
  if (description) body.description = description;

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/workspace/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const hint =
      "Could not reach the API. Is the backend running on port 8000? Restart `npm run dev` after pulling latest changes (Vite proxy).";
    console.error("Error creating workspace:", error);
    throw new WorkspaceCreateError(
      error instanceof Error ? `${error.message}. ${hint}` : hint,
      "network"
    );
  }

  if (response.ok) return;

  const message = await parseErrorResponse(response);
  if (response.status === 400 && message.toLowerCase().includes("exist")) {
    throw new WorkspaceCreateError(
      `Workspace "${normalizedName}" already exists.`,
      "exists"
    );
  }
  throw new WorkspaceCreateError(message, "api");
}

export async function deleteWorkspace(workspaceName: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${API_ROOT}/workspace/delete/${encodeURIComponent(workspaceName)}/`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return true;
  } catch (error) {
    console.error(`Error deleting workspace ${workspaceName}:`, error);
    throw error;
  }
}

export interface UpdateWorkspaceOptions {
  name?: string | null;
  tag?: string | null;
  description?: string | null;
}

export interface UpdateWorkspaceResult {
  message?: string;
  previous_name?: string;
  workspace: {
    name: string;
    tag?: string | null;
    description?: string | null;
    created_at?: string;
  };
}

export async function updateWorkspace(
  workspaceName: string,
  options: UpdateWorkspaceOptions
): Promise<UpdateWorkspaceResult> {
  const body: Record<string, string | null> = {};
  if (options.name !== undefined) {
    const trimmed = options.name?.trim();
    if (!trimmed) throw new Error("Workspace name cannot be empty.");
    body.name = trimmed;
  }
  if (options.tag !== undefined) body.tag = options.tag?.trim() || null;
  if (options.description !== undefined) {
    body.description = options.description?.trim() || null;
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No fields to update.");
  }

  const response = await fetch(
    buildApiUrl(`/workspace/update/${encodeURIComponent(workspaceName)}/`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export interface FlagStatusResponse {
  workspace: string;
  is_flag: boolean;
}

export async function getFlagStatus(workspaceName: string): Promise<FlagStatusResponse> {
  try {
    const response = await fetch(
      `${API_ROOT}/workspace/${encodeURIComponent(workspaceName)}/flag-status/`
    );
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching flag status for ${workspaceName}:`, error);
    return { workspace: workspaceName, is_flag: false };
  }
}

export interface ToggleFlagResponse {
  message: string;
  workspace: string;
  is_flag: boolean;
}

export async function toggleWorkspaceFlag(
  workspaceName: string
): Promise<ToggleFlagResponse> {
  const response = await fetch(
    `${API_ROOT}/workspace/${encodeURIComponent(workspaceName)}/toggle-flag/`,
    { method: "PATCH" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** @deprecated Use toggleWorkspaceFlag */
export async function flagWorkspace(workspaceName: string): Promise<{ flag: boolean; message: string }> {
  const status = await getFlagStatus(workspaceName);
  if (status.is_flag) {
    return { flag: true, message: "Workspace is already flagged" };
  }
  const result = await toggleWorkspaceFlag(workspaceName);
  return { flag: result.is_flag, message: result.message };
}

/** @deprecated Use toggleWorkspaceFlag */
export async function undoFlagWorkspace(workspaceName: string): Promise<{ flag: boolean; message: string }> {
  const status = await getFlagStatus(workspaceName);
  if (!status.is_flag) {
    return { flag: false, message: "Workspace is not flagged" };
  }
  const result = await toggleWorkspaceFlag(workspaceName);
  return { flag: result.is_flag, message: result.message };
}

export interface FlaggedWorkspaceCountResponse {
  count: number;
  workspaces: string[];
}

export async function getFlaggedWorkspaceCount(): Promise<FlaggedWorkspaceCountResponse> {
  try {
    const detail = await getGroup(FLAGGED_GROUP_NAME);
    const workspaces = detail.workspaces.map((w) => w.name).sort((a, b) => a.localeCompare(b));
    return { count: workspaces.length, workspaces };
  } catch (err) {
    console.warn("getFlaggedWorkspaceCount: group endpoint unavailable, trying legacy count", err);
  }

  try {
    const response = await fetch(buildApiUrl("/workspace/flagged/count/"));
    if (response.ok) {
      const data = await response.json();
      return {
        count: typeof data.count === "number" ? data.count : 0,
        workspaces: Array.isArray(data.workspaces) ? data.workspaces : [],
      };
    }
  } catch (err) {
    console.warn("getFlaggedWorkspaceCount: legacy endpoint unavailable, using list fallback", err);
  }

  const workspaces = (await getWorkspaces())
    .filter((ws) => ws.is_flag)
    .map((ws) => ws.name)
    .sort((a, b) => a.localeCompare(b));
  return { count: workspaces.length, workspaces };
}

// --- Workspace groups ---

export type GroupTag = "workspace" | "files" | "entity" | "relation";

export const GROUP_TAGS: GroupTag[] = ["workspace", "files", "entity", "relation"];

export function normalizeGroupTag(raw: unknown): GroupTag {
  if (raw === "files" || raw === "entity" || raw === "relation") return raw;
  return "workspace";
}

export interface GroupWorkspaceMember {
  name: string;
  created_at: string;
  is_flag?: boolean;
}

export interface GroupFileMember {
  document_id: string;
  workspace: string;
  file_name: string;
  created_at?: string;
}

export interface GroupEntityMember {
  entity_id: string;
  name: string;
  entity_type: string;
  workspace: string;
  created_at?: string;
}

export interface GroupRelationMember {
  relation_id: string;
  source: string;
  target: string;
  workspace: string;
  created_at?: string;
}

export type GroupMember =
  | GroupWorkspaceMember
  | GroupFileMember
  | GroupEntityMember
  | GroupRelationMember;

export interface WorkspaceGroupSummary {
  name: string;
  tag: GroupTag;
  description?: string | null;
  member_count: number;
  created_at: string;
  is_system?: boolean;
  /** @deprecated Use member_count */
  workspace_count?: number;
}

export interface GroupMembersPage {
  name: string;
  tag: GroupTag;
  description?: string | null;
  member_count: number;
  pagination: WorkspacePagePagination;
  members: GroupMember[];
}

export interface WorkspaceGroupDetail extends GroupMembersPage {
  is_system?: boolean;
  /** @deprecated Use members */
  workspaces: GroupWorkspaceMember[];
}

export interface GroupListResponse {
  groups: WorkspaceGroupSummary[];
  pagination: WorkspacePagePagination;
}

export interface CreateGroupOptions {
  tag?: GroupTag | null;
  description?: string | null;
}

export interface UpdateGroupOptions {
  name?: string | null;
  description?: string | null;
}

export interface UpdateGroupResult {
  message?: string;
  previous_name?: string;
  group: WorkspaceGroupSummary;
}

function inferGroupTagFromMemberRow(row: Record<string, unknown>): GroupTag | null {
  if (row.document_id != null) return "files";
  if (row.entity_id != null || (row.id != null && row.entity_type != null)) return "entity";
  if (row.relation_id != null) return "relation";
  if (row.name != null) return "workspace";
  return null;
}

function inferGroupTagFromMembers(rawMembers: unknown[]): GroupTag | null {
  for (const member of rawMembers) {
    if (!member || typeof member !== "object") continue;
    const inferred = inferGroupTagFromMemberRow(member as Record<string, unknown>);
    if (inferred) return inferred;
  }
  return null;
}

function resolveGroupMembersTag(
  data: Record<string, unknown>,
  rawMembers: unknown[],
  expectedTag?: GroupTag
): GroupTag {
  const declared = data.tag != null ? normalizeGroupTag(data.tag) : null;
  const inferred = inferGroupTagFromMembers(rawMembers);
  if (expectedTag) {
    if (declared && declared === expectedTag) return declared;
    if (inferred && inferred === expectedTag) return expectedTag;
    return expectedTag;
  }
  if (declared && declared !== "workspace") return declared;
  if (inferred) return inferred;
  return declared ?? "workspace";
}

function normalizeGroupPagination(
  raw: Partial<WorkspacePagePagination> | undefined,
  fallback: { page?: number; page_size?: number; total_items?: number }
): WorkspacePagePagination {
  const total_items = raw?.total_items ?? fallback.total_items ?? 0;
  const page_size = raw?.page_size ?? fallback.page_size ?? 20;
  const total_pages =
    raw?.total_pages ??
    (total_items === 0 ? 0 : Math.max(1, Math.ceil(total_items / page_size)));
  const page = raw?.page ?? fallback.page ?? 1;
  return {
    page,
    page_size,
    total_items,
    total_pages,
    has_next: raw?.has_next ?? page < total_pages,
    has_previous: raw?.has_previous ?? page > 1,
  };
}

export function normalizeGroupSummary(raw: Record<string, unknown>): WorkspaceGroupSummary {
  const memberCount =
    typeof raw.member_count === "number"
      ? raw.member_count
      : typeof raw.workspace_count === "number"
        ? raw.workspace_count
        : Array.isArray(raw.members)
          ? raw.members.length
          : Array.isArray(raw.workspaces)
            ? raw.workspaces.length
            : 0;
  const summary: WorkspaceGroupSummary = {
    name: String(raw.name),
    tag: normalizeGroupTag(raw.tag),
    description: raw.description != null ? String(raw.description) : null,
    member_count: memberCount,
    created_at: String(raw.created_at ?? ""),
    is_system: Boolean(raw.is_system),
  };
  summary.workspace_count = summary.member_count;
  return summary;
}

function normalizeWorkspaceGroupMember(raw: Record<string, unknown>): GroupWorkspaceMember {
  return {
    name: String(raw.name),
    created_at: String(raw.created_at ?? ""),
    is_flag: Boolean(raw.is_flag),
  };
}

function normalizeGroupMembers(rawMembers: unknown[], tag: GroupTag): GroupMember[] {
  if (tag === "workspace") {
    return rawMembers.map((m) =>
      normalizeWorkspaceGroupMember(m as Record<string, unknown>)
    );
  }
  if (tag === "files") {
    return rawMembers.map((m) => {
      const row = m as Record<string, unknown>;
      return {
        document_id: String(row.document_id),
        workspace: String(row.workspace),
        file_name: String(row.file_name),
        created_at: row.created_at ? String(row.created_at) : undefined,
      } satisfies GroupFileMember;
    });
  }
  if (tag === "entity") {
    return rawMembers.map((m) => {
      const row = m as Record<string, unknown>;
      return {
        entity_id: String(row.entity_id ?? row.id ?? ""),
        name: String(row.name ?? ""),
        entity_type: String(row.entity_type ?? ""),
        workspace: String(row.workspace ?? ""),
        created_at: row.created_at ? String(row.created_at) : undefined,
      } satisfies GroupEntityMember;
    });
  }
  return rawMembers.map((m) => {
    const row = m as Record<string, unknown>;
    return {
      relation_id: String(row.relation_id),
      source: String(row.source),
      target: String(row.target),
      workspace: String(row.workspace),
      created_at: row.created_at ? String(row.created_at) : undefined,
    } satisfies GroupRelationMember;
  });
}

function normalizeGroupMembersPage(
  data: Record<string, unknown>,
  fallback: { page?: number; page_size?: number; expectedTag?: GroupTag }
): GroupMembersPage {
  const rawMembers = Array.isArray(data.members)
    ? data.members
    : normalizeGroupTag(data.tag ?? fallback.expectedTag) === "workspace" &&
        Array.isArray(data.workspaces)
      ? data.workspaces
      : [];
  const tag = resolveGroupMembersTag(data, rawMembers, fallback.expectedTag);
  const member_count =
    typeof data.member_count === "number"
      ? data.member_count
      : typeof data.workspace_count === "number"
        ? data.workspace_count
        : rawMembers.length;
  return {
    name: String(data.name ?? data.group ?? ""),
    tag,
    description: data.description != null ? String(data.description) : null,
    member_count,
    pagination: normalizeGroupPagination(
      data.pagination as Partial<WorkspacePagePagination> | undefined,
      { ...fallback, total_items: member_count }
    ),
    members: normalizeGroupMembers(rawMembers, tag),
  };
}

export function isWorkspaceGroupTag(tag: GroupTag | string | null | undefined): boolean {
  return normalizeGroupTag(tag) === "workspace";
}

export function isWorkspaceGroup(group: Pick<WorkspaceGroupSummary, "tag">): boolean {
  return isWorkspaceGroupTag(group.tag);
}

export async function createWorkspaceGroup(
  name: string,
  options?: CreateGroupOptions
): Promise<WorkspaceGroupSummary> {
  const normalized = name.trim();
  const body: { name: string; tag?: GroupTag; description?: string } = {
    name: normalized,
    tag: options?.tag ?? "workspace",
  };
  const normalizedDescription = options?.description?.trim();
  if (normalizedDescription) body.description = normalizedDescription;
  const response = await fetch(buildApiUrl("/group/create/"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return normalizeGroupSummary((data.group ?? data) as Record<string, unknown>);
}

export async function listWorkspaceGroups(params?: {
  page?: number;
  page_size?: number;
  tag?: GroupTag;
  signal?: AbortSignal;
}): Promise<GroupListResponse> {
  const query: Record<string, string> = {};
  if (params?.page !== undefined) query.page = String(params.page);
  if (params?.page_size !== undefined) query.page_size = String(params.page_size);
  if (params?.tag) query.tag = params.tag;

  const response = await fetch(buildApiUrl("/group/list/", query), {
    signal: params?.signal,
  });
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  const groups = (data.groups ?? []).map((g: Record<string, unknown>) =>
    normalizeGroupSummary(g)
  );
  return {
    groups,
    pagination: normalizeGroupPagination(data.pagination, {
      page: params?.page,
      page_size: params?.page_size,
      total_items: groups.length,
    }),
  };
}

export async function listAllWorkspaceGroups(params?: {
  tag?: GroupTag;
  signal?: AbortSignal;
}): Promise<WorkspaceGroupSummary[]> {
  const all: WorkspaceGroupSummary[] = [];
  let page = 1;
  const page_size = 100;
  for (;;) {
    const res = await listWorkspaceGroups({ page, page_size, tag: params?.tag, signal: params?.signal });
    all.push(...res.groups);
    if (!res.pagination.has_next) break;
    page += 1;
  }
  return all;
}

/** @deprecated Prefer listAllWorkspaceGroups or listWorkspaceGroups */
export async function listWorkspaceGroupsLegacy(): Promise<WorkspaceGroupSummary[]> {
  return listAllWorkspaceGroups();
}

export async function getGroup(
  groupName: string,
  params?: { page?: number; page_size?: number; signal?: AbortSignal }
): Promise<WorkspaceGroupDetail> {
  const query: Record<string, string> = {};
  if (params?.page !== undefined) query.page = String(params.page);
  if (params?.page_size !== undefined) query.page_size = String(params.page_size);

  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/`, query),
    { signal: params?.signal }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = (await response.json()) as Record<string, unknown>;
  const page = normalizeGroupMembersPage(data, {
    page: params?.page,
    page_size: params?.page_size,
  });
  const workspaces =
    page.tag === "workspace"
      ? (page.members as GroupWorkspaceMember[])
      : [];
  return {
    ...page,
    is_system: Boolean(data.is_system),
    workspaces,
  };
}

export async function getGroupMembers(
  groupName: string,
  params?: {
    page?: number;
    page_size?: number;
    signal?: AbortSignal;
    expectedTag?: GroupTag;
  }
): Promise<GroupMembersPage> {
  const query: Record<string, string> = {};
  if (params?.page !== undefined) query.page = String(params.page);
  if (params?.page_size !== undefined) query.page_size = String(params.page_size);

  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/members/`, query),
    { signal: params?.signal }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = (await response.json()) as Record<string, unknown>;
  return normalizeGroupMembersPage(data, {
    page: params?.page,
    page_size: params?.page_size,
    expectedTag: params?.expectedTag,
  });
}

const GROUP_MEMBERS_MAX_PAGE_SIZE = 100;

/** Fetch every group member, paginating at the API max page size (100). */
export async function getAllGroupMembers(
  groupName: string,
  options?: { expectedTag?: GroupTag; signal?: AbortSignal }
): Promise<GroupMember[]> {
  const members: GroupMember[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const pageData = await getGroupMembers(groupName, {
      page,
      page_size: GROUP_MEMBERS_MAX_PAGE_SIZE,
      expectedTag: options?.expectedTag,
      signal: options?.signal,
    });
    members.push(...pageData.members);
    hasNext = pageData.pagination.has_next;
    page += 1;
  }

  return members;
}

export async function updateGroup(
  groupName: string,
  options: UpdateGroupOptions
): Promise<UpdateGroupResult> {
  const body: Record<string, string | null> = {};
  if (options.name !== undefined) {
    const trimmed = options.name?.trim();
    if (!trimmed) throw new Error("Group name cannot be empty.");
    body.name = trimmed;
  }
  if (options.description !== undefined) {
    body.description = options.description?.trim() || null;
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No fields to update.");
  }

  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/`),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const data = await response.json();
  return {
    message: data.message,
    previous_name: data.previous_name,
    group: normalizeGroupSummary((data.group ?? data) as Record<string, unknown>),
  };
}

export async function deleteWorkspaceGroup(groupName: string): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/`),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function addWorkspaceToGroup(
  groupName: string,
  workspaceName: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/workspaces/`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_name: workspaceName }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function removeWorkspaceFromGroup(
  groupName: string,
  workspaceName: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(
      `/group/${encodeURIComponent(groupName)}/workspaces/${encodeURIComponent(workspaceName)}/`
    ),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function addFileToGroup(
  groupName: string,
  documentId: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/files/`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function removeFileFromGroup(
  groupName: string,
  documentId: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(
      `/group/${encodeURIComponent(groupName)}/files/${encodeURIComponent(documentId)}/`
    ),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function addEntityToGroup(
  groupName: string,
  entityId: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/entities/`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity_id: entityId }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function removeEntityFromGroup(
  groupName: string,
  entityId: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(
      `/group/${encodeURIComponent(groupName)}/entities/${encodeURIComponent(entityId)}/`
    ),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function addRelationToGroup(
  groupName: string,
  relationId: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/group/${encodeURIComponent(groupName)}/relations/`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relation_id: relationId }),
    }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function removeRelationFromGroup(
  groupName: string,
  relationId: string
): Promise<void> {
  const response = await fetch(
    buildApiUrl(
      `/group/${encodeURIComponent(groupName)}/relations/${encodeURIComponent(relationId)}/`
    ),
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
}

export async function getGroupWorkspaceNames(groupName: string): Promise<string[]> {
  const members = await getAllGroupMembers(groupName, { expectedTag: "workspace" });
  return (members as GroupWorkspaceMember[])
    .map((w) => w.name)
    .sort((a, b) => a.localeCompare(b));
}

// --- Documents ---

export type DocumentStatus =
  | "PENDING"
  | "QUEUED"
  | "INPROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "TERMINATED"
  | "INVALID";

export interface DocumentEntry {
  id: string;
  file_name: string;
  file_url: string;
  status: DocumentStatus;
  content: boolean;
  uploaded_at: string;
}

export interface DocumentListResponse {
  workspace: string;
  total_files: number;
  files: DocumentEntry[];
}

export async function listDocuments(workspaceName: string): Promise<DocumentListResponse> {
  try {
    const response = await fetch(
      `${API_ROOT}/document/${encodeURIComponent(workspaceName)}/`
    );
    if (!response.ok) {
      throw new Error(await parseErrorResponse(response));
    }
    return response.json();
  } catch (error) {
    console.error(`Error fetching documents for ${workspaceName}:`, error);
    return { workspace: workspaceName, total_files: 0, files: [] };
  }
}

export async function listFiles(workspaceName: string): Promise<string[]> {
  const data = await listDocuments(workspaceName);
  return data.files.map((f) => f.file_name);
}

export interface UploadFileResponse {
  message: string;
  pipeline?: PreprocessPipelineResult;
  id: string;
  file_name: string;
  file_path: string;
  file_url: string;
  status: DocumentStatus;
  /** True when same file_name in workspace was overwritten and re-queued. */
  replaced?: boolean;
}

function isAllowedUploadFile(file: File): boolean {
  const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  return ext === ".txt" || ext === ".md";
}

export async function uploadFile(
  workspaceName: string,
  file: File
): Promise<UploadFileResponse> {
  if (!isAllowedUploadFile(file)) {
    throw new Error("Only .txt and .md files can be uploaded.");
  }

  const formData = new FormData();
  formData.append("workspace_name", workspaceName);
  formData.append("file", file);

  const response = await fetch(`${API_ROOT}/document/upload/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

export async function deleteFile(
  workspaceName: string,
  fileName: string
): Promise<boolean> {
  const response = await fetch(
    `${API_ROOT}/document/delete/${encodeURIComponent(workspaceName)}/${encodeURIComponent(fileName)}/`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return true;
}

export interface BulkFileOperationResult {
  succeeded: string[];
  /** Files that replaced an existing document with the same name. */
  replaced: string[];
  failed: { name: string; error: string }[];
}

export async function uploadFiles(
  workspaceName: string,
  files: File[]
): Promise<BulkFileOperationResult> {
  const succeeded: string[] = [];
  const replaced: string[] = [];
  const failed: BulkFileOperationResult["failed"] = [];

  for (const file of files) {
    try {
      const res = await uploadFile(workspaceName, file);
      succeeded.push(file.name);
      if (res.replaced) replaced.push(file.name);
    } catch (error) {
      failed.push({
        name: file.name,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    }
  }

  return { succeeded, replaced, failed };
}

export async function deleteFiles(
  workspaceName: string,
  fileNames: string[]
): Promise<BulkFileOperationResult> {
  const succeeded: string[] = [];
  const failed: BulkFileOperationResult["failed"] = [];

  for (const fileName of fileNames) {
    try {
      await deleteFile(workspaceName, fileName);
      succeeded.push(fileName);
    } catch (error) {
      failed.push({
        name: fileName,
        error: error instanceof Error ? error.message : "Delete failed",
      });
    }
  }

  return { succeeded, replaced: [], failed };
}

export async function deleteWorkspaces(
  workspaceNames: string[]
): Promise<BulkFileOperationResult> {
  const succeeded: string[] = [];
  const failed: BulkFileOperationResult["failed"] = [];

  for (const workspaceName of workspaceNames) {
    try {
      await deleteWorkspace(workspaceName);
      succeeded.push(workspaceName);
    } catch (error) {
      failed.push({
        name: workspaceName,
        error: error instanceof Error ? error.message : "Delete failed",
      });
    }
  }

  return { succeeded, replaced: [], failed };
}

export async function deleteWorkspaceGroups(
  groupNames: string[]
): Promise<BulkFileOperationResult> {
  const succeeded: string[] = [];
  const failed: BulkFileOperationResult["failed"] = [];

  for (const groupName of groupNames) {
    try {
      await deleteWorkspaceGroup(groupName);
      succeeded.push(groupName);
    } catch (error) {
      failed.push({
        name: groupName,
        error: error instanceof Error ? error.message : "Delete failed",
      });
    }
  }

  return { succeeded, replaced: [], failed };
}

// --- Preprocess ---

export interface StartPreprocessOptions {
  /** When true, enqueue on the high RQ queue; default false (orchestrator). */
  priority?: boolean;
  /** When true, also queue other workspaces that are not overall.ready. */
  includeOtherWorkspaces?: boolean;
}

export interface PreprocessPipelineResult {
  message?: string;
  steps: string[];
  jobs: Record<string, string>;
  coalesced?: boolean;
}

export interface OtherWorkspacePreprocessResult {
  workspace: string;
  queued: boolean;
  coalesced: boolean;
  skipped_reason: string | null;
}

export interface StartPreprocessResponse {
  message: string;
  priority_workspace: string;
  priority_pipeline: PreprocessPipelineResult;
  other_workspaces: OtherWorkspacePreprocessResult[];
  /** Present on older API responses. */
  pipeline?: PreprocessPipelineResult;
}

function normalizeStartPreprocessResponse(
  workspaceName: string,
  raw: Record<string, unknown>
): StartPreprocessResponse {
  const priorityPipeline = (raw.priority_pipeline ?? raw.pipeline) as
    | PreprocessPipelineResult
    | undefined;
  const otherWorkspaces = Array.isArray(raw.other_workspaces)
    ? (raw.other_workspaces as OtherWorkspacePreprocessResult[])
    : [];

  return {
    message: String(raw.message ?? "Preprocess queued."),
    priority_workspace: String(raw.priority_workspace ?? workspaceName),
    priority_pipeline: priorityPipeline ?? {
      steps: [],
      jobs: {},
    },
    other_workspaces: otherWorkspaces,
    pipeline: raw.pipeline as PreprocessPipelineResult | undefined,
  };
}

export function summarizePreprocessStart(res: StartPreprocessResponse): string {
  const lines = [res.message];
  if (res.priority_pipeline.coalesced) {
    lines.push("Pipeline coalesced with an existing run.");
  }
  const queuedOthers = res.other_workspaces.filter((w) => w.queued);
  if (queuedOthers.length > 0) {
    lines.push(
      `Also queued: ${queuedOthers.map((w) => w.workspace).join(", ")}.`
    );
  }
  const skipped = res.other_workspaces.filter((w) => !w.queued);
  if (skipped.length > 0) {
    const detail = skipped
      .map((w) =>
        w.skipped_reason
          ? `${w.workspace} (${w.skipped_reason})`
          : w.workspace
      )
      .join(", ");
    lines.push(`Skipped: ${detail}.`);
  }
  return lines.join(" ");
}

export async function startPreprocess(
  workspaceName: string,
  options: StartPreprocessOptions = {}
): Promise<StartPreprocessResponse> {
  const priority = options.priority ?? false;
  const includeOtherWorkspaces = options.includeOtherWorkspaces ?? false;

  const requestInit: RequestInit = { method: "POST" };
  if (priority || includeOtherWorkspaces) {
    requestInit.headers = { "Content-Type": "application/json" };
    requestInit.body = JSON.stringify({
      priority,
      include_other_workspaces: includeOtherWorkspaces,
    });
  }

  const response = await fetch(
    `${API_ROOT}/workspace/preprocess/${encodeURIComponent(workspaceName)}/`,
    requestInit
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  const raw = (await response.json()) as Record<string, unknown>;
  return normalizeStartPreprocessResponse(workspaceName, raw);
}

export type PreprocessPhase =
  | "idle"
  | "needs_prepare"
  | "queued"
  | "processing"
  | "embedding"
  | "ready"
  | "failed"
  | "kg_ready";

/** Entity / relation / chunk vector job counts (Qdrant pipeline). */
export interface VectorPipelineCounts {
  total: number;
  pending: number;
  completed: number;
  failed: number;
}

/** Per-file chunk KG pipeline (`DocumentChunk.status`). */
export interface ChunkPipelineCounts {
  total: number;
  pending: number;
  queued: number;
  in_progress: number;
  completed: number;
  failed: number;
}

export interface PreprocessOverallStatus {
  phase: PreprocessPhase;
  ready: boolean;
  documents_total: number;
  documents_failed: number;
}

export interface DocumentStatusBreakdown {
  by_status: Record<DocumentStatus, number>;
}

export interface PreprocessFileStatus {
  id: string;
  file_name: string;
  document_status: DocumentStatus;
  content: boolean;
  /** Pre-migration KG with no DocumentChunk rows yet. */
  legacy?: boolean;
  phase: PreprocessPhase;
  uploaded_at: string;
  chunks: ChunkPipelineCounts;
  entities: VectorPipelineCounts;
  relations: VectorPipelineCounts;
  chunk_vectors: VectorPipelineCounts;
  embedding_progress: number;
}

export interface WorkspacePreprocessStatusResponse {
  workspace: string;
  overall: PreprocessOverallStatus;
  documents: DocumentStatusBreakdown;
  vectors: {
    entities: VectorPipelineCounts;
    relations: VectorPipelineCounts;
    chunks: VectorPipelineCounts;
  };
  files: PreprocessFileStatus[];
}

export async function getWorkspacePreprocessStatus(
  workspaceName: string
): Promise<WorkspacePreprocessStatusResponse> {
  const response = await fetch(
    `${API_ROOT}/workspace/${encodeURIComponent(workspaceName)}/preprocess-status/`
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** RQ job sample from GET /api/preprocess/queue-status/ */
export interface PreprocessQueueJob {
  id: string;
  function: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  origin_queue: string;
  args_summary: Record<string, string | number | null>;
}

export interface PreprocessQueueFailedJob extends PreprocessQueueJob {
  error: string;
}

export interface PreprocessQueueCounts {
  queued: number;
  started: number;
  failed: number;
  deferred: number;
}

export interface PreprocessQueueSnapshot {
  counts: PreprocessQueueCounts;
  jobs: PreprocessQueueJob[];
  failed_sample: PreprocessQueueFailedJob[];
}

export type PreprocessPipelineQueueName = "high" | "orchestrator" | "low";

export type PreprocessWorkerQueueName =
  | PreprocessPipelineQueueName
  | "chunk"
  | "vector"
  | "default";

/** Preferred display order for known RQ queues from queue-status. */
export const PREPROCESS_QUEUE_DISPLAY_ORDER: PreprocessWorkerQueueName[] = [
  "high",
  "orchestrator",
  "low",
  "chunk",
  "vector",
  "default",
];

export interface PreprocessWorkerSnapshot {
  name: string;
  state: string;
  queues: string[];
  current_job_id: string | null;
  birth_date: string | null;
  last_heartbeat: string | null;
}

export interface PreprocessPipelineLock {
  workspace: string;
  key: string;
  ttl_seconds: number | null;
}

export interface PreprocessStatusCountMap {
  PENDING?: number;
  QUEUED?: number;
  INPROGRESS?: number;
  COMPLETED?: number;
  FAILED?: number;
  total: number;
  [key: string]: number | undefined;
}

export interface PreprocessVectorBacklog {
  pending: number;
  failed: number;
  completed: number;
  total: number;
}

export interface PreprocessWorkspaceIncomplete {
  workspace: string;
  phase: PreprocessPhase;
  documents_total: number;
  documents_failed: number;
  chunks_orphaned?: number;
  pipeline_active?: boolean;
  lock_held?: boolean;
  orchestrator_jobs?: number;
}

export interface PreprocessActivePipeline {
  workspace: string;
  lock_held: boolean;
  lock_ttl_seconds: number | null;
  orchestrator_jobs: PreprocessQueueJob[];
}

export interface PreprocessQueueStatusResponse {
  generated_at: string;
  workspace_filter: string | null;
  rq: {
    queues: Partial<Record<PreprocessWorkerQueueName, PreprocessQueueSnapshot>> &
      Record<string, PreprocessQueueSnapshot>;
    workers: PreprocessWorkerSnapshot[];
  };
  redis: {
    pipeline_locks: PreprocessPipelineLock[];
  };
  database: {
    documents: PreprocessStatusCountMap;
    chunks: PreprocessStatusCountMap;
    /** Stale QUEUED/INPROGRESS chunks with no matching chunk-queue jobs. */
    chunks_orphaned?: number;
    vectors: {
      entities: PreprocessVectorBacklog;
      relations: PreprocessVectorBacklog;
      chunks: PreprocessVectorBacklog;
    };
    workspaces_incomplete?: PreprocessWorkspaceIncomplete[];
  };
  active_pipelines: PreprocessActivePipeline[];
}

export async function getPreprocessQueueStatus(
  workspaceName?: string
): Promise<PreprocessQueueStatusResponse> {
  const response = await fetch(
    buildApiUrl("/preprocess/queue-status/", {
      workspace: workspaceName,
    })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

// --- Knowledge graph ---

/** Slim node shape from GET /api/knowledge-graph/ and search graph payloads. */
export interface ApiGraphNode {
  id: string;
  name: string;
  entity_type: string;
}

export interface ApiGraphEdge {
  id?: string;
  source: string;
  target: string;
  source_id?: string;
  target_id?: string;
  type_description?: string;
}

export interface EntityTypeEntry {
  type: string;
  count: number;
}

export interface GraphFetchParams {
  entityTypes?: string[];
  fileNames?: string[];
  depth?: number;
  limit?: number;
}

export interface EntitySearchMatch {
  id: string;
  name: string;
  entity_type: string;
  score: number;
  workspace?: string;
}

export const KB_DEFAULT_DEPTH = 1;
/**
 * Safe default node budget for KG subgraph loads.
 * Single workspace: used as the request `limit` directly.
 * Flagged scope: divided by starred workspace count for per-workspace `limit`.
 */
export const KB_DEFAULT_LIMIT = 200;
/**
 * Max node budget for Graph load slider.
 * Single workspace: used as per-request max directly.
 * Flagged scope: divided by starred workspace count for per-workspace max.
 */
export const KB_MAX_LIMIT = 500;
export const KB_INITIAL_TYPE_COUNT = 3;
export const KB_DEFAULT_SEARCH_THRESHOLD = 0.6;

/** Above this member count, KB skips auto graph load and full document fan-out. */
export const KB_LARGE_GROUP_THRESHOLD = 30;
/** Max workspaces that can be loaded into one merged group graph at once. */
export const KB_MAX_GROUP_GRAPH_WORKSPACES = 25;
/** Default workspace checklist size for large groups before Apply. */
export const KB_DEFAULT_GROUP_SELECTION = 10;
/** Parallel cap for per-workspace KG / document fetches. */
export const KB_FETCH_CONCURRENCY = 6;

export function isLargeGroup(memberCount: number): boolean {
  return memberCount > KB_LARGE_GROUP_THRESHOLD;
}

export function defaultGroupWorkspaceSelection(memberNames: string[]): string[] {
  const sorted = [...memberNames].sort((a, b) => a.localeCompare(b));
  if (sorted.length <= KB_LARGE_GROUP_THRESHOLD) {
    return sorted;
  }
  return sorted.slice(0, KB_DEFAULT_GROUP_SELECTION);
}

export interface GroupWorkspaceEntitySummary {
  workspace: string;
  entityTypes: EntityTypeEntry[];
  totalEntities: number;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  const workers = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

/** Per-workspace `limit` when splitting an aggregate budget across starred workspaces. */
export function kbPerWorkspaceLimitFromBudget(
  budget: number,
  flaggedCount: number
): number {
  const n = Math.max(1, Math.floor(flaggedCount));
  return Math.max(1, Math.floor(budget / n));
}

export function kbDefaultLimitForGroup(memberCount: number): number {
  return kbPerWorkspaceLimitFromBudget(KB_DEFAULT_LIMIT, memberCount);
}

export function kbMaxLimitForGroup(memberCount: number): number {
  return kbPerWorkspaceLimitFromBudget(KB_MAX_LIMIT, memberCount);
}

/** @deprecated Use kbDefaultLimitForGroup */
export const kbDefaultLimitForFlagged = kbDefaultLimitForGroup;

/** @deprecated Use kbMaxLimitForGroup */
export const kbMaxLimitForFlagged = kbMaxLimitForGroup;

/** Divisor for per-workspace node limits in group scope. */
export function groupLimitDivisor(
  apiMemberCount: number,
  selectedWorkspaceCount: number,
  workspaceFilterActive: boolean
): number {
  if (workspaceFilterActive && selectedWorkspaceCount > 0) {
    return selectedWorkspaceCount;
  }
  return Math.max(1, apiMemberCount);
}

/** @deprecated Use groupLimitDivisor */
export const flaggedLimitDivisor = groupLimitDivisor;

export interface FileReference {
  file_name: string;
  uuid: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  source: string[];
  attributes: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label: string;
  score: number;
  source_file: string[];
}

export interface KnowledgeGraphResponse {
  workspace: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  error?: string;
}

export interface KnowledgeGraphPayload extends KnowledgeGraphResponse {
  truncated?: boolean;
  /** Present when the request used `?group=<name>`. */
  group?: string;
  filters?: {
    entity_types?: string[] | null;
    file_names?: string[] | null;
    depth?: number;
    limit?: number;
  };
}

export interface ApiGraphPayload {
  workspace?: string;
  nodes?: ApiGraphNode[];
  edges?: ApiGraphEdge[];
  truncated?: boolean;
  filters?: KnowledgeGraphPayload["filters"];
}

export interface EntitySearchResponse {
  query: string;
  workspace?: string;
  filters?: Record<string, unknown>;
  matches: EntitySearchMatch[];
  graph?: ApiGraphPayload;
  workspaces?: Array<{
    workspace: string;
    matches: EntitySearchMatch[];
    graph?: ApiGraphPayload;
  }>;
}

function clampGraphLimit(limit?: number): number | undefined {
  if (limit == null) return undefined;
  return Math.min(KB_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

function graphFetchQueryParams(params?: GraphFetchParams): Record<string, string | undefined> {
  const q: Record<string, string | undefined> = {};
  if (params?.entityTypes && params.entityTypes.length > 0) {
    q.entity_type = params.entityTypes.join(",");
  }
  if (params?.fileNames && params.fileNames.length > 0) {
    q.file_name = params.fileNames.join(",");
  }
  if (params?.depth != null) q.depth = String(params.depth);
  const limit = clampGraphLimit(params?.limit);
  if (limit != null) q.limit = String(limit);
  return q;
}

function mapKnowledgeGraph(
  workspace: string,
  apiNodes: ApiGraphNode[],
  apiEdges: ApiGraphEdge[],
  extra?: { truncated?: boolean; filters?: KnowledgeGraphPayload["filters"] }
): KnowledgeGraphPayload {
  const nameToId = new Map(apiNodes.map((n) => [n.name, n.id]));

  const nodes: GraphNode[] = apiNodes.map((n) => ({
    id: n.id,
    label: n.name,
    type: n.entity_type,
    source: [],
    attributes: {},
  }));

  const edges: GraphEdge[] = apiEdges.map((e) => ({
    source: e.source_id ?? nameToId.get(e.source) ?? e.source,
    target: e.target_id ?? nameToId.get(e.target) ?? e.target,
    label: e.type_description ?? "",
    score: 0,
    source_file: [],
  }));

  return {
    workspace,
    nodes,
    edges,
    truncated: extra?.truncated,
    filters: extra?.filters,
  };
}

function mapGraphApiPayload(
  data: {
    workspace?: string;
    nodes?: ApiGraphNode[];
    edges?: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  },
  fallbackWorkspace: string
): KnowledgeGraphPayload {
  return mapKnowledgeGraph(
    data.workspace ?? fallbackWorkspace,
    data.nodes ?? [],
    data.edges ?? [],
    { truncated: data.truncated, filters: data.filters }
  );
}

export async function getKnowledgeGraphEntityTypes(
  scope: KgApiScope
): Promise<{
  workspace?: string;
  group?: string;
  tag?: GroupTag;
  entityTypes: EntityTypeEntry[];
  workspaces?: GroupWorkspaceEntitySummary[];
}> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/entity-types/", scopeToQueryParams(scope))
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();

  if (isGroupScope(scope)) {
    const tag = normalizeGroupTag(data.tag);
    if (Array.isArray(data.entity_types) && (!Array.isArray(data.workspaces) || data.workspaces.length === 0)) {
      const entityTypes: EntityTypeEntry[] = (data.entity_types ?? [])
        .map((et: { type: string; count?: number }) => ({
          type: et.type,
          count: et.count ?? 0,
        }))
        .sort((a: EntityTypeEntry, b: EntityTypeEntry) => b.count - a.count);
      return {
        group: data.group ?? scope.group,
        tag,
        entityTypes,
        workspaces: [],
      };
    }

    const merged = new Map<string, number>();
    const workspaces: GroupWorkspaceEntitySummary[] = [];
    for (const ws of data.workspaces ?? []) {
      const types: EntityTypeEntry[] = (ws.entity_types ?? [])
        .map((et: { type: string; count?: number }) => ({
          type: et.type,
          count: et.count ?? 0,
        }))
        .sort((a: EntityTypeEntry, b: EntityTypeEntry) => b.count - a.count);
      const totalEntities = types.reduce((sum, et) => sum + et.count, 0);
      workspaces.push({
        workspace: ws.workspace ?? ws.name ?? "",
        entityTypes: types,
        totalEntities,
      });
      for (const et of types) {
        merged.set(et.type, (merged.get(et.type) ?? 0) + et.count);
      }
    }
    const entityTypes: EntityTypeEntry[] = Array.from(merged.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    return {
      group: data.group ?? scope.group,
      tag,
      entityTypes,
      workspaces: workspaces.filter((w) => w.workspace),
    };
  }

  const entityTypes: EntityTypeEntry[] = (data.entity_types ?? []).sort(
    (a: EntityTypeEntry, b: EntityTypeEntry) => b.count - a.count
  );
  return { workspace: data.workspace, entityTypes };
}

export function topEntityTypesByCount(
  types: EntityTypeEntry[],
  count = KB_INITIAL_TYPE_COUNT
): string[] {
  return [...types]
    .sort((a, b) => b.count - a.count)
    .slice(0, count)
    .map((t) => t.type);
}

export async function getFilteredKnowledgeGraph(
  scope: KgApiScope,
  params?: GraphFetchParams
): Promise<KnowledgeGraphPayload> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/", {
      ...scopeToQueryParams(scope),
      ...graphFetchQueryParams(params),
    })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }

  if (isGroupScope(scope)) {
    return mergeGroupGraphPayloads(data.graphs ?? [], data.group ?? scope.group);
  }

  return mapGraphApiPayload(data, scope.workspaceName);
}

export async function getKnowledgeGraph(
  workspaceName: string,
  params?: GraphFetchParams
): Promise<KnowledgeGraphResponse> {
  if (params) {
    return getFilteredKnowledgeGraph({ workspaceName }, params);
  }
  return getFilteredKnowledgeGraph(
    { workspaceName },
    { depth: KB_DEFAULT_DEPTH, limit: KB_DEFAULT_LIMIT }
  );
}

export async function getFlaggedKnowledgeGraphs(
  params?: GraphFetchParams
): Promise<KnowledgeGraphResponse[]> {
  const response = await fetch(
    buildApiUrl("/knowledge-graph/", {
      group: FLAGGED_GROUP_NAME,
      ...graphFetchQueryParams(params),
    })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data = await response.json();
  const graphs: {
    workspace: string;
    nodes: ApiGraphNode[];
    edges: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  }[] = data.graphs ?? [];

  return graphs.map((g) => mapGraphApiPayload(g, g.workspace));
}

function mergeGroupGraphPayloads(
  graphs: Array<{
    workspace: string;
    nodes?: ApiGraphNode[];
    edges?: ApiGraphEdge[];
    truncated?: boolean;
    filters?: KnowledgeGraphPayload["filters"];
  }>,
  groupName: string
): KnowledgeGraphPayload {
  if (graphs.length === 0) {
    return {
      workspace: groupName,
      group: groupName,
      nodes: [],
      edges: [],
      truncated: false,
    };
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();
  let truncated = false;

  for (const g of graphs) {
    if (g.truncated) truncated = true;
    const mapped = mapKnowledgeGraph(g.workspace, g.nodes ?? [], g.edges ?? []);
    const ws = g.workspace;
    const sid = (id: string) => scopedKnowledgeNodeId(ws, id);

    for (const n of mapped.nodes) {
      nodes.push({
        ...n,
        id: sid(n.id),
        attributes: { ...n.attributes, __kb_workspace: ws },
      });
    }
    for (const e of mapped.edges) {
      const source = sid(e.source as string);
      const target = sid(e.target as string);
      const key = `${source}\0${target}\0${e.label}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({ ...e, source, target });
    }
  }

  return { workspace: groupName, group: groupName, nodes, edges, truncated };
}

/** Per-workspace KG fetch + merge (for large group subsets without ?group= fan-out). */
export async function fetchKnowledgeGraphForWorkspaces(
  workspaceNames: string[],
  groupName: string,
  params?: GraphFetchParams,
  options?: { concurrency?: number }
): Promise<KnowledgeGraphPayload> {
  const names = [...new Set(workspaceNames.map((n) => n.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
  if (names.length === 0) {
    return mergeGroupGraphPayloads([], groupName);
  }

  const concurrency = options?.concurrency ?? KB_FETCH_CONCURRENCY;
  const slices = await runWithConcurrency(names, concurrency, async (ws) => {
    const payload = await getFilteredKnowledgeGraph({ workspaceName: ws }, params);
    return {
      workspace: ws,
      nodes: payload.nodes,
      edges: payload.edges,
      truncated: payload.truncated,
    };
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSeen = new Set<string>();
  let truncated = false;

  for (const g of slices) {
    if (g.truncated) truncated = true;
    const ws = g.workspace;
    const sid = (id: string) => scopedKnowledgeNodeId(ws, id);

    for (const n of g.nodes) {
      nodes.push({
        ...n,
        id: sid(n.id),
        attributes: { ...n.attributes, __kb_workspace: ws },
      });
    }
    for (const e of g.edges) {
      const source = sid(e.source as string);
      const target = sid(e.target as string);
      const key = `${source}\0${target}\0${e.label}`;
      if (edgeSeen.has(key)) continue;
      edgeSeen.add(key);
      edges.push({ ...e, source, target });
    }
  }

  return { workspace: groupName, group: groupName, nodes, edges, truncated };
}

export async function searchKnowledgeEntities(
  scope: KgApiScope,
  options: {
    q: string;
    threshold?: number;
    depth?: number;
    limit?: number;
    entityTypes?: string[];
    fileNames?: string[];
    matchLimit?: number;
  }
): Promise<EntitySearchResponse & { graphPayload: KnowledgeGraphPayload }> {
  const baseParams: Record<string, string | undefined> = {
    q: options.q.trim(),
    threshold: String(options.threshold ?? KB_DEFAULT_SEARCH_THRESHOLD),
    ...graphFetchQueryParams({
      depth: options.depth,
      limit: options.limit,
      entityTypes: options.entityTypes,
      fileNames: options.fileNames,
    }),
  };
  if (options.matchLimit != null) {
    baseParams.match_limit = String(options.matchLimit);
  }

  const response = await fetch(
    buildApiUrl("/knowledge/entities/search/", { ...scopeToQueryParams(scope), ...baseParams })
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const data: EntitySearchResponse = await response.json();

  let graphPayload: KnowledgeGraphPayload;
  if (isGroupScope(scope) && Array.isArray(data.workspaces)) {
    graphPayload = mergeGroupGraphPayloads(
      data.workspaces.map((w) => ({
        workspace: w.workspace,
        nodes: w.graph?.nodes,
        edges: w.graph?.edges,
        truncated: w.graph?.truncated,
        filters: w.graph?.filters,
      })),
      scope.group
    );
    const matches = data.workspaces.flatMap((w) =>
      (w.matches ?? []).map((m) => ({ ...m, workspace: w.workspace }))
    );
    return { ...data, matches, graphPayload };
  }

  if (isGroupScope(scope) && data.graph) {
    graphPayload = mergeGroupGraphPayloads(
      [
        {
          workspace: data.graph.workspace ?? scope.group,
          nodes: data.graph.nodes,
          edges: data.graph.edges,
          truncated: data.graph.truncated,
          filters: data.graph.filters,
        },
      ],
      scope.group
    );
    return { ...data, matches: data.matches ?? [], graphPayload };
  }

  const graph = data.graph;
  const fallbackWorkspace = isGroupScope(scope) ? scope.group : scope.workspaceName;
  graphPayload = graph
    ? mapGraphApiPayload(graph, graph.workspace ?? fallbackWorkspace)
    : { workspace: fallbackWorkspace, nodes: [], edges: [] };

  return { ...data, matches: data.matches ?? [], graphPayload };
}

/** Stable id for a node when merging multiple workspace graphs (avoids id collisions). */
function scopedKnowledgeNodeId(workspace: string, nodeId: string): string {
  return `${encodeURIComponent(workspace)}:${nodeId}`;
}

/**
 * Fetches all workspaces in the flagged group and merges graphs into one view.
 * Node ids are namespaced per workspace; each node gets `attributes.__kb_workspace`.
 */
export async function getMergedFlaggedKnowledgeGraph(
  params?: GraphFetchParams
): Promise<KnowledgeGraphPayload> {
  return getFilteredKnowledgeGraph(flaggedGroupScope(), params);
}

/** Parse raw entity UUID from a graph node id (handles flagged scoped ids). */
export function parseGraphNodeEntityId(nodeId: string): {
  scopedWorkspace: string | null;
  entityId: string;
} {
  const sep = nodeId.indexOf(":");
  if (sep > 0) {
    try {
      return {
        scopedWorkspace: decodeURIComponent(nodeId.slice(0, sep)),
        entityId: nodeId.slice(sep + 1),
      };
    } catch {
      return { scopedWorkspace: null, entityId: nodeId };
    }
  }
  return { scopedWorkspace: null, entityId: nodeId };
}

export interface GraphEntityRecord {
  kind: string;
  id: string;
  name: string;
  entity_type: string;
  file_name?: string;
  workspace?: string;
  attributes?: Record<string, unknown>;
  document_id?: string;
  chunk_id?: string | null;
  content?: string;
}

/** Full entity row for graph detail panel (GET /api/knowledge/entity/). */
export async function fetchGraphEntityRecord(
  nodeId: string,
  workspaceName: string | null
): Promise<GraphEntityRecord> {
  const { entityId } = parseGraphNodeEntityId(nodeId);
  const params: Record<string, string | undefined> = {};
  if (workspaceName) params.workspace_name = workspaceName;

  const response = await fetch(
    buildApiUrl(`/knowledge/entity/${encodeURIComponent(entityId)}/`, params)
  );
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }
  return response.json();
}

/** Entity/edge counts per document via depth=0 subgraph seeds. */
export async function getPerFileGraphCounts(
  workspaceName: string,
  fileNames: string[],
  options?: { concurrency?: number }
): Promise<Record<string, { nodes: number; edges: number }>> {
  const result: Record<string, { nodes: number; edges: number }> = {};
  const concurrency = Math.max(1, options?.concurrency ?? 4);

  for (let i = 0; i < fileNames.length; i += concurrency) {
    const batch = fileNames.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (fileName) => {
        try {
          const graph = await getFilteredKnowledgeGraph(
            { workspaceName },
            { fileNames: [fileName], depth: 0, limit: KB_MAX_LIMIT }
          );
          result[fileName] = {
            nodes: graph.nodes.length,
            edges: graph.edges.length,
          };
        } catch {
          result[fileName] = { nodes: 0, edges: 0 };
        }
      })
    );
  }

  return result;
}

/** Omit `file_name` query param when all catalog files are selected. */
export function resolveGraphFileNamesParam(
  availableFiles: string[],
  selectedFiles: Set<string>
): string[] | undefined {
  if (availableFiles.length === 0 || selectedFiles.size === 0) return undefined;
  const allSelected =
    selectedFiles.size >= availableFiles.length &&
    availableFiles.every((f) => selectedFiles.has(f));
  if (allSelected) return undefined;
  return Array.from(selectedFiles).sort((a, b) => a.localeCompare(b));
}

export async function listFilesForWorkspaces(
  workspaceNames: string[],
  options?: { concurrency?: number }
): Promise<string[]> {
  const names = new Set<string>();
  const unique = [...new Set(workspaceNames.map((n) => n.trim()).filter(Boolean))];
  const concurrency = options?.concurrency ?? KB_FETCH_CONCURRENCY;

  await runWithConcurrency(unique, concurrency, async (ws) => {
    try {
      for (const f of await listFiles(ws)) names.add(f);
    } catch {
      /* skip workspace */
    }
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

// --- Legacy search types (provenance display in chat UI) ---

export type SearchEngineType =
  | "agent_search"
  | "global_search"
  | "local_search"
  | "hybrid_search";

export interface ProvenanceEntry {
  id: string;
  snippet: string;
  reason: string;
}

export interface ChatMessage {
  id: string;
  type: "user" | "bot";
  text: string;
  timestamp: Date;
  provenance?: ProvenanceEntry[];
}

