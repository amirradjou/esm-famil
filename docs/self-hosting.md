# Self-hosting: your own computer as the game server

The web client is static and lives on Netlify; the game server (WebSockets, rooms in memory,
optionally a local Ollama judge) runs on your machine and is reachable through
[Tailscale Funnel](https://tailscale.com/kb/1223/funnel). Nothing is port-forwarded on the router.

```
players ──▶ https://esm.amirradjou.com (Netlify, static client)
               │ WebSocket
               └──▶ https://framework.tail420820.ts.net (Funnel) ──▶ localhost:3000 (this machine)
```

## One-time setup on the server machine

1. Tailscale: `sudo tailscale up`, then `sudo tailscale set --operator=$USER` so the scripts can
   manage the funnel without sudo. Enable Funnel for the tailnet when the first `tailscale funnel`
   command prints its approval link.
2. `.env` in the repo root (never committed):
   ```
   PORT=3000
   HOST=127.0.0.1
   CORS_ORIGIN=https://esm.amirradjou.com,https://esm-famil-game.netlify.app,http://localhost:5173
   LLM_PROVIDER=ollama
   OLLAMA_MODEL=qwen2.5:7b
   ```
3. Run the server as a systemd _user_ service (starts at login, restarts on failure, no root):
   ```sh
   pnpm build
   mkdir -p ~/.config/systemd/user && cp deploy/esm-famil.service ~/.config/systemd/user/
   systemctl --user daemon-reload && systemctl --user enable --now esm-famil
   ```
4. Publish it: `scripts/serve-local.sh` — rebuilds, restarts the service, runs
   `tailscale funnel --bg 3000` (persists across reboots) and prints the public URL.

Day to day: the laptop just has to be on and logged in. `journalctl --user -u esm-famil -f`
shows the log; `tailscale funnel status` shows the tunnel; `systemctl --user restart esm-famil`
after `pnpm build` picks up a new server version. To stop sharing: `tailscale funnel --https=443 off`.

## The client on Netlify

- Site `esm-famil-game`, custom domain `esm.amirradjou.com` (Netlify DNS record created automatically).
- `.github/workflows/deploy-web.yml` builds `apps/web` with `VITE_SERVER_URL` (a repository
  _variable_) and publishes with `netlify deploy --no-build --prod` on every push to `main` that
  touches the client. Secrets: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`.
- If the server URL ever changes (new machine name, different tunnel), change the
  `VITE_SERVER_URL` variable and re-run the workflow; the server's `CORS_ORIGIN` must list the
  client origin.
- Manual deploy from a machine with the Netlify CLI logged in:
  ```sh
  VITE_SERVER_URL=https://framework.tail420820.ts.net pnpm --filter @esm-famil/web build
  NETLIFY_SITE_ID=<id> netlify deploy --no-build --filter @esm-famil/web --prod --dir apps/web/dist
  ```
  `--no-build` matters: the CLI otherwise re-runs the `netlify.toml` build without the variable.

## Things worth knowing

- Rooms live in memory: a server restart, sleep or tunnel drop ends games in progress.
- The first request after the funnel starts can take ~15 s while Tailscale issues the TLS certificate.
- Testing from the server machine itself: Chrome resolves the `ts.net` name to the private tailnet
  address and blocks the public page from reaching it (local-network-access rule). Test from
  another device, or launch Chromium with
  `--host-resolver-rules="MAP framework.tail420820.ts.net <public funnel IP>"`
  (public IPs: `dig +short @1.1.1.1 framework.tail420820.ts.net`).
- Small local models (3B) are erratic referees; `qwen2.5:7b` or `LLM_PROVIDER=claude` judge far
  better. The host can always flip a verdict in the review screen.
- This exposes one HTTP port of your machine to the internet with no rate limiting; share the
  room code with people you know.
