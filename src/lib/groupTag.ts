import {
  normalizeGroupTag,
  type GroupTag,
  type WorkspaceGroupSummary,
} from "@/database/workspaceStorage";
import { metaDescription, metaSearchText } from "@/lib/resourceMeta";

export const GROUP_TAG_LABELS: Record<GroupTag, string> = {
  workspace: "Workspaces",
  files: "Files",
  entity: "Entities",
  relation: "Relations",
};

export const GROUP_TAG_DESCRIPTIONS: Record<GroupTag, string> = {
  workspace:
    "Combine workspaces for shared group chat and cross-workspace knowledge search.",
  files: "Curate specific documents across workspaces for scoped search and chat.",
  entity: "Group entities for targeted knowledge graph and chat search.",
  relation: "Group relations for targeted knowledge graph and chat search.",
};

export const GROUP_TAG_MEMBER_EMPTY: Record<GroupTag, string> = {
  workspace: "No workspaces in this group yet. Add some below.",
  files: "No files in this group yet. Pick a workspace below to add documents.",
  entity: "No entities in this group yet. Search a workspace below to add entities.",
  relation: "No relations in this group yet. Search below to add eligible relations.",
};

export const GROUP_TAG_MEMBER_ADD_TITLE: Record<GroupTag, string> = {
  workspace: "Add workspaces",
  files: "Add files",
  entity: "Add entities",
  relation: "Add relations",
};

export const GROUP_TAG_MEMBER_SEARCH_HINT: Record<GroupTag, string> = {
  workspace: "",
  files: "Search eligible files (policy-filtered).",
  entity: "Search eligible entities (policy-filtered).",
  relation: "Search eligible relations (policy-filtered).",
};

export function groupMemberEmptyMessage(tag: GroupTag | string | null | undefined): string {
  return GROUP_TAG_MEMBER_EMPTY[normalizeGroupTag(tag)];
}

export function groupMemberAddTitle(tag: GroupTag | string | null | undefined): string {
  return GROUP_TAG_MEMBER_ADD_TITLE[normalizeGroupTag(tag)];
}

export function groupMemberSearchHint(
  tag: GroupTag | string | null | undefined
): string | null {
  const hint = GROUP_TAG_MEMBER_SEARCH_HINT[normalizeGroupTag(tag)];
  return hint || null;
}

export const GROUP_TAG_KG_EMPTY: Record<GroupTag, string> = {
  workspace:
    "No knowledge graph data for this group. Add workspaces and ensure documents are preprocessed.",
  files:
    "No graph data for this file group. Add files to the group and ensure preprocessing is complete.",
  entity:
    "No graph data for this entity group. Add entities in Group members, then load the graph.",
  relation:
    "No graph data for this relation group. Add relations in Group members, then load the graph.",
};

export function groupKgEmptyMessage(tag: GroupTag | string | null | undefined): string {
  return GROUP_TAG_KG_EMPTY[normalizeGroupTag(tag)];
}

export function formatGroupTag(tag: GroupTag | string | null | undefined): string {
  return GROUP_TAG_LABELS[normalizeGroupTag(tag)];
}

const GROUP_TAG_TONE: Record<
  GroupTag,
  { pill: string; text: string; dot: string; border: string }
> = {
  workspace: {
    pill: "border-group-tag-workspace/30 bg-group-tag-workspace/10 text-group-tag-workspace",
    text: "text-group-tag-workspace",
    dot: "bg-group-tag-workspace",
    border: "border-group-tag-workspace/40",
  },
  files: {
    pill: "border-group-tag-files/30 bg-group-tag-files/10 text-group-tag-files",
    text: "text-group-tag-files",
    dot: "bg-group-tag-files",
    border: "border-group-tag-files/40",
  },
  entity: {
    pill: "border-group-tag-entity/30 bg-group-tag-entity/10 text-group-tag-entity",
    text: "text-group-tag-entity",
    dot: "bg-group-tag-entity",
    border: "border-group-tag-entity/40",
  },
  relation: {
    pill: "border-group-tag-relation/30 bg-group-tag-relation/10 text-group-tag-relation",
    text: "text-group-tag-relation",
    dot: "bg-group-tag-relation",
    border: "border-group-tag-relation/40",
  },
};

export function groupTagTone(tag: GroupTag | string | null | undefined) {
  return GROUP_TAG_TONE[normalizeGroupTag(tag)];
}

export function isWorkspaceGroup(
  group: Pick<WorkspaceGroupSummary, "tag">
): boolean {
  return group.tag === "workspace";
}

export function formatGroupMemberCount(
  group: Pick<WorkspaceGroupSummary, "tag" | "member_count">
): string {
  const count = group.member_count ?? 0;
  switch (group.tag) {
    case "files":
      return `${count} file${count === 1 ? "" : "s"}`;
    case "entity":
      return `${count} entit${count === 1 ? "y" : "ies"}`;
    case "relation":
      return `${count} relation${count === 1 ? "" : "s"}`;
    default:
      return `${count} workspace${count === 1 ? "" : "s"}`;
  }
}

export function formatGroupLabel(
  name: string,
  memberCount: number,
  tag?: GroupTag | string | null
): string {
  const groupTag = (tag === "files" || tag === "entity" || tag === "relation"
    ? tag
    : "workspace") as GroupTag;
  return `${name} (${formatGroupMemberCount({ tag: groupTag, member_count: memberCount })})`;
}

/** Display label for free-text workspace tags only — not group semantic tags. */
export function groupTagLabel(_group: Pick<WorkspaceGroupSummary, "tag">): string | null {
  return null;
}

export function groupSearchText(
  group: Pick<
    WorkspaceGroupSummary,
    "name" | "tag" | "description" | "owner_username"
  >
): string {
  const parts = [group.name, formatGroupTag(group.tag)];
  if (group.owner_username?.trim()) parts.push(group.owner_username.trim());
  const description = metaDescription(group);
  if (description) parts.push(description);
  return parts.join(" ").toLowerCase();
}

export { metaDescription as groupDescription };
