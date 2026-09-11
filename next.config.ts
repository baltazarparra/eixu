import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Chromium e o driver ficam fora do bundle: são binários carregados em
  // runtime pela revisão visual do gerador.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    // A revisão visual roda no chat, no consumidor da fila e no transporte
    // HTTP local. Sem os binários aqui, a captura falha só em produção.
    '/api/chat': ['./SOUL.md', './node_modules/@sparticuz/chromium/bin/**/*'],
    // Os colchetes da rota dinâmica são classe de caracteres no glob desta
    // opção: '[tenant]' casaria uma letra só. O curinga de segmento resolve.
    '/api/admin/*/generation/step': [
      './SOUL.md',
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
    '/api/queues/generation': [
      './SOUL.md',
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
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
