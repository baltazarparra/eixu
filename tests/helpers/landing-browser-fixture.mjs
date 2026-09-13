import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { loadModule } from './load-module.mjs';

/** Renderer, hidratação e POST reais; persistência e imagens sintéticas locais. */
export async function landingBrowserFixture() {
  const root = process.cwd();
  const j = createJiti(import.meta.url, {
    alias: { '@': root },
    jsx: { runtime: 'automatic' },
    fsCache: false,
  });
  const { LandingFixture } = await j.import('../browser/fixtures/landing.tsx');
  const { landingFixture } = await j.import('./landing-data.ts');
  const f = landingFixture();
  const writes = [];
  const { POST } = await loadModule('app/api/form/route.ts', {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          writes.push({ sql: parts.join('?'), values });
          return [];
        },
    },
    '@/lib/tenant-queries': {
      getTenantBySlug: async (slug) =>
        slug === f.tenant.slug ? f.tenant : null,
      getPage: async (tenant, slug) =>
        tenant === f.tenant.id ? f.pages.find((p) => p.slug === slug) : null,
    },
  });
  const css = (
    await Promise.all(
      (
        await readdir('.next/static/chunks')
      )
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(`.next/static/chunks/${file}`, 'utf8')),
    )
  )
    .filter(
      (sheet) =>
        sheet.includes('.site-theme') || sheet.includes('--font-grotesk'),
    )
    .join('\n')
    .replaceAll('url(../media/', 'url(/_next/static/media/');
  assert.ok(
    css.includes('.site-landing-hero'),
    'Execute build:vercel antes do navegador.',
  );
  const fontClasses = [...css.matchAll(/\.([\w-]+)\{--font-[\w-]+:/g)]
    .map((m) => m[1])
    .join(' ');
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: 'node_modules/.vite/site-landing',
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
        name: 'landing-fixture',
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const url = new URL(request.url ?? '/', origin);
            if (url.pathname.startsWith('/_next/static/media/')) {
              try {
                response.end(
                  await readFile(
                    path.join(
                      root,
                      '.next/static/media',
                      path.basename(url.pathname),
                    ),
                  ),
                );
              } catch {
                response.statusCode = 404;
                response.end();
              }
              return;
            }
            if (url.pathname.startsWith('/fixture-media/')) {
              const n = Number(url.pathname.match(/landing-(\d)/)?.[1] ?? 1);
              const width = n === 2 || n === 3 ? 1200 : 1600,
                height = 900;
              const wood = n === 3 ? '#a16a45' : '#be9068';
              response.setHeader('Content-Type', 'image/svg+xml');
              response.end(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#e9ece4"/><path d="M0 650L1200 500V900H0Z" fill="#d7dcd1"/><path d="M180 330L890 300 1060 490 340 550Z" fill="${wood}"/><path d="M180 330L340 550V575L180 355Z" fill="#8f6145"/><path d="M340 550L1060 490V515L340 575Z" fill="#9c714f"/><path d="M205 362L237 370 248 737 218 730Z M975 519L1009 516 1016 745 982 750Z M370 573L400 570 415 815 383 818Z" fill="#465148"/><path d="M430 300L665 284 685 410 450 432Z" fill="#465148"/><path d="M449 314L650 302 665 394 465 411Z" fill="#a4bbae"/><path d="M555 415L558 460 611 458" fill="none" stroke="#465148" stroke-width="12"/><ellipse cx="900" cy="650" rx="90" ry="18" fill="#a0aa98" opacity=".3"/><path d="M845 523H946L930 650H863Z" fill="#c7bb9f"/><path d="M895 530V320M895 420Q788 395 825 344Q874 339 895 420M895 470Q1000 408 966 367Q911 373 895 470" fill="#637e62" stroke="#637e62" stroke-width="12"/></svg>`,
              );
              return;
            }
            if (url.pathname === '/api/form' && request.method === 'POST') {
              const chunks = [];
              for await (const chunk of request) chunks.push(chunk);
              const result = await POST(
                new Request(url, {
                  method: 'POST',
                  headers: { 'content-type': request.headers['content-type'] },
                  body: Buffer.concat(chunks),
                }),
              );
              response.statusCode = result.status;
              result.headers.forEach((value, key) =>
                response.setHeader(key, value),
              );
              response.end(await result.text());
              return;
            }
            if (!['/', '/obrigado'].includes(url.pathname)) return next();
            if (url.pathname === '/obrigado') {
              response.statusCode = 302;
              response.setHeader('Location', '/?thanks=1');
              response.end();
              return;
            }
            const markup = renderToString(
              createElement(LandingFixture, { query: url.search, origin }),
            );
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(
              await server.transformIndexHtml(
                '/',
                `<!doctype html><html lang="pt-BR" class="${fontClasses}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" href="data:,"><style>${css}</style></head><body><div id="root">${markup}</div><script type="module" src="/tests/browser/fixtures/landing.tsx"></script></body></html>`,
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
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  return { server, origin, writes };
}
