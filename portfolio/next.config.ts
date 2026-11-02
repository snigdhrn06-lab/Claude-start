import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // This app lives in a subfolder of a repo that has other apps; trace files from here only.
  outputFileTracingRoot: path.join(__dirname),
  // sharp and pg are native/server-only; keep them out of the bundler.
  serverExternalPackages: ["sharp", "pg"],
  experimental: {
    // Media uploads go through route handlers (not server actions), but keep this bounded anyway.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
