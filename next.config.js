/** @type {import('next').NextConfig} */

const nextConfig = {
  // Performance & Build
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,

  // TypeScript & Linting
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: './tsconfig.json',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Images Optimization
  images: {
    domains: [
      'avatars.nexustrade.com',
      'api.nexustrade.com',
      'localhost',
      'cdn.nexustrade.com',
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.nexustrade.com',
      },
    ],
  },

  // Security Headers
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-Frame-Options',
          value: 'SAMEORIGIN',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
        {
          key: 'Referrer-Policy',
          value: 'strict-origin-when-cross-origin',
        },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=()',
        },
      ],
    },
  ],

  // Redirects for backward compatibility
  redirects: async () => [
    {
      source: '/supervisor/:path*',
      destination: '/:path*',
      permanent: true,
    },
  ],

  // Output configuration - use standalone for Vercel
  output: 'standalone',

  // Experimental Optimizations
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-alert-dialog',
    ],
    esmExternals: true,
  },

  // Environment & Deployment
  env: {
    NEXT_PUBLIC_ENV: process.env.NODE_ENV,
  },

  // Module Aliases
  webpack: (config, { isServer }) => {
    config.externals.push('bcrypt');
    return config;
  },

  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

module.exports = nextConfig;
