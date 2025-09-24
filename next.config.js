/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  compress: true,

  experimental: {
    esmExternals: "loose",
  },

  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;