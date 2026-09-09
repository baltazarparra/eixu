import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Os sites gerados são dinâmicos por tenant. Sem isto o Next transmite os
  // metadados para o fim do documento, e uma parte dos rastreadores lê o HTML
  // sem executar JavaScript. Para um produto de SEO, metadado fora do <head>
  // não é aceitável, então forçamos metadado bloqueante para todo user agent.
  htmlLimitedBots: /.*/,
};

export default nextConfig;
