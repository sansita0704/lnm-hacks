import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    // images: {
    //   remotePatterns: [
    //     {
    //       protocol: "https",
    //       hostname: "ik.imagekit.io",
    //       port: "",
    //     },
    //   ],
    // },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },

    experimental: {
        serverActions: {
            allowedOrigins: ["localhost:8080", "127.0.0.1:3001"],
        },
    },

    reactStrictMode: true,

    async rewrites() {
        return {
            fallback: [
                {
                    source: "/api/:path*",
                    destination: "http://127.0.0.1:5000/:path*", // Direct fallback
                },
            ],
        };
    },
};

export default nextConfig;
