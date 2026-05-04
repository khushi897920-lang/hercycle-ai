const nextConfig = {
  // ⚠️ Do NOT use output: 'standalone' on Vercel — it breaks serverless routing
  images: {
    unoptimized: true,
  },
  // Silence the Turbopack/webpack conflict warning
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
