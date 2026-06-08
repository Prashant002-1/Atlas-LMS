/** @type {import('next').NextConfig} */
const nextConfig = {
  // Emit a standalone server bundle for the Docker image.
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  turbopack: {
    root: import.meta.dirname,
  },
  // pg / pgvector are server-only native deps; keep them out of the bundle.
  serverExternalPackages: ["pg", "pgvector"],
};

export default nextConfig;
