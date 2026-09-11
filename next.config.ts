import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Chromium e o driver ficam fora do bundle: são binários carregados em
  // runtime pela revisão visual do gerador.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Os sites gerados são dinâmicos por tenant. Sem isto o Next transmite os
  // metadados para o fim do documento, e uma parte dos rastreadores lê o HTML
  // sem executar JavaScript. Para um produto de SEO, metadado fora do <head>
  // não é aceitável, então forçamos metadado bloqueante para todo user agent.
  htmlLimitedBots: /.*/,
  // O cadastro envia o logo junto do formulário; o padrão de 1 MB recusaria
  // um arquivo que a rota de upload aceita.
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
};

export default nextConfig;
