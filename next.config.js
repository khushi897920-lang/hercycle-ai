const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n.js');

const nextConfig = {
  // Performance
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // Image optimization (enable Next.js built-in optimizer)
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // turbopack: {
  //   root: __dirname,
  //   resolveAlias: {
  //     '@clerk/nextjs/server': './lib/clerk-server-mock.js',
  //     '@clerk/nextjs': './lib/clerk-mock.js'
  //   }
  // },

  // webpack: (config) => {
  //   const path = require('path');
  //   config.resolve.alias['@clerk/nextjs/server'] = path.resolve(__dirname, 'lib/clerk-server-mock.js');
  //   config.resolve.alias['@clerk/nextjs'] = path.resolve(__dirname, 'lib/clerk-mock.js');
  //   return config;
  // },


  // Optimize heavy packages — tree-shake on import
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-accordion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },

  // Security & CORS headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          { key: 'Content-Security-Policy', value: 'frame-ancestors *;' },
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ORIGINS || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: '*' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Cache static API responses (cycle data, PCOD risk) for 60s
      {
        source: '/api/cycles',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=60, stale-while-revalidate=30' },
        ],
      },
      {
        source: '/api/pcod-risk',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=300, stale-while-revalidate=60' },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig);
