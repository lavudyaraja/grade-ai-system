import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  // ── Critical: prevent webpack from bundling these packages ────────────────
  // Without this, pdfjs-dist gets compiled into a webpack chunk, which breaks
  // the relative "./pdf.worker.js" path resolution at runtime and causes:
  // "Setting up fake worker failed: Cannot find module './pdf.worker.js'"
  //
  // With this, Node.js loads them directly from node_modules at runtime where
  // relative paths resolve correctly.
  serverExternalPackages: ['pdfjs-dist', 'canvas', 'pdf-parse'],

  // ── Webpack fallbacks for browser-only APIs used by pdf libs ─────────────
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent trying to bundle Node.js-only modules on the client
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:     false,
        path:   false,
        crypto: false,
        stream: false,
        buffer: false,
        canvas: false,
      };
    }
    return config;
  },

  // ── Turbopack configuration (Next.js 16+) ───────────────────────────────────
  // Minimal config to resolve webpack/turbopack conflict
  // The webpack config above handles the PDF.js module resolution
  turbopack: {},

  // ── Development settings ───────────────────────────────────────────────────
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

