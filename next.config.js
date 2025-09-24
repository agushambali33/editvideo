/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // aktifkan compression untuk response API
  compress: true,

  // matikan telemetry Next.js
  telemetry: false,

  // biar build aman kalau ada modul ESM
  experimental: {
    esmExternals: "loose",
  },

  // biar watermark.png / asset di public bisa langsung dipakai
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;