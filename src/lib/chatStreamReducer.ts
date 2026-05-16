import type { ChatStreamEvent } from "@/database/chatStorage";
import type { ChatMessageRecord } from "@/database/chatStorage";
import { type ChatBlock, type ChatTurn, createBlockId } from "@/lib/chatTypes";

function finalizeStreamingBlocks(blocks: ChatBlock[]): ChatBlock[] {
  return blocks.map((b) => {
    if (b.kind === "thinking" || b.kind === "response") {
      if (b.isStreaming) {
        const { isStreaming: _, ...rest } = b;
        return rest as ChatBlock;
      }
    }
    if (b.kind === "tool_call" && b.status === "running") {
      return { ...b, status: "completed" as const, ok: true };
    }
    return b;
  });
}

function completeToolCall(
  blocks: ChatBlock[],
  toolCallId: string,
  toolName: string,
  ok: boolean
): ChatBlock[] {
  const idx = blocks.findIndex(
    (b) => b.kind === "tool_call" && b.toolCallId === toolCallId
  );
  if (idx >= 0) {
    const existing = blocks[idx] as Extract<ChatBlock, { kind: "tool_call" }>;
    const next = [...blocks];
    next[idx] = {
      ...existing,
      status: ok ? "completed" : "failed",
      ok,
    };
    return next;
  }
  return [
    ...blocks,
    {
      id: createBlockId("tool-call"),
      kind: "tool_call",
      toolCallId,
      toolName,
      status: ok ? "completed" : "failed",
      ok,
    },
  ];
}

function appendToLastBlock(
  blocks: ChatBlock[],
  kind: "thinking" | "response",
  token: string
): ChatBlock[] {
  const next = [...blocks];
  const last = next[next.length - 1];
  if (last?.kind === kind && last.isStreaming) {
    next[next.length - 1] = { ...last, content: last.content + token };
    return next;
  }
  next.push({
    id: createBlockId(kind),
    kind,
    content: token,
    isStreaming: true,
  });
  return next;
}

function upsertToolCall(
  blocks: ChatBlock[],
  toolCallId: string,
  toolName: string
): ChatBlock[] {
  const idx = blocks.findIndex(
    (b) => b.kind === "tool_call" && b.toolCallId === toolCallId
  );
  if (idx >= 0) return blocks;
  return [
    ...blocks,
    {
      id: createBlockId("tool-call"),
      kind: "tool_call",
      toolCallId,
      toolName,
      status: "running",
    },
  ];
}

export function createEmptyAssistantTurn(id?: string): ChatTurn {
  return {
    id: id ?? createBlockId("assistant"),
    role: "assistant",
    blocks: [],
    timestamp: new Date(),
    isStreaming: true,
  };
}

export function applyStreamEvent(blocks: ChatBlock[], event: ChatStreamEvent): ChatBlock[] {
  switch (event.type) {
    case "thinking_token":
      if ("token" in event && typeof event.token === "string") {
        return appendToLastBlock(blocks, "thinking", event.token);
      }
      return blocks;

    case "assistant_response_token":
      if ("token" in event && typeof event.token === "string") {
        return appendToLastBlock(blocks, "response", event.token);
      }
      return blocks;

    case "section": {
      const section = event.section as string | undefined;
      const action = event.action as "open" | "close" | undefined;
      if (action === "close") {
        return finalizeStreamingBlocks(blocks);
      }
      if (action === "open" && section === "thinking") {
        const last = blocks[blocks.length - 1];
        if (last?.kind === "thinking" && last.isStreaming) return blocks;
        return [
          ...blocks,
          { id: createBlockId("thinking"), kind: "thinking", content: "", isStreaming: true },
        ];
      }
      if (action === "open" && section === "response") {
        const last = blocks[blocks.length - 1];
        if (last?.kind === "response" && last.isStreaming) return blocks;
        return [
          ...blocks,
          { id: createBlockId("response"), kind: "response", content: "", isStreaming: true },
        ];
      }
      return blocks;
    }

    case "tool_calls":
      if ("names" in event && Array.isArray(event.names)) {
        let next = blocks;
        (event.names as string[]).forEach((name, i) => {
          next = upsertToolCall(next, `batch-${name}-${i}`, name);
        });
        return next;
      }
      return blocks;

    case "tool_call_start":
      if ("tool_call_id" in event && "tool_name" in event) {
        return upsertToolCall(
          blocks,
          String(event.tool_call_id),
          String(event.tool_name)
        );
      }
      return blocks;

    case "tool_call_delta":
    case "tool_call_end":
      return blocks;

    case "tool_completed":
      if ("tool_call_id" in event && "tool_name" in event) {
        return completeToolCall(
          blocks,
          String(event.tool_call_id),
          String(event.tool_name),
          Boolean(event.ok)
        );
      }
      return blocks;

    case "tool_result": {
      const ok = Boolean(event.ok);
      const toolCallId =
        "tool_call_id" in event ? String(event.tool_call_id) : createBlockId("tc");
      const toolName =
        "tool_name" in event ? String(event.tool_name) : "tool";
      return completeToolCall(blocks, toolCallId, toolName, ok);
    }

    case "agent_turn_start":
      return [
        ...blocks,
        {
          id: createBlockId("status"),
          kind: "status",
          label: "Agent turn",
          detail:
            "turn_index" in event ? `Round ${String(event.turn_index)}` : undefined,
        },
      ];

    case "model_turn_complete":
      return [
        ...blocks,
        {
          id: createBlockId("status"),
          kind: "status",
          label: "Model turn complete",
          detail: "finish_reason" in event ? String(event.finish_reason) : undefined,
        },
      ];

    case "assistant_tool_calls_message":
      if ("tool_calls" in event && event.tool_calls) {
        return [...blocks, ...parseToolCallsBlock(event.tool_calls)];
      }
      return blocks;

    case "agent_session_done":
      return [
        ...blocks,
        {
          id: createBlockId("status"),
          kind: "status",
          label: "Agent session complete",
        },
      ];

    case "chat.compressed":
      return [
        ...blocks,
        {
          id: createBlockId("compressed"),
          kind: "status",
          label: "Context compressed",
          detail: "Server summarized older context (not shown in history).",
        },
      ];

    case "error":
      return [
        ...blocks,
        {
          id: createBlockId("error"),
          kind: "error",
          message: "message" in event ? String(event.message) : "Unknown error",
        },
      ];

    default:
      return blocks;
  }
}

export function finalizeAssistantBlocks(blocks: ChatBlock[]): ChatBlock[] {
  return finalizeStreamingBlocks(blocks);
}

function parseToolCallsBlock(toolCalls: unknown): ChatBlock[] {
  if (!toolCalls) return [];
  const blocks: ChatBlock[] = [];
  try {
    const arr = Array.isArray(toolCalls) ? toolCalls : [];
    arr.forEach((tc, i) => {
      if (typeof tc === "object" && tc !== null) {
        const id = String((tc as { id?: string }).id ?? `call-${i}`);
        const name = String(
          (tc as { function?: { name?: string } }).function?.name ?? "tool"
        );
        blocks.push({
          id: createBlockId("hist-tc"),
          kind: "tool_call",
          toolCallId: id,
          toolName: name,
          status: "completed",
          ok: true,
        });
      }
    });
  } catch {
    /* ignore malformed tool_calls */
  }
  return blocks;
}

export function messagesToTurns(messages: ChatMessageRecord[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === "user") {
      turns.push({
        id: msg.id,
        role: "user",
        content: msg.content,
        blocks: [],
        timestamp: new Date(msg.created_at),
      });
      i++;
      continue;
    }

    const blocks: ChatBlock[] = [];
    const runId = msg.id;
    const timestamp = new Date(msg.created_at);

    while (i < messages.length && messages[i].role !== "user") {
      const m = messages[i];
      if (m.role === "assistant") {
        if (m.reasoning_content?.trim()) {
          blocks.push({
            id: `${m.id}-thinking`,
            kind: "thinking",
            content: m.reasoning_content,
          });
        }
        blocks.push(...parseToolCallsBlock(m.tool_calls));
        if (m.content?.trim()) {
          blocks.push({
            id: `${m.id}-response`,
            kind: "response",
            content: m.content,
          });
        }
      } else if (m.role === "tool") {
        const toolCallId = m.tool_call_id ?? m.id;
        const toolName = m.tool_name ?? "tool";
        const idx = blocks.findIndex(
          (b) => b.kind === "tool_call" && b.toolCallId === toolCallId
        );
        if (idx >= 0) {
          const existing = blocks[idx] as Extract<ChatBlock, { kind: "tool_call" }>;
          blocks[idx] = { ...existing, status: "completed", ok: true };
        } else {
          blocks.push({
            id: m.id,
            kind: "tool_call",
            toolCallId,
            toolName,
            status: "completed",
            ok: true,
          });
        }
      }
      i++;
    }

    if (blocks.length > 0) {
      turns.push({
        id: runId,
        role: "assistant",
        blocks,
        timestamp,
      });
    }
  }

  return turns;
}
