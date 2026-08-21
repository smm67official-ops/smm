import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // Product images uploaded to Supabase Storage are served from the project domain.
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
};

export default nextConfig;
