import { withWorkflow } from "workflow/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a standalone server bundle for the Docker image.
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  turbopack: {
    root: import.meta.dirname,
  },
  experimental: {
    // Course material actions enforce a 25 MB file limit. Leave room for
    // multipart boundaries while keeping both framework buffers bounded.
    serverActions: {
      bodySizeLimit: "26mb",
    },
    proxyClientMaxBodySize: "26mb",
  },
  // The professor harness loads its reviewed, non-executable authoring files at runtime.
  outputFileTracingIncludes: {
    "/api/atlas/planning": ["./.atlas/**/*"],
  },
  // pg / pgvector are server-only native deps; keep them out of the bundle.
  serverExternalPackages: ["pg", "pgvector"],
};

export default withWorkflow(nextConfig);
