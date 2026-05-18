import type { ChatBlock } from "@/lib/chatTypes";

/** Plain markdown/text from assistant response blocks only. */
export function getAssistantResponseText(blocks: ChatBlock[]): string {
  return blocks
    .filter((b): b is Extract<ChatBlock, { kind: "response" }> => b.kind === "response")
    .map((b) => b.content)
    .join("\n\n")
    .trim();
}
