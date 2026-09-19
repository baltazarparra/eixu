import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // No Next 16.3.3, o cache persistido já entregou CSS anterior ao commit.
    // Compile os estilos atuais em produção; o cache de desenvolvimento segue ativo.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
