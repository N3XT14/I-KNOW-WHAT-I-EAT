import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add the IP address to allowedDevOrigins
  allowedDevOrigins: ['192.168.1.249'],
};

export default nextConfig;