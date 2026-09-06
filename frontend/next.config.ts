import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

// This machine's current LAN IPv4 address(es) — read live rather than hardcoded, so
// it keeps working across the hotspot fallback in docs/01_STACK.md §3.2 (a new
// network means a new IP) without editing this file again.
function lanIPs(): string[] {
  const ips: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === "IPv4" && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

// The API this machine's web server proxies to. Always its OWN backend, so a
// developer always exercises the code they are editing (docs/08_RUNBOOK.md §1).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Turbopack finds the project root by walking up for a lockfile, and the repo
  // root has one — an empty `package-lock.json` beside the script-runner
  // `package.json` that declares no dependencies. So it picked the repo root and
  // warned about it, which meant module resolution and file watching spanned
  // `backend/`, `infra/` and `.venv` as well. Pinned here rather than deleting
  // that lockfile, because `npm install` at the repo root would silently
  // recreate it and bring the warning back. `__dirname` resolves because
  // frontend/package.json declares no `"type"`, so this file loads as CommonJS.
  turbopack: { root: __dirname },
  // Keep the build honest: a type error must fail the build rather than be silently
  // ignored, so "the build is green" is a trustworthy signal that a merge is safe.
  //
  // NOTE: Next.js 16 removed the `eslint` config key (and `next lint`). Lint is a
  // separate step now — run `npm run lint`. Adding an `eslint` key here is a hard
  // build error, not a warning.
  typescript: { ignoreBuildErrors: false },
  // Everything runs on one machine (docs/08_RUNBOOK.md §1); teammates open this
  // machine's LAN IP directly (http://<host-ip>:3000) to demo/review. Next 16 blocks
  // cross-origin dev requests (HMR) from anywhere not explicitly allow-listed.
  allowedDevOrigins: lanIPs(),
  // Dev-only badge Next renders in a screen corner — bottom-left by default, and
  // still colliding with the sidebar's live status / user / sign-out controls
  // (AppShell moved them out of the topbar) at bottom-right on a narrow/mobile
  // viewport, where the sidebar goes full-width. No corner is safe at every
  // breakpoint, so disabled outright rather than chasing it. Never renders in a
  // production build either way.
  devIndicators: false,
  // The browser only ever talks to the origin it loaded the page from, and this
  // forwards /api/* to that same machine's backend. Three problems disappear at
  // once: no API host is baked into the bundle (so a teammate viewing
  // <host-ip>:3000 reaches the host's API while a developer on localhost:3000
  // reaches their own), requests are same-origin (no CORS, and the session cookie
  // is first-party, which is what breaks across routed subnets), and there is no
  // build-time/runtime URL split to cause a hydration mismatch.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
