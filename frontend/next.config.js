/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: '*.api-sports.io',
      },
    ],
  },
  reactStrictMode: true,
}

module.exports = nextConfig