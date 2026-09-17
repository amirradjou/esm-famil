# Architecture

One Node process, one browser bundle, one shared package. The server owns all game state;
clients never compute anything — they render the latest `RoomState` snapshot the server pushes.

```
apps/web  ──socket.io──▶  apps/server  ──▶  validation pipeline  ──▶  (optional) LLM judge
   ▲                          │
   └──── room:state ──────────┘        packages/shared: rules, types, normalization
```

## Packages

| Package           | Role                              | Key files                                                                                                     |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/shared` | Rules and types both sides import | `persian.ts` (normalization, letter rule), `scoring.ts`, `categories.ts`, `protocol.ts` (`RoomState`, events) |
| `apps/server`     | Fastify + socket.io game server   | `room.ts` (state machine), `settings.ts`, `rooms.ts`, `socket.ts`, `validation/`                              |
| `apps/web`        | React 19 + Vite + Tailwind, RTL   | `game.tsx` (provider), `screens/`, `components/`                                                              |

## Room state machine

```
          host: round:start                 someone: round:stop
 lobby ───────────────────▶ playing ─────────────────────────▶ stopping
   ▲                          │  round timer                       │ grace timer
   │                          ▼                                    ▼
   │ host: game:restart    validating ◀────────────────────────────┘
   │                          │  pipeline.judge() + scoreRound()
   │                          ▼
   └────────────────────── review ──host: review:next──▶ playing (next round)
                              │                          or finished (last round)
                              ▼
                           finished
```

- `Room` (`apps/server/src/room.ts`) is a plain class with injected `now`, `random` and the
  validation pipeline, so the whole machine is unit-tested with fake timers.
- Every mutation ends in `changed()` → the transport broadcasts `room:state` to the room.
- Errors are `RoomError`s with a code and a Persian message; the transport turns them into acks.
- Players hold a reconnect token; the host role hands over after a 30 s disconnect grace;
  rooms with everyone gone for 15 minutes are swept.

## Fact-checking pipeline

`ValidationPipeline.judge(candidates, useLlm)` in `apps/server/src/validation/index.ts`:

1. **Letter rule** — empty → `empty`; wrong first letter → `invalid/letter` (آ counts as ا).
2. **Word database** — `WordListValidator`: exact match after `normalize()` against
   `validation/data/*.json`; flowers match with or without «گل»; فامیل also accepts words with
   common surname suffixes (`valid/heuristic`).
3. **LLM judge** — only when the room's `settings.llmJudge` is on _and_ the server was started
   with `LLM_PROVIDER`. One call per round with every undecided answer; structured JSON back
   (`ClaudeValidator` via the Anthropic SDK, `OllamaValidator` via `/api/chat` JSON mode).
4. Whatever is left is `unverified`; `settings.unverifiedPolicy` decides whether it scores.

The host can override any cell in the review screen; `rescore()` recomputes the round and
player totals are rebuilt from history.

## Scoring (`packages/shared/src/scoring.ts`)

Per category column, among answers that count (valid, or unverified with policy `accept`):
only one → **20** (or 10 with the solo bonus off); unique → **10**; shared by several → **5**;
everything else → **0**.

## Protocol (`packages/shared/src/protocol.ts`)

Client → server events carry an ack `{ ok, error?, data? }`. Server → client is essentially one
event, `room:state`, plus `room:closed` and `server:error`. `RoomState.server.llm` tells the
client whether the LLM mode can be offered.

## Client

`GameProvider` (`apps/web/src/game.tsx`) owns the socket, the session in `localStorage`
(`storage.ts`), reconnect/rejoin, and exposes `useGame()`. `App.tsx` picks a screen by phase.
Screens are thin; reusable pieces live in `components/`. The look is a squared notebook page
with a red-pen letter stamp and a single highlighter action (`index.css` tokens).
