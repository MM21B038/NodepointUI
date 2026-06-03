# Chat WebSocket API

Backend streaming chat over Django Channels. Requires **ASGI** (`uvicorn config.asgi:application`) and **Redis** for the channel layer. Includes client integration notes for reconnect resume and cancel.

## Quick start (group-scoped chat)

1. Create a group: `POST /api/group/create/` with `{ "name": "research", "tag": "workspace", "description": "..." }` (`tag` optional, default `workspace`)
2. Add workspaces: `POST /api/group/research/workspaces/` with `{ "workspace_name": "..." }`
3. `GET /api/chat/group/research/` — lazy-create group chat thread
4. Connect: `ws://localhost:8000/ws/chat/group/research/`
5. Send `{ "type": "chat.send", "content": "Hello" }`

## Per-workspace chat

`GET /api/chat/<workspace_name>/` and `ws://localhost:8000/ws/chat/<workspace_name>/` — separate thread for that workspace only.

## REST endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/group/<name>/` | Group-scoped chat history |
| DELETE | `/api/chat/group/<name>/` | Clear group-scoped chat |
| GET | `/api/chat/<workspace_name>/` | Named workspace chat |
| DELETE | `/api/chat/<workspace_name>/` | Clear named workspace chat |

## WebSocket protocol

| URL | Scope |
|-----|--------|
| `/ws/chat/group/<name>/` | Group chat (`chat.ready` includes `group`, `tag`, `members`, `member_count`; `workspaces` when tag is `workspace`) |
| `/ws/chat/<workspace_name>/` | Single workspace (`chat.ready` includes `workspace`) |

### Client → server

```json
{ "type": "chat.send", "content": "...", "exclude_servers": ["WikiServer"] }
{ "type": "chat.reconnect" }   // after mid-turn disconnect; server replies with chat.reconnected
{ "type": "chat.cancel" }      // stop agent and persist partial reply (see below)
{ "type": "chat.status" }      // query agent_busy / turn_id (sent after reconnect when agent_busy)
{ "type": "ping" }
```

### Server → client

- `chat.ready` — on connect (`conversation_id`, `active_branch_id`, **`agent_busy`** always `true` or `false`; when `true`, live stream auto-attaches; optional `turn_id`, `turn_started_at`, `reconnect_hint`)
- `chat.turn_started` — turn accepted (`turn_id`)
- `chat.reconnected` — reply to `chat.reconnect` (`agent_busy`, optional `turn_id`, `hint`)
- `chat.status` — reply to `chat.status` (`agent_busy`, `turn_id`, `turn_started_at`)
- `chat.branch_updated` — active branch changed after compression
- Agent stream events — see `nodepoint/agent/schema.py` (via channel-layer fan-out)
- `chat.compress_started` — compression LLM call began (`message`)
- `chat.compress_completed` — summary ready (`message`, `summary_chars`)
- `chat.compressed` — internal context compression succeeded (new branch)
- `chat.compress_failed` — compression failed; turn continues on same branch (non-fatal)
- `chat.done` — turn finished (`turn_id`, optional `active_branch_id`)
- `chat.interrupted` — partial assistant text was saved (cancel or error mid-stream). Includes optional **`saved`** object: `{ "message_id", "content", "reasoning_content"? }`
- `chat.cancelled` — turn stopped by `chat.cancel` (channel fan-out). Includes optional **`saved`** with the same shape when partial text was persisted. If no turn was active, sent directly with `{ "message": "..." }`.

### Stop streaming (`chat.cancel`)

To stop generation and **save partial text received so far**, send `{ "type": "chat.cancel" }`. Do **not** rely on closing the WebSocket alone — a disconnect mid-turn does **not** cancel the agent or persist partial output.

Event order on successful cancel:

1. `chat.interrupted` with optional `saved` (partial assistant message persisted to Postgres)
2. `chat.cancelled` with the same `saved` block and `turn_id`

`saved` shape:

```json
{
  "message_id": "uuid",
  "content": "partial assistant text…",
  "reasoning_content": "optional thinking…"
}
```

**Client handling:**

- Show a Stop control that sends `chat.cancel` while `agent_busy` is true.
- On `chat.interrupted` / `chat.cancelled`, merge `saved.content` (and reasoning if shown) into the in-flight assistant turn immediately.
- Call REST once (`GET /api/chat/...`) to reconcile `message_id`, ordering, and any blocks the stream reducer missed.
- Clear streaming UI state (`isStreaming`, `agent_busy`) only after these events — not on socket close.

If no turn was active, the server may reply with `chat.cancelled` and `{ "message": "..." }` only.

### Disconnect and reconnect (resume live stream)

If the WebSocket drops **during** a turn:

| What happens | Detail |
|--------------|--------|
| Agent | Keeps running (not cancelled) |
| Partial text on server | **Not** persisted until `chat.done`, an error, or `chat.cancel` |
| Live tokens | Broadcast on `chat_{conversation_id}` — **no token replay**; reconnecting clients receive only **new** events from that point forward |
| Turn metadata | Stored in Redis (`nodepoint:chat:turn:{conversation_id}`) so `agent_busy` is consistent across workers |

#### Reconnect handshake

After the socket is back:

1. Receive `chat.ready` (always includes `agent_busy`, `turn_id`, `turn_started_at` when a turn is active).
2. If you dropped mid-stream, send `{ "type": "chat.reconnect" }` once (Prajna UI sends this automatically after `chat.ready` when a reconnect was pending).
3. Receive `chat.reconnected` with `agent_busy`, `turn_id`, optional `hint`.
4. If `agent_busy: true`, send `{ "type": "chat.status" }` to confirm turn state, then subscribe to live agent events as usual.
5. If `agent_busy: false`, the turn finished while you were offline — load history from REST only.

`chat.ready` / `chat.reconnected` with `agent_busy: true` mean you are already on the conversation channel group; live tokens flow immediately after the handshake.

#### How to keep the stream where it left off (client pattern)

Because there is **no token replay**, the UI must **retain what it already rendered** and merge three sources:

| Source | Role |
|--------|------|
| **In-memory UI blocks** | Text/tools/thinking already shown before disconnect — **do not discard** on `onclose` |
| **WebSocket client buffer** | Blocks accumulated in the WS layer during the same tab session (`applyStreamEvent`) |
| **REST history** | Gap-fill for messages persisted while offline (usually empty mid-turn unless cancel/done happened) |

**Resume algorithm (Prajna UI):**

1. **On disconnect during a turn** — keep the assistant turn and its blocks in React/state; enter a reconnecting state; reopen the WebSocket with exponential backoff (cap 12 attempts).
2. **On `chat.ready` / `chat.reconnected` with `agent_busy: true` (live attach)** —
   - Set streaming/busy flags back on.
   - **Hydrate:** `merged = pickRicherBlocks(uiBlocks, wsClientBlocks)` — keep whichever snapshot has more content (tokens, tool steps, thinking segments).
   - Flush merged blocks to the UI immediately (do not wait for REST).
   - Debounce (~280 ms) a REST `GET /api/chat/...` and merge with `mergeReconnectChatTurns(history, prevTurns, liveBlocks)` so persisted gap-fill never overwrites richer in-memory stream state.
3. **On each new live event** — append via the stream reducer as normal; UI catches up from the disconnect point forward.
4. **On `chat.done`** — finalize blocks, clear busy/streaming, REST refresh with full replace.
5. **If reconnect exhausts retries** — show *"Could not reconnect — refresh the page"*; the agent may still be running server-side. A full page load via REST shows the completed reply.

`pickRicherBlocks` scores block trees by content length (response text, thinking, tool activity) and picks the richest candidate so a sparse REST snapshot cannot wipe a partial live stream.

#### Reconnect vs cancel vs refresh

| Action | Agent | Partial UI | Persisted history |
|--------|-------|------------|-------------------|
| WS disconnect | Continues | Keep in memory; reconnect + merge | Unchanged until turn ends |
| `chat.cancel` | Stops | Merge `saved` from WS events | Partial message saved |
| Page refresh | Continues | Lost in-memory state | REST shows completed turn; mid-turn may look incomplete until done |
| `chat.send` while busy | Rejected | — | Wait until `agent_busy: false` |

#### Keepalive and client limits (Prajna UI)

| Constant | Value | Purpose |
|----------|-------|---------|
| Ping interval | 25 s | `{ "type": "ping" }` / `pong` during long tool or LLM runs |
| Connection wait | 15 s | Fail `chat.send` if `chat.ready` never arrives |
| Reconnect attempts | 12 | Exponential backoff 1 s → 20 s cap; then prompt refresh |
| Turn timeout | none | Client does not abort long turns locally |

Use `ping` / `pong` on the client side as well; backend `AGENT_REQUEST_TIMEOUT` defaults to 300 s for LLM HTTP reads.

**Multi-worker:** Active turn metadata is stored in **Redis** (`nodepoint:chat:turn:{conversation_id}`), so `agent_busy` is consistent across uvicorn workers (`WEB_WORKERS>1`). `chat.cancel` reaches the owning worker via Redis pub/sub and waits until the turn is inactive before the cancel request completes on the requesting worker (`CHAT_CANCEL_WAIT_TIMEOUT`, default 10 s).

Multiple tabs on the same chat each receive the same live stream; each tab must run the same merge logic if it reconnects independently.

## Search scope

| Chat mode | `Knowledge.search_graph` searches |
|-----------|----------------------------------|
| Group (`/ws/chat/group/<name>/`) | Scoped by group `tag`: workspaces, files, entities, or relations in that group |
| Per-workspace | That workspace only |

If a group has no members, the tool returns a message that the group is empty.

## Concurrency

- Each WebSocket connection runs **one agent task** at a time (`Agent busy` if a second `chat.send` arrives during a turn). Turn active-state is in Redis, not process memory.
- Different users/workspaces run **in parallel** on the same `web` service (async event loop + httpx LLM streaming).
- Knowledge tools share a per-worker slot limit: `CHAT_MAX_CONCURRENT_SEARCHES` (default `8`).
- Scale horizontally: set `WEB_WORKERS` (default `4`) on the `web` container, or `docker compose up --scale web=2`.
- Document preprocess/embed jobs stay on the separate `worker` RQ service (not used for live chat).

## Environment

- `CHAT_COMPRESS_TOKEN_THRESHOLD` — default `80000`
- `CHAT_COMPRESS_MAX_TOOL_CHARS` — max chars per tool message in compression request (default `4000`)
- `CHAT_COMPRESS_MAX_ASSISTANT_CHARS` — max chars per assistant message (default `8000`)
- `CHAT_COMPRESS_MAX_MESSAGES` — max messages sent to compression (default `30`)
- `CHAT_COMPRESS_MAX_OUTPUT_TOKENS` — max tokens in the handoff report (default `4000`)
- `CHAT_COMPRESS_TEMPERATURE` — compression LLM temperature (default `0.2`)
- `CHAT_COMPRESS_OMIT_REASONING` — default `true` (omit `reasoning` field for vLLM-compatible gateways)
- `CHAT_COMPRESS_MODEL` — optional model override for summaries
- `LOG_LEVEL` — Django/app log level (default `INFO`)
- `CHAT_DEFAULT_SYSTEM` — system prompt for new chats
- `CHAT_MAX_CONCURRENT_SEARCHES` — default `8`
- `WEB_WORKERS` — uvicorn worker processes (default `4`; safe with Redis turn registry)
- `CHAT_TURN_REDIS_TTL` — seconds to retain active-turn metadata if a worker crashes (default `3600`)
- `CHAT_CANCEL_WAIT_TIMEOUT` — seconds to wait for remote turn cancel to finish (default `10`)
- `DB_CONN_MAX_AGE` — Postgres connection reuse per worker (default `60`)
- `AGENT_REQUEST_TIMEOUT` — LLM HTTP read timeout seconds (default `300`)
- `BASE_URL`, `API_KEY` — required for `Agent`
