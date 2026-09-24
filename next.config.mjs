/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: false,
  output: 'standalone',
  outputFileTracingRoot: new URL('./', import.meta.url).pathname,
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {})
};

export default nextConfig;
