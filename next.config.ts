import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Onboardees upload scanned/completed documents (e.g. multi-page I-9 PDFs)
    // through server actions; the 1 MB default is too small for those.
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;
