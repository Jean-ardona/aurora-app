import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Frames are fetched as Blobs directly in FrameCanvas, not via next/image
    unoptimized: true,
  },
};

export default nextConfig;
