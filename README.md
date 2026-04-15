# esm-famil · اسم فامیل

Online multiplayer version of the Persian pen-and-paper word game اسم فامیل (the Iranian
Scattergories). One player creates a room, friends join with a 4-letter code or an invite link,
a random letter is drawn, everyone fills in a word per category, and the first to finish shouts
«استپ». The server fact-checks every answer and scores the round.

## Rules implemented

- Categories: اسم، فامیل، شهر، کشور، رنگ، غذا، میوه، حیوان، اشیا، گل (+ شغل، ماشین). The host picks
  which ones to play and which letters go in the pool (rare letters like ث ذ ژ ض ظ غ are off by default).
- A round ends when someone calls استپ (others get a short grace period) or when the round timer runs out.
- Scoring per cell: valid answer nobody else wrote **10**, valid answer someone else also wrote **5**,
  the only valid answer in the column **20** (optional), empty / invalid **0**.
- Fact-checking runs in tiers: the answer must start with the letter → bundled Persian word lists →
  a surname heuristic for فامیل → an LLM referee for everything else (Claude via the Anthropic API,
  or a local Ollama model). Undecided answers are flagged, and the host can flip any verdict in the
  review screen.

## Getting started

```sh
pnpm install
cp .env.example .env      # optional: pick a fact-checker (VALIDATOR=claude needs ANTHROPIC_API_KEY)
pnpm dev                  # web on http://localhost:5173, API on :3000
```

Production build (one Node process serves both the API and the web app):

```sh
pnpm build && pnpm start   # http://localhost:3000
# or
docker compose up --build
```

## Development

```sh
pnpm test      # unit tests (shared rules, room state machine, validators)
pnpm lint      # prettier --check + typecheck
pnpm format
```

Layout: `packages/shared` (rules, protocol types), `apps/server` (Fastify + socket.io game server),
`apps/web` (React + Vite + Tailwind, RTL). See `CLAUDE.md` for the design notes.
