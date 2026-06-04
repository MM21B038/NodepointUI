import type { ChatStreamEvent } from "@/database/chatStorage";
import type { ChatMessageRecord } from "@/database/chatStorage";
import { type ChatBlock, type ChatTurn, createBlockId } from "@/lib/chatTypes";

function stripStreamingFlag<T extends { isStreaming?: boolean }>(block: T): T {
  const { isStreaming: _, ...rest } = block;
  return rest as T;
}

/** Finalize only blocks for the given section (or all stream blocks if section omitted). */
function finalizeStreamingBlocks(
  blocks: ChatBlock[],
  section?: "thinking" | "response"
): ChatBlock[] {
  return blocks.map((b) => {
    if (b.kind === "thinking" || b.kind === "response") {
      if (!b.isStreaming) return b;
      if (section && b.kind !== section) return b;
      return stripStreamingFlag(b) as ChatBlock;
    }
    if (b.kind === "tool_call" && b.status === "running" && !section) {
      return { ...b, status: "completed" as const, ok: true };
    }
    return b;
  });
}

function findLastBlockIndex(blocks: ChatBlock[], kind: "thinking" | "response"): number {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].kind === kind) return i;
  }
  return -1;
}

function isToolBlock(block: ChatBlock): boolean {
  return (
    block.kind === "tool_call" ||
    block.kind === "tool_calls" ||
    block.kind === "tool_result"
  );
}

/**
 * Tools that finish after the response section has already opened are appended
 * after the response block in the array. Insert new tools before that response
 * unless a new thinking block already started (next cycle).
 */
function insertIndexForNewTool(blocks: ChatBlock[]): number {
  let responseIdx = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].kind === "response") {
      responseIdx = i;
      break;
    }
  }
  if (responseIdx < 0) return blocks.length;

  for (let i = responseIdx + 1; i < blocks.length; i++) {
    if (blocks[i].kind === "thinking" || blocks[i].kind === "cycle_boundary") {
      return blocks.length;
    }
  }
  return responseIdx;
}

/**
 * Move tool blocks that sit directly after a response (same cycle, response opened early).
 * Do NOT move tools when a thinking block follows — those belong to the next round.
 */
export function reorderLateToolsBeforeResponse(blocks: ChatBlock[]): ChatBlock[] {
  const out: ChatBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.kind !== "response") {
      out.push(block);
      i++;
      continue;
    }
    let j = i + 1;
    const lateTools: ChatBlock[] = [];
    while (j < blocks.length && isToolBlock(blocks[j])) {
      lateTools.push(blocks[j]);
      j++;
    }
    const followedByThinking =
      j < blocks.length && blocks[j].kind === "thinking";
    if (lateTools.length > 0 && !followedByThinking) {
      out.push(...lateTools);
      out.push(block);
      i = j;
    } else {
      out.push(block);
      i++;
    }
  }
  return out;
}

/**
 * Tool events often arrive before the thinking section opens, leaving tool_call
 * blocks at the start of the array. Move that prefix to after the first thinking
 * block so the UI shows think → tools, not tools → think.
 */
export function moveLeadingToolsAfterFirstThinking(blocks: ChatBlock[]): ChatBlock[] {
  const firstThinkIdx = blocks.findIndex((b) => b.kind === "thinking");
  if (firstThinkIdx <= 0) return blocks;

  const leadingTools = blocks.slice(0, firstThinkIdx).filter(isToolBlock);
  if (leadingTools.length === 0) return blocks;

  const rest = blocks.slice(firstThinkIdx);
  return [rest[0], ...leadingTools, ...rest.slice(1)];
}

/** Canonical timeline for activity UI: late tools + leading-tool fix. */
export function normalizeBlockTimeline(blocks: ChatBlock[]): ChatBlock[] {
  return moveLeadingToolsAfterFirstThinking(reorderLateToolsBeforeResponse(blocks));
}

function findRunningToolIndex(
  blocks: ChatBlock[],
  toolCallId: string,
  toolName: string
): number {
  const byId = blocks.findIndex(
    (b) => b.kind === "tool_call" && b.toolCallId === toolCallId
  );
  if (byId >= 0) return byId;
  return blocks.findIndex(
    (b) =>
      b.kind === "tool_call" &&
      b.toolName === toolName &&
      b.status === "running"
  );
}

function completeToolCall(
  blocks: ChatBlock[],
  toolCallId: string,
  toolName: string,
  ok: boolean
): ChatBlock[] {
  const idx = findRunningToolIndex(blocks, toolCallId, toolName);
  if (idx >= 0) {
    const existing = blocks[idx] as Extract<ChatBlock, { kind: "tool_call" }>;
    const next = [...blocks];
    next[idx] = {
      ...existing,
      toolCallId,
      toolName,
      status: ok ? "completed" : "failed",
      ok,
    };
    return normalizeBlockTimeline(next);
  }
  const newBlock: ChatBlock = {
    id: createBlockId("tool-call"),
    kind: "tool_call",
    toolCallId,
    toolName,
    status: ok ? "completed" : "failed",
    ok,
  };
  const insertAt = insertIndexForNewTool(blocks);
  const next = [...blocks];
  next.splice(insertAt, 0, newBlock);
  return normalizeBlockTimeline(next);
}

function appendToLastBlock(
  blocks: ChatBlock[],
  kind: "thinking" | "response",
  token: string
): ChatBlock[] {
  const next = [...blocks];
  const idx = findLastBlockIndex(next, kind);
  if (idx >= 0) {
    const block = next[idx] as Extract<ChatBlock, { kind: typeof kind }>;
    next[idx] = {
      ...block,
      content: block.content + token,
      isStreaming: true,
    };
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
  const byId = blocks.findIndex(
    (b) => b.kind === "tool_call" && b.toolCallId === toolCallId
  );
  if (byId >= 0) return blocks;

  const runningByName = blocks.findIndex(
    (b) =>
      b.kind === "tool_call" &&
      b.toolName === toolName &&
      b.status === "running"
  );
  if (runningByName >= 0) {
    const next = [...blocks];
    const existing = blocks[runningByName] as Extract<ChatBlock, { kind: "tool_call" }>;
    next[runningByName] = { ...existing, toolCallId };
    return next;
  }

  const newBlock: ChatBlock = {
    id: createBlockId("tool-call"),
    kind: "tool_call",
    toolCallId,
    toolName,
    status: "running",
  };
  const insertAt = insertIndexForNewTool(blocks);
  const next = [...blocks];
  next.splice(insertAt, 0, newBlock);
  return normalizeBlockTimeline(next);
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

/** Apply inline partial text from incognito cancel/interrupt payloads. */
export function applyPartialSavedToTurns(
  turns: ChatTurn[],
  savedContent: string | undefined
): ChatTurn[] {
  const text = savedContent?.trim();
  if (!text) return turns;
  const next = [...turns];
  const last = next[next.length - 1];
  if (last?.role !== "assistant") return next;
  const blocks = finalizeAssistantBlocks(last.blocks);
  const hasResponse = blocks.some((b) => b.kind === "response");
  next[next.length - 1] = {
    ...last,
    isStreaming: false,
    blocks: hasResponse
      ? blocks
      : [
          ...blocks,
          {
            id: createBlockId("response"),
            kind: "response" as const,
            content: text,
          },
        ],
  };
  return next;
}

export function applyStreamEvent(blocks: ChatBlock[], event: ChatStreamEvent): ChatBlock[] {
  const next = applyStreamEventInner(blocks, event);
  return normalizeBlockTimeline(next);
}

function applyStreamEventInner(blocks: ChatBlock[], event: ChatStreamEvent): ChatBlock[] {
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
        const closedSection =
          section === "thinking" || section === "response" ? section : undefined;
        let next = finalizeStreamingBlocks(blocks, closedSection);
        if (closedSection === "response") {
          next = [
            ...next,
            { id: createBlockId("cycle-boundary"), kind: "cycle_boundary" },
          ];
        }
        return next;
      }
      if (action === "open" && section === "thinking") {
        const last = blocks[blocks.length - 1];
        if (last?.kind === "thinking" && last.isStreaming) return blocks;
        const hasFinalizedResponse = blocks.some(
          (b) => b.kind === "response" && b.isStreaming !== true
        );
        const prefix: ChatBlock[] =
          hasFinalizedResponse && last?.kind !== "cycle_boundary"
            ? [{ id: createBlockId("cycle-boundary"), kind: "cycle_boundary" }]
            : [];
        const newThinking: ChatBlock = {
          id: createBlockId("thinking"),
          kind: "thinking",
          content: "",
          isStreaming: true,
        };
        const withThink = [...blocks, ...prefix, newThinking];
        return normalizeBlockTimeline(withThink);
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
      const toolName =
        "tool_name" in event ? String(event.tool_name) : "tool";
      const toolCallId =
        "tool_call_id" in event && event.tool_call_id != null && String(event.tool_call_id)
          ? String(event.tool_call_id)
          : (() => {
              const idx = findRunningToolIndex(blocks, "", toolName);
              if (idx >= 0) {
                const existing = blocks[idx] as Extract<ChatBlock, { kind: "tool_call" }>;
                return existing.toolCallId;
              }
              return createBlockId("tc");
            })();
      return completeToolCall(blocks, toolCallId, toolName, ok);
    }

    case "agent_turn_start": {
      const hasActivity = blocks.some(
        (b) =>
          b.kind === "thinking" ||
          b.kind === "tool_call" ||
          b.kind === "tool_calls" ||
          b.kind === "tool_result" ||
          b.kind === "response"
      );
      if (!hasActivity) return blocks;
      const last = blocks[blocks.length - 1];
      // Round already opened via thinking section; tools for this cycle follow.
      if (last?.kind === "cycle_boundary" || last?.kind === "thinking") return blocks;
      // Same user turn can repeat think→tools before any response; no boundary yet.
      const hasFinalizedResponse = blocks.some(
        (b) => b.kind === "response" && b.isStreaming !== true
      );
      if (!hasFinalizedResponse) return blocks;
      return [
        ...blocks,
        { id: createBlockId("cycle-boundary"), kind: "cycle_boundary" },
      ];
    }

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
  return normalizeBlockTimeline(finalizeStreamingBlocks(blocks));
}

function countToolCallBlocks(blocks: ChatBlock[]): number {
  return blocks.filter((b) => b.kind === "tool_call").length;
}

/** Heuristic: prefer the block snapshot with more streamed / tool content. */
export function blockRichnessScore(blocks: ChatBlock[]): number {
  let score = 0;
  for (const b of blocks) {
    switch (b.kind) {
      case "thinking":
      case "response":
        score += (b.content?.length ?? 0) + 40;
        break;
      case "tool_call":
        score += 100;
        break;
      default:
        score += 8;
    }
  }
  return score;
}

export function pickRicherBlocks(...candidates: ChatBlock[][]): ChatBlock[] {
  let best: ChatBlock[] = [];
  let bestScore = -1;
  for (const blocks of candidates) {
    if (!blocks.length) continue;
    const score = blockRichnessScore(blocks);
    if (score > bestScore) {
      bestScore = score;
      best = blocks;
    }
  }
  return best.length ? [...best] : [];
}

/**
 * Merge REST gap-fill with in-memory UI + live WS blocks without replacing the whole thread.
 */
export function mergeReconnectChatTurns(
  history: ChatTurn[],
  prevTurns: ChatTurn[],
  liveBlocks: ChatBlock[] = []
): ChatTurn[] {
  if (prevTurns.length === 0) {
    return liveBlocks.length
      ? markLastAssistantStreaming(history, liveBlocks)
      : history;
  }

  const lastPrev = prevTurns[prevTurns.length - 1];
  let prevUser: ChatTurn | undefined;
  let prevAssistant: ChatTurn | undefined;

  if (lastPrev?.role === "assistant") {
    prevAssistant = lastPrev;
    const maybeUser = prevTurns[prevTurns.length - 2];
    if (maybeUser?.role === "user") prevUser = maybeUser;
  } else if (lastPrev?.role === "user") {
    prevUser = lastPrev;
  }

  const histLast = history[history.length - 1];
  const histAssistant = histLast?.role === "assistant" ? histLast : undefined;

  const mergedBlocks = pickRicherBlocks(
    liveBlocks,
    prevAssistant?.blocks ?? [],
    histAssistant?.blocks ?? []
  );

  const stillLive =
    Boolean(prevAssistant?.isStreaming) ||
    liveBlocks.length > 0 ||
    blockRichnessScore(mergedBlocks) > blockRichnessScore(histAssistant?.blocks ?? []);

  if (!stillLive) return history;

  const preserveAssistantId = prevAssistant?.id;

  const withStableIds = (turns: ChatTurn[]): ChatTurn[] => {
    if (!preserveAssistantId) return turns;
    const last = turns[turns.length - 1];
    if (last?.role !== "assistant") return turns;
    return [...turns.slice(0, -1), { ...last, id: preserveAssistantId }];
  };

  if (prevUser) {
    const lastHistUser = [...history].reverse().find((t) => t.role === "user");
    const userMatches =
      lastHistUser?.content?.trim() === prevUser.content?.trim();
    if (!userMatches) {
      const base =
        histLast?.role === "assistant" ? history.slice(0, -1) : history;
      return withStableIds(
        markLastAssistantStreaming(
          [...base, { ...prevUser, blocks: [] }],
          mergedBlocks
        )
      );
    }
  }

  return withStableIds(markLastAssistantStreaming(history, mergedBlocks));
}

/** Mark the last assistant turn as live-streaming (reconnect / agent_busy attach). */
export function markLastAssistantStreaming(
  turns: ChatTurn[],
  liveBlocks?: ChatBlock[]
): ChatTurn[] {
  if (turns.length === 0) {
    const turn = createEmptyAssistantTurn();
    if (liveBlocks?.length) turn.blocks = liveBlocks;
    return [turn];
  }
  const last = turns[turns.length - 1];
  if (last.role === "assistant") {
    return [
      ...turns.slice(0, -1),
      {
        ...last,
        isStreaming: true,
        blocks: liveBlocks?.length ? liveBlocks : last.blocks,
      },
    ];
  }
  const turn = createEmptyAssistantTurn();
  if (liveBlocks?.length) turn.blocks = liveBlocks;
  return [...turns, turn];
}

export function mergeHistoryWithStreamedAssistantTurn(
  history: ChatTurn[],
  streamedAssistant: ChatTurn | undefined
): ChatTurn[] {
  if (!streamedAssistant || streamedAssistant.role !== "assistant") return history;
  const streamedTools = countToolCallBlocks(streamedAssistant.blocks);
  if (streamedTools === 0) return history;

  const lastIdx = history.length - 1;
  if (lastIdx < 0 || history[lastIdx].role !== "assistant") return history;

  const historyAssistant = history[lastIdx];
  const historyTools = countToolCallBlocks(historyAssistant.blocks);
  if (streamedTools <= historyTools) return history;

  const next = [...history];
  next[lastIdx] = {
    ...historyAssistant,
    blocks: streamedAssistant.blocks,
    isStreaming: false,
  };
  return next;
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

function shouldInsertCycleBoundaryBeforeAssistant(
  blocks: ChatBlock[],
  message: ChatMessageRecord
): boolean {
  if (blocks.length === 0) return false;
  const last = blocks[blocks.length - 1];
  if (last.kind === "cycle_boundary") return false;

  const addsReasoning = Boolean(message.reasoning_content?.trim());
  const addsTools = parseToolCallsBlock(message.tool_calls).length > 0;
  if (!addsReasoning && !addsTools) return false;

  return (
    last.kind === "response" ||
    last.kind === "tool_call" ||
    last.kind === "thinking"
  );
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
        if (shouldInsertCycleBoundaryBeforeAssistant(blocks, m)) {
          blocks.push({ id: `${m.id}-cycle`, kind: "cycle_boundary" });
        }
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
        blocks: normalizeBlockTimeline(blocks),
        timestamp,
      });
    }
  }

  return turns;
}
