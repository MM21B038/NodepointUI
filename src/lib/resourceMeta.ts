export interface ResourceMetaFields {
  name: string;
  tag?: string | null;
  description?: string | null;
}

export function metaTagLabel(item: Pick<ResourceMetaFields, "tag">): string | null {
  const tag = item.tag?.trim();
  return tag ? tag : null;
}

export function metaDescription(
  item: Pick<ResourceMetaFields, "description">
): string | null {
  const description = item.description?.trim();
  return description ? description : null;
}

export function metaSearchText(item: ResourceMetaFields): string {
  const parts = [item.name];
  const tag = metaTagLabel(item);
  const description = metaDescription(item);
  if (tag) parts.push(tag);
  if (description) parts.push(description);
  return parts.join(" ").toLowerCase();
}
