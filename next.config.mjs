/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Keep native-ish Node packages out of the server bundle.
    serverComponentsExternalPackages: ["pg", "ioredis", "bcryptjs"],
  },
};

export default nextConfig;
