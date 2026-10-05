import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [],
  // Dev only: allow access via Cloudflare quick tunnels (URL changes on every restart),
  // the LAN IP, and localhost/127.0.0.1 (tanpa ini, hidrasi React dari 127.0.0.1 diblokir).
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.100.14", "localhost", "127.0.0.1"],
};

export default nextConfig;
