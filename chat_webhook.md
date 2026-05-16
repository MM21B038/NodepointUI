# Chat WebSocket API

Backend-only streaming chat over Django Channels. Requires **ASGI** (`uvicorn config.asgi:application`) and **Redis** for the channel layer.

## Quick start

1. Star a workspace: `PATCH /api/workspace/<name>/toggle-flag/`
2. `GET /api/chat/default/` — loads **root messages** (creates chat on first starred workspace if needed)
3. Connect WebSocket: `ws://localhost:8000/ws/chat/default/`
4. Send `{ "type": "chat.send", "content": "Hello" }`
5. Receive typed stream events (`thinking_token`, `assistant_response_token`, tool lifecycle, etc.)

`default` resolves to the **first starred** workspace by `created_at`. `chat.ready` returns the real workspace name.

## REST endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/<workspace_name>/` | Chat history (lazy create); use `default` for first starred |
| DELETE | `/api/chat/<workspace_name>/` | Clear chat (full reset) |

## WebSocket protocol

**URL:** `/ws/chat/<workspace_name>/` (including `default`)

The workspace must exist, or `default` must resolve to a starred workspace. Unknown → close code `4004`.

### Client → server

```json
{ "type": "chat.send", "content": "...", "exclude_servers": ["WikiServer"] }
{ "type": "chat.cancel" }
{ "type": "ping" }
```

### Server → client

- `chat.ready` — on connect (`workspace` = resolved real name)
- Agent events — same `type` values as `StreamEventType` in `nodepoint/agent/schema.py`
- `section` — `{ "section": "thinking"|"response"|"tool_calls"|"tool_completed", "action": "open"|"close" }`
- `tool_calls` — `{ "names": ["tool_a", ...] }`
- `tool_completed` — `{ "tool_name", "tool_call_id", "ok" }`
- `chat.compressed` — after context compression (server-only branch switch)
- `chat.done` — turn finished
- `error` — `{ "message": "..." }`

## Workspace scope

One chat per workspace name. Star workspaces (`is_flag`) to include them in `Knowledge.search_graph`. Chat on any workspace (or `default`) searches the current workspace plus all starred corpora.

Bulk metadata: `GET /api/chat/summary/?flagged=true` (see [`workspace-api.md`](workspace-api.md)).

## Context compression (internal branches)

When token count on the active thread exceeds `CHAT_COMPRESS_TOKEN_THRESHOLD` (default **64000**):

1. The server runs a compression pass and builds a **report** (summary).
2. It creates an **internal** child branch (`is_internal=true`) with a single **user** handoff message containing that report (for the model only).
3. The server switches the active branch internally; further turns use that branch.
4. The client receives `chat.compressed` — **no branch IDs** in the protocol.

Users never see compression content:

- `GET /api/chat/<workspace_name>/` returns **root branch messages only** (visible chat history).
- No branch REST API.

Root messages on GET are unchanged after compression.

## Environment

- `CHAT_COMPRESS_TOKEN_THRESHOLD` — default `64000`
- `CHAT_DEFAULT_SYSTEM` — default system prompt for new conversations
- `BASE_URL`, `API_KEY` — required for `Agent`
