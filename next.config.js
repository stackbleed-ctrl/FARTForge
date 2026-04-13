/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

const nextConfig = {
  reactStrictMode: true,
  // Allow images from Arweave (for NFT receipt artwork)
  images: {
    domains: ['arweave.net', 'gateway.irys.xyz'],
  },
  // Needed for Three.js
  transpilePackages: ['three'],
  webpack: (config) => {
    config.externals = config.externals || []
    return config
  },
}

module.exports = withPWA(nextConfig)
