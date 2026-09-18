import type { NextConfig } from 'next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Chromium captura a referência visual cadastrada antes da direção de arte.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/.well-known/workflow/*': [
      './SOUL.md',
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
  // O cadastro envia o logo junto do formulário; o padrão de 1 MB recusaria
  // um arquivo que a rota de upload aceita.
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // No Next 16.3.3, o cache persistido já entregou CSS anterior ao commit.
    // Compile os estilos atuais em produção; o cache de desenvolvimento segue ativo.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default withWorkflow(nextConfig);
