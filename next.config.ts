import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  // Dev only: allow access via Cloudflare quick tunnels (URL changes on every restart) and the LAN IP
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.100.14"],
};

export default nextConfig;
