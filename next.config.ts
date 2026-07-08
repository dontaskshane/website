import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xjgnclvqhpdhdvqucpcc.supabase.co',
        pathname: '/storage/v1/object/public/photos/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/drini',
        destination: 'https://cuts-test.vercel.app',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
