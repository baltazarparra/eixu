import { readFile, readdir } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { editPages, editTenant } from './page-edit-fixture.mjs';
import { inlineBlocks } from './inline-edit-data.mjs';
const root = process.cwd();
const j = createJiti(import.meta.url, {
  alias: { '@': root },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { InlineFixture } = await j.import('../browser/fixtures/inline-edit.tsx');
const { themeVars } = await j.import('../../lib/blocks/theme.ts');
const { pageRevision } = await j.import('../../lib/ai/page-edits.ts');
const { blockFields } = await j.import('../../lib/blocks/fields.ts');
const { fieldBackgrounds } = await j.import(
  '../../lib/blocks/text-style-lint.ts',
);
let css;
export async function inlineHtml(query = '', supplied) {
  const params = new URLSearchParams(query);
  const vibe = params.get('vibe') ?? 'comercial';
  const tenant = {
    ...editTenant,
    brand: {
      ...editTenant.brand,
      vibe,
      design: params.has('version')
        ? { version: Number(params.get('version')) }
        : undefined,
      ...(vibe === 'moderno'
        ? { paper: '#111111', ink: '#ffffff', surface: '#222222' }
        : { surface: '#f0efec' }),
    },
  };
  const blocks =
    supplied ??
    (params.has('all')
      ? inlineBlocks()
      : [
          ...editPages()[0].blocks,
          inlineBlocks().find((b) => b.type === 'feature.explorer'),
        ]);
  if (params.has('tone'))
    for (const block of blocks)
      block.props.presentation =
        params.get('tone') === 'custom'
          ? { background: '#d5e9c7' }
          : { tone: params.get('tone') };
  const editing = params.get('edit') !== '0';
  const theme = themeVars(tenant.brand);
  const data = {
    tenant,
    blocks,
    theme,
    editing,
    editor: {
      page: '',
      revision: pageRevision({ blocks }),
      fields: blocks.flatMap((block) =>
        blockFields(block, tenant.brand).map((field) => ({
          ...field,
          backgrounds: fieldBackgrounds(block, field.path, tenant.brand),
        })),
      ),
      palette: [
        ['Tinta', '--ink'],
        ['Apoio', '--muted'],
        ['Destaque', '--highlight-text'],
        ['Primária', '--accent'],
        ['Secundária', '--accent-2'],
      ].map(([label, key]) => ({ label, color: theme[key] })),
    },
  };
  // O editor só devolve null no SSR. O conteúdo de servidor usa o renderer real.
  const markup = renderToString(createElement(InlineFixture, { data }));
  css ??= (
    await Promise.all(
      (
        await readdir('.next/static/chunks')
      )
        .filter((f) => f.endsWith('.css'))
        .map((f) => readFile(`.next/static/chunks/${f}`, 'utf8')),
    )
  )
    .filter((sheet) => sheet.includes('.site-theme'))
    .join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><style>${css}${editing ? await readFile('lib/blocks/inline-editor.css', 'utf8') : ''}</style></head><body><div id="root">${markup}</div><script id="inline-fixture-data" type="application/json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script><script>window.__editMessages=[];addEventListener('message',e=>{if(e.data?.type==='eixu-edit/1')window.__editMessages.push(e.data)})</script><script type="module" src="/tests/browser/fixtures/inline-edit.tsx"></script></body></html>`;
}
export async function inlineFixtureServer() {
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: 'node_modules/.vite/inline-edit',
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
        name: 'inline-edit-fixture',
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            if (req.url?.split('?')[0] !== '/') return next();
            res.setHeader('content-type', 'text/html');
            res.end(
              await vite.transformIndexHtml(
                '/',
                await inlineHtml(req.url.slice(req.url.indexOf('?') + 1)),
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
