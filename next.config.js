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

  ...(process.env.NEXT_PUBLIC_MOCK_AUTH === 'true' ? {
    turbopack: {
      resolveAlias: {
        '@clerk/nextjs/server': './lib/clerk-server-mock.js',
        '@clerk/nextjs': './lib/clerk-mock.js',
        '@supabase/supabase-js': './lib/supabase-mock.js'
      }
    }
  } : {}),

  webpack: (config) => {
    if (process.env.NEXT_PUBLIC_MOCK_AUTH === 'true') {
      const path = require('path');
      config.resolve.alias['@clerk/nextjs/server'] = path.resolve(__dirname, 'lib/clerk-server-mock.js');
      config.resolve.alias['@clerk/nextjs'] = path.resolve(__dirname, 'lib/clerk-mock.js');
      config.resolve.alias['@supabase/supabase-js'] = path.resolve(__dirname, 'lib/supabase-mock.js');
    }
    return config;
  },


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

  // Security & cache headers.
  //
  // The policy itself lives in lib/security-headers.mjs so that it can be read
  // as a whole and tested (scripts/test-security-headers.js). It used to be
  // written out as literals here, which is how the CSP came to consist of a
  // single `frame-ancestors` directive — duplicating the X-Frame-Options above
  // it and leaving script execution, script origins, <base> and form targets
  // completely unrestricted, because an absent CSP directive means
  // unrestricted rather than denied.
  //
  // The CORS block that used to be here is gone: it applied
  // `Access-Control-Allow-Origin: <NEXT_PUBLIC_APP_URL or empty string>` to
  // every response in the app, with no `Vary: Origin`. CORS is a per-request
  // decision, so it now lives in middleware.js where the request's Origin can
  // actually be inspected.
  //
  // `headers()` is async, so the ESM policy module is loaded with a dynamic
  // import — this file is CommonJS and cannot `require` it. The module carries
  // an .mjs extension so Node reads it as ESM without having to parse it as
  // CommonJS first and warn about the reparse on every build.
  async headers() {
    const {
      SENSITIVE_API_PREFIXES,
      NO_STORE,
      buildContentSecurityPolicy,
      cspHeaderName,
      isReportOnly,
      staticSecurityHeaders,
    } = await import('./lib/security-headers.mjs')

    const isDev = process.env.NODE_ENV !== 'production'

    const commonHeaders = [
      ...staticSecurityHeaders({ isDev }),
      {
        key: cspHeaderName(isReportOnly(process.env.CSP_REPORT_ONLY)),
        value: buildContentSecurityPolicy({
          isDev,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        }),
      },
    ]

    return [
      { source: '/(.*)', headers: commonHeaders },

      { source: '/api/:path*', headers: [{ key: 'Vary', value: 'Accept-Encoding' }] },

      // Personal health data must not be written to the browser's disk cache.
      //
      // These paths previously carried `private, max-age=60` (and 300 for the
      // risk assessment). `private` only means "not a shared proxy" — it
      // explicitly permits the browser to store the response, and signing out
      // does not clear the HTTP cache. On a shared machine the next person
      // could read the previous user's cycle history straight out of it,
      // which also walks straight around the app's E2EE layer.
      //
      // Two entries per prefix because a Next.js `source` pattern matches
      // either the bare path or the sub-paths, not both.
      ...SENSITIVE_API_PREFIXES.flatMap((prefix) => [
        { source: prefix, headers: [{ key: 'Cache-Control', value: NO_STORE }] },
        { source: `${prefix}/:path*`, headers: [{ key: 'Cache-Control', value: NO_STORE }] },
      ]),
    ]
  },
}

module.exports = withNextIntl(nextConfig);
