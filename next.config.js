/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    try {
      config.experiments = config.experiments || {};
      config.experiments.asyncWebAssembly = true;
    } catch (e) {}
    return config;
  },
};

module.exports = nextConfig;
