import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the build honest: a type error must fail the build rather than be silently
  // ignored, so "the build is green" is a trustworthy signal that a merge is safe.
  //
  // NOTE: Next.js 16 removed the `eslint` config key (and `next lint`). Lint is a
  // separate step now — run `npm run lint`. Adding an `eslint` key here is a hard
  // build error, not a warning.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
