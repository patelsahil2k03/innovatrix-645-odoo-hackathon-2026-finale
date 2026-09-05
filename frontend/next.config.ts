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

const nextConfig: NextConfig = {
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
};

export default nextConfig;
