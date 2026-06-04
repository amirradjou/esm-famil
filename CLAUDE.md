# esm-famil

Online multiplayer اسم فامیل (the Persian pen-and-paper "Scattergories"): one player hosts a room,
friends join with a 4-letter code, everyone fills the table for a random letter, first to finish
calls «استپ», and the server fact-checks and scores the answers.

## Stack

- Language/runtime: TypeScript (strict) on Node 22; pnpm workspace with three packages
- Package manager: pnpm
- Tests: `pnpm test` (vitest in `packages/shared` and `apps/server`)
- Lint/format: `pnpm lint` (prettier --check + tsc --noEmit in every package); `pnpm format`

## Commands

| Task                                                  | Command                     |
| ----------------------------------------------------- | --------------------------- |
| Install deps                                          | `pnpm install`              |
| Run (dev: Vite on :5173 proxying to the API on :3000) | `pnpm dev`                  |
| Build everything                                      | `pnpm build`                |
| Run production build (serves the web app too)         | `pnpm start`                |
| Test                                                  | `pnpm test`                 |
| Lint + typecheck                                      | `pnpm lint`                 |
| Docker                                                | `docker compose up --build` |

## Layout

- `packages/shared/` — code both sides import: Persian normalization (`persian.ts`), categories,
  scoring rules (`scoring.ts`), and the socket protocol / `RoomState` types (`protocol.ts`).
- `apps/server/` — Fastify + socket.io. `room.ts` is the whole game state machine (pure, tested with
  fake timers); `socket.ts` only maps events to room methods; `validation/` is the fact-checker:
  letter rule → bundled word database (`validation/data/*.json`) → surname heuristic → LLM judge
  (`claude.ts` via the Anthropic SDK, or `ollama.ts` for local dev) → `unverified`. The LLM tier
  exists only when the server has `LLM_PROVIDER` set, and runs only for rooms whose host chose
  `settings.llmJudge`; the snapshot's `server.llm` tells clients whether it can be offered.
- `apps/web/` — React 19 + Vite + Tailwind v4, RTL Persian UI. `game.tsx` holds the socket
  session and exposes `useGame()`; `screens/` are one component per game phase.
- `scripts/screenshots.mjs` — headless two-player playthrough that regenerates `docs/screenshots/`
  (run against a live server; use an Ollama/Claude judge so the review shows LLM verdicts).

## Conventions

- See global preferences in `~/.claude/CLAUDE.md` (conventional commits, feature branches, etc.).
- Run tests and lint before declaring work done.
- The server is the only source of truth: clients never compute game state, they render the
  latest `room:state` snapshot. Add new behaviour as a `Room` method + test first, then wire it.
- Compare Persian text only through `normalize()` from `@esm-famil/shared`.

## Gotchas / decisions

- Monorepo instead of the single-package node scaffold because client and server share types.
- TypeScript is pinned to 5.x (7.x is the native rewrite; not yet verified with vite/tsx here).
- pnpm 12: install scripts are opt-in (`allowBuilds` in `pnpm-workspace.yaml`); very fresh
  npm releases are refused by default and need a `minimumReleaseAgeExclude` entry.
- Word lists are imported as JSON modules (`validation/data/index.ts`) so `tsc` copies them to
  `dist`; a `readFileSync` of the data dir breaks in the built server.
- `@fastify/static` must use the default wildcard route; `wildcard: false` snapshots the file list
  at startup and a rebuilt bundle hash 404s.
- A player can have several tabs open; `socket.ts` counts sockets per player and only tells the
  room about a disconnect when the last one closes (otherwise the host role silently moves).
- Without an `LLM_PROVIDER`, unknown answers stay `unverified` (policy `accept` by default); the
  host can still override any cell in the review screen.
- Screen components must call every hook before the `if (!state || !me) return null` guard —
  the create path renders the lobby once before the session is known, and a hook after the guard
  trips React error #310.
- `GameSettingsForm` keeps a local copy of the settings and only re-syncs from the snapshot when
  no patch is in flight (counted via the ack); otherwise fast clicks lose updates.
- The word database test forbids duplicates (after `normalize()`) and non-Persian entries; keep
  entries to real members of the category — leniency is the LLM judge's and the host's job.
