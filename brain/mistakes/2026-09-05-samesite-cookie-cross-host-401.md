### What happened
`curl http://192.168.10.249:8000/api/v1/auth/me` (and the browser frontend calling the
same shared LAN backend) returns `401 UNAUTHORIZED — "Sign in to continue."` even right
after a successful login — no `Authorization` header, no cookie arrives at the backend.

### Why
The login cookie is set with `samesite="lax"` (`backend/src/app/routers/auth.py:56`).
Whenever the frontend is opened as `http://localhost:3000` while `NEXT_PUBLIC_API_URL`
points at a different host (`http://192.168.10.249:8000`, the shared team backend), every
API call is **cross-site** — different host. `SameSite=Lax` cookies are withheld by the
browser on cross-site `fetch`/XHR requests (Lax only allows the cookie on top-level GET
navigations), so `access_token` never reaches the backend. `extract_token()`
(`backend/src/app/core/security.py:63-74`) then falls through to the `Authorization`
header, finds nothing, and the request is unauthenticated. CORS is a red herring here —
`allow_origin_regex` + `allow_credentials=True` already permit the cross-origin call, so
there's no CORS error in the console; the failure is silent 401s.

### Fix
No code change — this is already the project's documented convention, just not what the
failing curl/browser session followed. Open the frontend via the **same host IP** the
backend is on — `http://192.168.10.249:3000`, not `http://localhost:3000` — when working
against the shared LAN database/backend (`docs/08_RUNBOOK.md` §2). `frontend/next.config.ts`
already says this in its own comment ("teammates open this machine's LAN IP directly").
Same IP + different port is same-site for cookie purposes, so the cookie is sent normally.
`localhost:3000` only works when the backend is also `localhost:8000` (pure solo local dev)
— never mix a `localhost` frontend with a non-`localhost` backend host.

Considered and explicitly rejected for this project: proxying `/api/*` through Next.js so
the browser always calls its own origin (removes the host-matching requirement entirely,
but is a real architecture change touching `next.config.ts` + `src/lib/api.ts`) — decided
not worth it for a single-host-per-instance hackathon setup.

### Follow-up — frontend genuinely local, backend genuinely remote
The "open the frontend at the backend's IP" fix above only works when you can choose which
host serves the frontend. When the frontend dev server must run on your own machine
(`localhost:3000`) while the backend lives on a teammate's machine, there is no shared host
to open — three real options, no code change required for any of them except the last:
1. **SSH port-forward** (what we used): `ssh -L 8000:localhost:8000 <user>@<backend-host> -N`
   in its own terminal, then set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`. Your
   own machine's `localhost:8000` now transparently reaches the remote backend, so the
   browser sees frontend and API as the same site. Needs SSH access to that machine.
2. `socat TCP-LISTEN:8000,fork,reuseaddr TCP:<backend-host>:8000 &` — same effect, no SSH
   login needed, but requires installing `socat` (not present on this machine by default).
3. A Next.js rewrite proxy in `next.config.ts` (`/api/v1/:path*` → the remote backend) plus
   switching `src/lib/api.ts`'s `API_BASE` to a relative path — works with zero local
   tunnel/process running, but is a real change to the frontend's fetch layer, not just
   config. Deliberately not done for this hackathon's scope.

### Prevention (what now makes this structurally impossible, not just "we'll remember")
Not structurally impossible — still a "know the convention" discipline, now written down
in two places (`next.config.ts`'s existing comment + this file). Anyone hitting a silent
401 against a shared backend should check the browser's address bar host against
`NEXT_PUBLIC_API_URL`'s host before suspecting the backend or CORS.
