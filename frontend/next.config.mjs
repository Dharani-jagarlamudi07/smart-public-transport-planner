/** @type {import('next').NextConfig} */
const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

const nextConfig = {
  output: "standalone",
  // ADD THIS LINE BELOW TO ALLOW YOUR LOCAL NETWORK IP
  allowedDevOrigins: ['192.168.137.148', 'localhost'], 
  
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;