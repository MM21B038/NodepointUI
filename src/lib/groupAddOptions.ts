import type { GroupAddOption, GroupTag } from "@/database/workspaceStorage";
import {
  formatScopedResourceLabel,
  ownerParamsFrom,
  workspaceResourceKey,
} from "@/lib/ownerScope";

export function groupAddOptionId(option: GroupAddOption): string {
  switch (option.kind) {
    case "workspace":
      return workspaceResourceKey(option.name, option.owner_id);
    case "files":
      return option.document_id;
    case "entity":
      return option.entity_id;
    case "relation":
      return option.relation_id;
  }
}

export function groupAddOptionLabel(
  option: GroupAddOption,
  duplicateNames?: Set<string>,
  multiOwnerList?: boolean
): string {
  switch (option.kind) {
    case "workspace":
      return formatScopedResourceLabel(option.name, option.owner_username, {
        duplicateNames,
        multiOwnerList,
      });
    case "files":
      return option.file_name || option.document_id;
    case "entity":
      return option.name || option.entity_id;
    case "relation":
      return `${option.source} → ${option.target}`;
  }
}

export function groupAddOptionHint(option: GroupAddOption): string | undefined {
  switch (option.kind) {
    case "workspace":
      return option.description?.trim() || option.tag || undefined;
    case "files":
      return option.workspace
        ? `${option.workspace}${option.owner_username ? ` · ${option.owner_username}` : ""}`
        : undefined;
    case "entity":
      return [option.entity_type, option.workspace].filter(Boolean).join(" · ");
    case "relation":
      return option.workspace || undefined;
  }
}

export function groupAddOptionOwnerParams(
  option: GroupAddOption
): ReturnType<typeof ownerParamsFrom> {
  switch (option.kind) {
    case "workspace":
      return ownerParamsFrom({
        name: option.name,
        owner_id: option.owner_id,
        owner_username: option.owner_username,
      });
    case "files":
      return ownerParamsFrom({
        name: option.file_name,
        owner_id: option.owner_id,
        owner_username: option.owner_username,
      });
    case "entity":
      return ownerParamsFrom({
        name: option.name,
        owner_id: option.owner_id,
        owner_username: option.owner_username,
      });
    case "relation":
      return ownerParamsFrom({
        name: option.relation_id,
        owner_id: option.owner_id,
        owner_username: option.owner_username,
      });
  }
}

export function supportsCandidateOwnerFilter(tag: GroupTag): boolean {
  return tag === "files" || tag === "entity" || tag === "relation";
}
