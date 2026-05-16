# Nodepoint API Reference

Complete reference for REST and WebSocket APIs. Base URL example: `http://localhost:8000`.

---

## Table of contents

1. [Overview](#overview)
2. [Conventions](#conventions)
3. [Workspace](#workspace)
4. [Documents](#documents)
5. [Preprocess](#preprocess)
6. [Knowledge graph](#knowledge-graph)
7. [Chat (REST)](#chat-rest)
8. [Chat (WebSocket)](#chat-websocket)
9. [Agent tools](#agent-tools)
10. [Environment](#environment)
11. [Endpoint index](#endpoint-index)

---

## Overview

| Surface | Prefix | Purpose |
|---------|--------|---------|
| REST | `/api/` | CRUD for workspaces, documents, graphs, chat |
| WebSocket | `/ws/chat/<workspace_name>/` | Live agent streaming (token-by-token) |
| Admin | `/admin/` | Django admin |
| Media (DEBUG) | `/media/` | Uploaded files |

```text
Client                          Server
  |  GET  /api/chat/<workspace_name>/  →  load history (lazy-create chat)
  |  WS   /ws/chat/<workspace_name>/   →  stream agent reply token-by-token
  |  DELETE /api/chat/<workspace_name>/ →  clear chat (full reset)
```

**One chat per workspace** — Each workspace has at most one implicit conversation (no create/list-by-UUID). Use the workspace **name** in URLs (`PRAJNA`, etc.) or the alias `default` (see below). The workspace must already exist.

**Starred workspaces (`is_flag=true`)** — Star a workspace via `PATCH /api/workspace/<name>/toggle-flag/`. Starred workspaces are included in bulk APIs (`?flagged=true`) and in `Knowledge.search_graph` during chat (current chat workspace + all starred).

**Default alias** — `GET /api/chat/default/` and `ws://.../ws/chat/default/` resolve to the **first starred workspace** by `created_at` (oldest). `chat.ready` returns the real workspace name. The name `default` cannot be used when creating a workspace.

**Upload without `workspace_name`** — Targets the same first starred workspace; returns `400` if none are starred.

**Authentication** — None on these endpoints (add at the gateway if needed).

---

## Conventions

### Request format

| REST body | `Content-Type: application/json` |
| File upload | `multipart/form-data` |
| WebSocket | JSON text frames (one object per message) |

### Response format

| Success | JSON object or array (documented per endpoint) |
| Error | `{ "error": "<message>" }` with HTTP `400` / `404` |

### Types

| Type | Format |
|------|--------|
| UUID | String, e.g. `"660e8400-e29b-41d4-a716-446655440000"` |
| Timestamp | ISO 8601 UTC when `USE_TZ=True` |
| Document `status` | `PENDING`, `QUEUED`, `INPROGRESS`, `COMPLETED`, `FAILED`, `TERMINATED`, `INVALID` |

---

## Workspace

### `POST /api/workspace/create/`

Create a workspace and its media directory.

**Body**

```json
{ "name": "PRAJNA" }
```

**Response `200`**

```json
{
  "message": "Workspace created successfully",
  "workspace": {
    "name": "PRAJNA",
    "created_at": "2026-05-15T12:00:00.123456Z"
  }
}
```

| Status | Condition |
|--------|-----------|
| `400` | `name` missing |

---

### `GET /api/workspace/list/`

**Response `200`** — array, newest first

```json
[
  {
    "name": "PRAJNA",
    "is_flag": true,
    "created_at": "2026-05-15T12:00:00.123456Z"
  }
]
```

---

### `DELETE /api/workspace/delete/<name>/`

Deletes workspace row and `media/workspaces/<name>/`.

**Response `200`**

```json
{ "message": "Workspace deleted successfully" }
```

| Status | Condition |
|--------|-----------|
| `404` | Unknown workspace |

---

### `GET /api/workspace/<name>/flag-status/`

**Response `200`**

```json
{
  "workspace": "PRAJNA",
  "is_flag": true
}
```

---

### `PATCH /api/workspace/<name>/toggle-flag/`

Flips `is_flag` boolean. No body.

**Response `200`**

```json
{
  "message": "Workspace flag updated successfully",
  "workspace": "PRAJNA",
  "is_flag": false
}
```

---

## Documents

Allowed extensions: **`.txt`**, **`.md`**, **`.text`**.

Upload triggers background preprocessing (KG extraction → Postgres → Qdrant vectors).

### `POST /api/document/upload/`

**Content-Type:** `multipart/form-data`

| Field | Required | Default |
|-------|----------|---------|
| `workspace_name` | no | first starred workspace (`is_flag=true`, oldest `created_at`) |
| `file` | yes | — |

**Response `200`**

```json
{
  "message": "File uploaded successfully",
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "file_name": "notes.md",
  "file_path": "/path/to/media/workspaces/PRAJNA/notes.md",
  "file_url": "/media/workspaces/PRAJNA/notes.md",
  "status": "PENDING"
}
```

| Status | Condition |
|--------|-----------|
| `400` | Missing fields or bad extension |
| `404` | Workspace not found |

---

### `GET /api/document/<workspace_name>/`

**Response `200`**

```json
{
  "workspace": "PRAJNA",
  "total_files": 1,
  "files": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "file_name": "notes.md",
      "file_url": "/media/workspaces/PRAJNA/notes.md",
      "status": "COMPLETED",
      "content": true,
      "uploaded_at": "2026-05-15T12:00:00.123456Z"
    }
  ]
}
```

| Field | Meaning |
|-------|---------|
| `content` | `true` if extracted text is stored |

---

### `DELETE /api/document/delete/<workspace_name>/<file_name>/`

**Response `200`**

```json
{ "message": "Document deleted successfully" }
```

---

## Preprocess

### `POST /api/workspace/preprocess/<workspace_name>/`

Re-queues KG + vector pipeline for every document in the workspace.

**Response `200`**

```json
{
  "message": "Preprocessing queued for workspace 'PRAJNA'"
}
```

---

## Knowledge graph

Source of truth: **Postgres** (`KnowledgeEntity`, `KnowledgeRelation`).  
Semantic search: **Qdrant** (via agent tool `Knowledge.search_graph`).

### `GET /api/knowledge-graph/`

Provide **exactly one** query mode.

| Query | Result |
|-------|--------|
| `?workspace_name=PRAJNA` | Single graph object |
| `?flagged=true` | `{ "graphs": [ ... ] }` for all `is_flag` workspaces |

**Single workspace `200`**

```json
{
  "workspace": "PRAJNA",
  "nodes": [
    {
      "id": "…",
      "name": "Alice",
      "entity_type": "PER",
      "attributes": { "role": "engineer" },
      "document_id": "…",
      "file_name": "notes.md",
      "vector": "COMPLETED",
      "created_at": "2026-05-15T12:00:00Z"
    }
  ],
  "edges": [
    { "source": "Alice", "target": "Acme Corp" }
  ]
}
```

| Node field | Notes |
|------------|-------|
| `edges[].source` / `target` | Entity **names** only (not UUIDs) |
| `vector` | Entity vector index status |

**Flagged bulk `200`**

```json
{
  "graphs": [
    { "workspace": "PRAJNA", "nodes": [], "edges": [] }
  ]
}
```

| Status | Condition |
|--------|-----------|
| `400` | Both or neither query param |
| `404` | Unknown `workspace_name` |

---

## Chat (REST)

One implicit chat per **workspace name**. No conversation UUID in the API.  
REST returns **persisted** user-visible messages (root branch only). **Live streaming** is WebSocket only. Compression branches are server-internal (no branch REST API).

**Agent behavior (WebSocket):**

- Fixed system prompt: answer only from `Knowledge.search_graph` tool output and prior search tool messages in the thread.
- **Single tool:** `Knowledge.search_graph` only (no MCP tools in chat).
- Citations in replies: **`[source: file_name]`** (exact `file_name` from tool output).
- No hallucination: if search has no relevant records, the agent must say so.

| Concern | REST | WebSocket |
|---------|------|-----------|
| History | Root messages via GET | N/A (use GET after turn) |
| Live reply | No | Token-by-token stream |
| Tools | Not in GET response | `tool_calls` / `tool_completed` events |

### `GET /api/chat/<workspace_name>/`

Lazy-creates the workspace chat on first access. Use a real workspace name or `default` (first starred). Unknown workspace / no starred when using `default` → `404`.

**Response `200`**

```json
{
  "workspace": "main",
  "is_flag": true,
  "messages": []
}
```

**Message object**

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "content": "Hello",
  "reasoning_content": null,
  "tool_calls": null,
  "tool_call_id": null,
  "tool_name": null,
  "sequence": 1,
  "created_at": "2026-05-15T12:01:00Z"
}
```

| `role` | Notes |
|--------|-------|
| `system` | System prompt |
| `user` | User message |
| `assistant` | May include `tool_calls`, `reasoning_content` |
| `tool` | Tool result; `tool_call_id`, `tool_name` set |

---

### `DELETE /api/chat/<workspace_name>/`

Full reset: clears messages, compression history, and internal branches; recreates a fresh chat with the system prompt only.

**Response `200`**

```json
{
  "message": "Chat cleared",
  "workspace": "main"
}
```

| Status | Condition |
|--------|-----------|
| `404` | Unknown workspace, or `default` with no starred workspace |

---

### `GET /api/chat/summary/`

Same query rules as knowledge graph: `workspace_name` **or** `flagged=true`.

**Single workspace `200`**

```json
{
  "workspace": "PRAJNA",
  "is_flag": true,
  "updated_at": "2026-05-15T12:30:00Z",
  "message_count": 12
}
```

**Flagged `200`**

```json
{
  "workspaces": [
    {
      "workspace": "PRAJNA",
      "is_flag": true,
      "updated_at": null,
      "message_count": 0
    }
  ]
}
```

---

## Chat (WebSocket)

**URL:** `ws://<host>/ws/chat/<workspace_name>/`

**Requires:** ASGI server (`uvicorn config.asgi:application`) and Redis (Channels layer).

### Typical client flow

1. `GET /api/chat/global/` → load history (creates chat if needed)
2. Connect WebSocket `ws://<host>/ws/chat/global/` → receive `chat.ready`
3. Send `chat.send` → receive streamed events → `chat.done`
4. `GET /api/chat/global/` again → persisted messages updated
5. Optional: `DELETE /api/chat/global/` → clear chat

---

### Client → server

One JSON object per text frame.

#### Ping

```json
{ "type": "ping" }
```

**Response:** `{ "type": "pong" }`

#### Send message

```json
{
  "type": "chat.send",
  "content": "What entities are in the graph?",
  "exclude_servers": ["SomeMcpServer"]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `content` | yes | User message (non-empty after trim) |
| `exclude_servers` | no | Tool servers to omit from this turn |

| Server reply | Condition |
|--------------|-----------|
| `{ "type": "error", "message": "Agent busy" }` | Previous turn still running |
| Stream of events + `chat.done` | Success |

#### Cancel

```json
{ "type": "chat.cancel" }
```

**Response:** `{ "type": "chat.cancelled" }`

---

### Server → client: message categories

Every WebSocket frame is a JSON object. The **`type` field is the event category**.

There are three layers:

| Layer | Purpose | How to identify |
|-------|---------|-----------------|
| **Section wrappers** | UI grouping (open/close blocks) | `type: "section"` |
| **Token stream** | One character/word chunk at a time | `type: "thinking_token"` or `"assistant_response_token"` |
| **Lifecycle / tools** | Whole events (not per-character) | Other `type` values below |

---

### Token-by-token streaming (detailed)

For **assistant text**, the server sends **one WebSocket message per token** (small string chunk). The category is the event `type` — there is no separate `category` field.

#### 1. Thinking tokens (reasoning)

Model reasoning / chain-of-thought. Usually hidden or shown in a collapsible “thinking” panel.

```json
{
  "type": "thinking_token",
  "token": "Let"
}
```

```json
{
  "type": "thinking_token",
  "token": " me check"
}
```

#### 2. Response tokens (user-visible answer)

Normal assistant reply text.

```json
{
  "type": "assistant_response_token",
  "token": "Hello"
}
```

```json
{
  "type": "assistant_response_token",
  "token": "!"
}
```

**Client pattern:** append `token` to the buffer for the current section until the section closes or the type changes.

#### 3. Section wrappers (optional UI hints)

Before/after token blocks, the server may send **section** frames so the client knows which panel to update:

```json
{
  "type": "section",
  "section": "thinking",
  "action": "open"
}
```

```json
{
  "type": "section",
  "section": "thinking",
  "action": "close"
}
```

```json
{
  "type": "section",
  "section": "response",
  "action": "open"
}
```

```json
{
  "type": "section",
  "section": "response",
  "action": "close"
}
```

| `section` | `action` | Meaning |
|-----------|----------|---------|
| `thinking` | `open` / `close` | Reasoning block |
| `response` | `open` / `close` | User-visible answer block |
| `tool_calls` | `open` / `close` | Tool invocation phase |
| `tool_completed` | `open` / `close` | Single tool finished |

Sections are **hints** for layout. Token categorization still comes from `thinking_token` vs `assistant_response_token`.

#### Example transcript (one turn)

```text
→ client:  { "type": "chat.send", "content": "Hi" }

← server:  { "type": "section", "section": "thinking", "action": "open" }
← server:  { "type": "thinking_token", "token": "The" }
← server:  { "type": "thinking_token", "token": " user" }
← server:  { "type": "section", "section": "thinking", "action": "close" }
← server:  { "type": "section", "section": "response", "action": "open" }
← server:  { "type": "assistant_response_token", "token": "Hi" }
← server:  { "type": "assistant_response_token", "token": " there!" }
← server:  { "type": "section", "section": "response", "action": "close" }
← server:  { "type": "chat.done" }
```

#### What is NOT token-by-token

Tools and control events are **single frames** (full payload per event):

| `type` | When | Key fields |
|--------|------|------------|
| `tool_calls` | Agent chose tools | `names`: string[] |
| `tool_call_start` | Tool arg stream begins | `tool_call_id`, `tool_name` |
| `tool_call_delta` | Tool args chunk | `tool_call_id`, `arguments_delta` |
| `tool_call_end` | Tool arg stream ends | `tool_call_id` |
| `assistant_tool_calls_message` | Full tool-call message | `tool_calls`, `content`, `reasoning_content` |
| `tool_completed` | Tool finished | `tool_name`, `tool_call_id`, `ok` |
| `tool_result` | Raw tool result (also forwarded) | `result`, `ok` |
| `agent_turn_start` | Model round started | `turn_index` |
| `model_turn_complete` | Model round ended | `finish_reason` |
| `agent_session_done` | Agent loop finished text turn | — |
| `chat.compressed` | Context compression (server switched branch internally) | — |
| `chat.done` | Entire user turn complete | — |
| `error` | Failure | `message` |

**Example with tools**

```text
← { "type": "section", "section": "tool_calls", "action": "open" }
← { "type": "tool_calls", "names": ["Knowledge.search_graph"] }
← { "type": "section", "section": "tool_calls", "action": "close" }
← { "type": "section", "section": "tool_completed", "action": "open" }
← { "type": "tool_completed", "tool_name": "Knowledge.search_graph", "tool_call_id": "call_1", "ok": true }
← { "type": "section", "section": "tool_completed", "action": "close" }
← … more thinking/response tokens …
← { "type": "chat.done" }
```

---

### Connection lifecycle events

#### `chat.ready` (on connect)

```json
{
  "type": "chat.ready",
  "workspace": "main"
}
```

| Field | Meaning |
|-------|---------|
| `workspace` | Resolved workspace for this chat (real name, not the alias `default`) |

Close codes: `4000` invalid URL; `4004` workspace not found or no starred workspace for `default`.

#### `chat.done` (after each `chat.send` turn)

```json
{ "type": "chat.done" }
```

Persisted messages are then available via REST `GET /api/chat/<workspace_name>/`.

---

### Context compression

When the active thread exceeds **`CHAT_COMPRESS_TOKEN_THRESHOLD`** (default **64000**):

1. Server generates a compression report (not sent to client).
2. Creates an **internal** child branch with a handoff user message (model-only).
3. Switches `active_branch_id` to the new branch.
4. Emits `{ "type": "chat.compressed" }` (no branch IDs exposed).

REST history (`messages` on GET chat) stays on the **root** branch only.

---

### Client implementation checklist

- [ ] Parse each frame as JSON; branch on `type`.
- [ ] For `thinking_token` / `assistant_response_token`, append `token` to the correct UI buffer.
- [ ] Use `section` open/close to swap panels (optional; types alone are enough).
- [ ] Ignore unknown `type` values or log them for forward compatibility.
- [ ] On `chat.done`, refresh history from REST if needed.
- [ ] On `chat.compressed`, optional UI hint that context was summarized (server handles branch switch).
- [ ] Do not send another `chat.send` until `chat.done` or `error` (or cancel).

Event definitions: `nodepoint/agent/schema.py` (`StreamEventType`, `ThinkingTokenEvent`, `AssistantResponseTokenEvent`, …).

---

## Agent tools

Invoked by the agent during WebSocket turns (function calling). Not HTTP endpoints.

Registered when `nodepoint/registry/tools/Knowledge.py` has `active: true` in its module docstring.

### `Knowledge.search_graph`

Semantic search in **Qdrant**, then **resolves each hit ID** to full Postgres entity/relation rows. Returns a **markdown search document** (string), not raw JSON hits.

Workspace scope is **automatic** during chat:

| Scope | Included |
|-------|----------|
| Chat workspace | Current conversation’s workspace |
| Flagged | Every workspace with `is_flag=true` |

The model **must not** pass `workspace`. Prior search hit IDs from the same chat session are merged into later searches.

**Arguments**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `query` | string | required | Natural-language query |
| `limit` | int | `10` | Max Qdrant hits |
| `record_type` | string \| null | `null` | Filter: `entity` or `relation` |

**Return:** markdown string with `## [source: file_name]` sections for citations.

```markdown
# Knowledge search: "who is Alice"

## [source: notes.md]
**Entity** (score 0.8700)
- name: Alice
- type: PER
- attributes: {'role': 'eng'}
- workspace: PRAJNA
```

---

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHAT_COMPRESS_TOKEN_THRESHOLD` | `64000` | Trigger internal branch compression |
| `CHAT_DEFAULT_SYSTEM` | (see settings) | New conversation system prompt |
| `BASE_URL`, `API_KEY` | — | LLM provider for `Agent` |
| `POSTGRES_*`, `MONGO_*`, Redis, Qdrant | — | Data stores (`settings.toml`, `.env`) |

---

## Endpoint index

### REST

| Method | Path |
|--------|------|
| POST | `/api/workspace/create/` |
| GET | `/api/workspace/list/` |
| DELETE | `/api/workspace/delete/<name>/` |
| GET | `/api/workspace/<name>/flag-status/` |
| PATCH | `/api/workspace/<name>/toggle-flag/` |
| POST | `/api/document/upload/` |
| GET | `/api/document/<workspace_name>/` |
| DELETE | `/api/document/delete/<workspace_name>/<file_name>/` |
| POST | `/api/workspace/preprocess/<workspace_name>/` |
| GET | `/api/knowledge-graph/` |
| GET | `/api/chat/<workspace_name>/` |
| DELETE | `/api/chat/<workspace_name>/` |
| GET | `/api/chat/summary/` |

### WebSocket

| Direction | Path / event |
|-----------|----------------|
| Connect | `ws://<host>/ws/chat/<workspace_name>/` |
| Client | `ping`, `chat.send`, `chat.cancel` |
| Server | `chat.ready`, token stream, sections, tools, `chat.compressed`, `chat.done`, `error`, `pong` |
