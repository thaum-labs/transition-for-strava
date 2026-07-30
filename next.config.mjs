/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "img-src 'self' data: blob:",
              "style-src 'self' 'unsafe-inline'",
              // OAuth callback uses a tiny inline redirect script; keep unsafe-inline until that is removed.
              "script-src 'self' 'unsafe-inline'",
              "connect-src 'self'",
              "form-action 'self' https://www.strava.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
