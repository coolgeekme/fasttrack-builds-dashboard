/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://76.13.107.20:8100/:path*' },
    ]
  },
}

module.exports = nextConfig
