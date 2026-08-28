import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
