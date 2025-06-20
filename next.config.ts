import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/generate/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
