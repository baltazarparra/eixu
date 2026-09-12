import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

/** HTML de servidor + hidratação dos componentes reais e CSS do build Next.js. */
export async function navigationFixtureServer() {
  const root = process.cwd();
  const jiti = createJiti(import.meta.url, {
    alias: { '@': root },
    jsx: { runtime: 'automatic' },
    fsCache: false,
  });
  const { NavigationFixture } = await jiti.import(
    '../browser/fixtures/navigation.tsx',
  );
  const css = (
    await Promise.all(
      (
        await readdir('.next/static/chunks')
      )
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
    )
  )
    .filter((sheet) => sheet.includes('.site-theme'))
    .join('\n');
  assert.ok(
    css.includes('.site-menu-dialog'),
    'Execute build:vercel antes deste teste.',
  );
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: 'node_modules/.vite/site-navigation-test',
    // A fixture chega pelo middleware, fora das entradas descobertas pelo Vite.
    // Prepare suas dependências antes de navegar para não invalidar módulos em uso.
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'framer-motion',
        'zod',
      ],
    },
    plugins: [
      react(),
      {
        name: 'site-navigation-fixture',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            if (request.url?.split('?')[0] !== '/') return next();
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            const query = request.url.includes('?')
              ? request.url.slice(request.url.indexOf('?'))
              : '';
            const markup = renderToString(
              createElement(NavigationFixture, { query }),
            );
            response.end(
              await server.transformIndexHtml(
                '/',
                `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="icon" href="data:,"><style>${css}</style></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/navigation.tsx"></script></body></html>`,
              ),
            );
          });
        },
      },
    ],
    resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
  });
  await server.listen();
  return {
    server,
    origin: `http://127.0.0.1:${server.httpServer.address().port}`,
  };
}

export async function navigationPage(browser) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().startsWith('https://assets.test/')) {
      const width = request.url().includes('wide') ? 1600 : 640;
      const height = request.url().includes('logo') ? 640 : 480;
      void request.respond({
        status: 200,
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#96bcb0"/><path d="M40 40h200v200H40z" fill="#245b48"/></svg>`,
      });
    } else void request.continue();
  });
  await page.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  return page;
}
