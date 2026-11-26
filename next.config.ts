import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src https://maps.google.com https://www.google.com",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "media-src 'self' https:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  isProduction ? "script-src 'self'" : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  isProduction ? "connect-src 'self' https:" : "connect-src 'self' https: ws: wss:",
  isProduction ? "upgrade-insecure-requests" : "",
]
  .filter(Boolean)
  .join("; ");

const enforcedContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src https://maps.google.com https://www.google.com",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "media-src 'self' https:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  // The App Router emits inline bootstrap scripts; allow them while the stricter
  // report-only policy below monitors progress toward a nonce-based policy.
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https: ws: wss:",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // In development, allow embedding in local preview iframes (e.g. WorkBuddy preview panel).
  // Production keeps DENY to prevent clickjacking.
  ...(isProduction
    ? [{ key: "X-Frame-Options", value: "DENY" }]
    : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), geolocation=(self), microphone=(), payment=(), usb=(), clipboard-write=(self)",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Content-Security-Policy", value: enforcedContentSecurityPolicy },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["nodemailer"],
  experimental: {
    // Product images are validated and capped at 5 MB; leave headroom for multipart overhead.
    serverActions: { bodySizeLimit: "6mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
