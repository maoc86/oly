import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // Proxee /uploads/* al backend para que las imágenes relativas (nuevas) y
    // el optimizador de Next funcionen igual en local (Docker) y producción.
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    return [
      {
        source: "/uploads/:path*",
        destination: `${apiUrl}/uploads/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "api.olyofficial.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "olyofficial.com",
        pathname: "/uploads/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 80, 90],
  },
};

export default nextConfig;
