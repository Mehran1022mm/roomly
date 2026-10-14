# roomly

A private video meeting room for a small group. One shared room, one shared
password, no accounts. Audio and video travel directly between browsers over
WebRTC; the server only handles sign-in and call setup, then gets out of the way.

## How it works

- **One room.** There are no channels or links to manage. Everyone who knows
the room password joins the same call (2–12 people, mesh topology).
- **Mesh media.** Each browser connects directly to every other browser.
The server relays chat text and connection setup messages over a `/ws`
WebSocket, nothing else.
- **Two passwords.** `ROOM_PASSWORD` lets anyone in. `ADMIN_PASSWORD` also
lets you in, but marks you with a star badge and unlocks moderation
(announce, mute-all, kick) from inside the call.



## Features

- Camera/mic/screen-share controls with per-device pickers and a mic test
- Noise suppression toggle, persisted between visits
- Text chat with day grouping, unread counts, and a character counter
- Priority announcements from admins that show as a banner, chat open or not
- Active-speaker highlighting, participant list, connection status
- English + فارسی with full RTL layout
- Light/dark themes, reduced-motion respected
- `/admin` web panel: live occupancy, participant list, kick, broadcast



## Getting started

Requires Node.js ≥ 22.6.

```bash
npm install
cp .env.example .env
```

Put `ROOM_PASSWORD` and `AUTH_SECRET` in `.env` (`openssl rand -hex 32`
makes a good secret), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a two-person test, open a second browser
profile or a private window. Restart the dev server after touching
`server/`, `shared/`, or `config/`.


| Script              | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Development server with hot reload        |
| `npm run build`     | Production build (app + signaling server) |
| `npm start`         | Runs the production build                 |
| `npm run lint`      | ESLint                                    |
| `npm run typecheck` | Client and server type checks             |
| `npm run test`      | Unit tests                                |




## Configuration

Plain settings live in `config/roomly.config.ts` — ports, capacity, STUN/TURN
hosts, proxy trust, admin toggle. Secrets live only in the environment:


| Variable           | Needed for          | Notes                           |
| ------------------ | ------------------- | ------------------------------- |
| `ROOM_PASSWORD`    | always              | Min 12 characters in production |
| `AUTH_SECRET`      | always              | HMAC key for session tokens     |
| `ADMIN_PASSWORD`   | admin panel / badge | Separate from the room password |
| `TURN_PASSWORD`    | TURN relay          | Passed only to joined members   |
| `DOMAIN`           | deployment          | Public hostname                 |
| `ACME_EMAIL`       | deployment          | TLS contact address             |
| `TURN_EXTERNAL_IP` | TURN relay          | Server's public IP              |


A few useful overrides without editing the config file: `PORT`, `HOST`,
`MAX_USERS`, `STUN_SERVER` (comma-separated fallbacks), `SELF_STUN=1` with
`SELF_STUN_HOST` to prefer your own STUN server, `TURN_SERVER`,
`TURN_USERNAME`, `TRUST_PROXY`.

STUN servers are tried in listed order, so put yours first and keep a public
one after it as fallback. If Google STUN is reachable from your users, the
defaults just work; if it isn't, enable the self-hosted entry.

## Deployment



### Docker (recommended)

```bash
docker compose up -d --build
```

Three containers: the app (web + signaling), Caddy (automatic HTTPS and WSS),
and coturn (self-hosted STUN/TURN). `DOMAIN` must already resolve to the
server. Open `80` and `443` (TCP + UDP), `3478`/`5349` (TCP + UDP), and UDP
`49160–49300` for relayed media.

### Manual

```bash
npm ci --omit=dev
npm run build
npm start
```

Put it behind a reverse proxy that terminates TLS and forwards both HTTP
and the `/ws` WebSocket upgrade. Run your own coturn for relay.

`GET /api/health` returns `{ status, version, uptime }` and backs the Docker
healthcheck. `GET /api/config/public` exposes the client-safe subset
(version, capacity, STUN count, TURN on/off).

## Cloudflare setup

roomly needs a long-lived Node process with WebSocket support, so it can't
run on Cloudflare Pages — host it on a VPS (above) and put Cloudflare in
front of it for DNS, TLS, and firewalling.

1. **DNS.** `A` record for your hostname (e.g. `meet`) pointing at the
  server, proxied (orange cloud). If you run TURN, add a second `A`
   record (e.g. `turn`) pointing at the same IP with proxying **off**
   (grey cloud) — Cloudflare only proxies HTTP(S), and relayed media
   needs raw UDP straight to your server.
2. **TLS.** SSL/TLS mode **Full (strict)**. Caddy mints its own origin
  certificate, so strict mode works with no extra steps. Leave
   Always Use HTTPS on.
3. **WebSockets.** These pass through Cloudflare on every plan. Just make
  sure nothing challenges `/ws`: bypass Bot Fight Mode / managed
   challenges and Browser Integrity Check for `meet.example.com/ws*`,
   and never cache that path.
4. **Firewall.** Optionally rate-limit `POST /api/admin/login` in WAF
  (the app already throttles it to 10/min per IP).
5. **No open ports?** Run `cloudflared tunnel --url http://localhost:3000`
  on the server and point the hostname at the tunnel. Signaling works
   over the tunnel; TURN/UDP media still needs the direct grey-cloud host
   from step 1.



## Security notes

- Room and admin passwords are kept as salted `scrypt` hashes and compared
in constant time. They are never logged or sent to browsers.
- `TURN_PASSWORD` is the exception: TURN authentication needs the real
credential, so it is delivered only to authenticated room members.
- Session tokens are HMAC-signed with a 12-hour expiry; the admin panel
uses a separate `HttpOnly` cookie.
- Join attempts are rate-limited per IP, sockets per IP are capped, and
the WebSocket upgrade checks `Origin`. Standard hardening headers ship
by default (strict CSP, `frame-ancestors 'none'`, HSTS).



## Project layout

```text
config/roomly.config.ts   non-secret settings (ports, ICE, admin toggle)
server/                   signaling server: sockets, rooms, auth, limits
shared/                   client/server contract (protocol, metadata)
src/app/                  pages: lobby (/), call (/room), admin (/admin), API
src/components/           UI kit, lobby, in-call, admin panel
src/lib/                  session, WebRTC/media, signaling client, i18n, store
docker-compose.yml        app + coturn
```


## License

MIT � see [LICENSE](LICENSE).

