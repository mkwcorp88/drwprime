import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Lint is enforced in the editor/CI, not in the production build. With CI
  // frozen and deploys building on push, a stray `any`/`prefer-const` (style
  // rules, not correctness) must not break a prod deploy.
  eslint: { ignoreDuringBuilds: true },
  // Keep sharp (Payload's image processor) as an external server package.
  serverExternalPackages: ['sharp'],
  // sharp loads its @img/* platform packages via dynamic require, so Next's file
  // tracer misses the native libvips .so. Force-include the Linux binaries so the
  // Payload admin/API functions can load sharp on Vercel.
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },
  images: {
    qualities: [75, 90, 100],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.drwskincare.com',
      },
    ],
  },
  // /prime-insight was a duplicate of /blog (identical content) — consolidate to /blog for SEO.
  async redirects() {
    return [
      { source: '/prime-insight', destination: '/blog', permanent: true },
      { source: '/prime-insight/:slug', destination: '/blog/:slug', permanent: true },
      // Retire the old textarea blog editor — Payload (/cms) is the CMS now.
      { source: '/front-office/blog', destination: '/cms', permanent: false },
      { source: '/front-office/blog/:path*', destination: '/cms', permanent: false },
    ];
  },
  // Ensure static files are properly served
  async headers() {
    return [
      {
        source: '/drwprime_section_1.mp4',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Apply CORS headers to API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,DELETE,PATCH,POST,PUT,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
