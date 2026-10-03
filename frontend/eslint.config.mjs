/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000"; // Use 127.0.0.1 for stability

const nextConfig = {
  output: "standalone",
  
  // Allow local network IPs for development (fixes the HMR warning)
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