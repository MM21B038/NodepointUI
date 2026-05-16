export type ChatBlock =
  | {
      id: string;
      kind: "thinking";
      content: string;
      isStreaming?: boolean;
    }
  | {
      id: string;
      kind: "response";
      content: string;
      isStreaming?: boolean;
    }
  | {
      id: string;
      kind: "tool_calls";
      names: string[];
    }
  | {
      id: string;
      kind: "tool_call";
      toolCallId: string;
      toolName: string;
      status: "running" | "completed" | "failed";
      ok?: boolean;
    }
  | {
      id: string;
      kind: "tool_result";
      toolCallId: string;
      toolName: string;
      ok: boolean;
      result: string;
    }
  | {
      id: string;
      kind: "status";
      label: string;
      detail?: string;
    }
  | {
      id: string;
      kind: "error";
      message: string;
    };

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content?: string;
  blocks: ChatBlock[];
  timestamp: Date;
  isStreaming?: boolean;
}

export function createBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
