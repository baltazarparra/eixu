import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { inlineHtml } from './inline-edit-fixture.mjs';

export function handoffData() {
  const clients = [
    ['marcenaria-horizonte', 'Marcenaria Horizonte', 'published', 7, 41],
    ['clinica-vertice', 'Clínica Vértice', 'published', 9, 63],
    ['padaria-sao-bento', 'Padaria São Bento', 'draft', 3, 0],
    ['otica-lumen', 'Ótica Lumen', 'published', 6, 43],
    ['studio-corda', 'Studio Corda', 'draft', 2, 0],
  ].map(([slug, name, status, pageCount, leadCount]) => ({
    slug,
    name,
    status,
    pageCount,
    leadCount,
    updatedAt: '2026-09-11T12:00:00Z',
  }));
  const tenant = {
    ...clients[0],
    contactEmail: 'operacao@example.test',
    vibe: 'comercial',
    imageCount: 3,
  };
  const series = Array.from({ length: 30 }, (_, i) => ({
    day: `2026-08-${String(i + 1).padStart(2, '0')}`,
    visitors: 20 + i * 3,
    contacts: i % 7,
  }));
  return {
    clients,
    tenant,
    summary: { leads30d: 147, running: 1 },
    intake: {
      segment: 'Marcenaria',
      region: 'Campinas',
      audience: 'Arquitetos e moradores',
      offer: 'Móveis planejados sob medida',
      goal: 'Pedir orçamento',
      evidence: ['Oficina própria', '12 anos de atuação'],
      constraints: ['Não prometer prazo'],
      references: [],
    },
    contacts: {
      phones: [{ number: '+5511999999999', whatsapp: true }],
      addresses: [{ label: 'Oficina', text: 'Rua de exemplo, 123' }],
      social: [],
    },
    guide: {
      estilo: 'fotografia',
      luz: 'Luz natural lateral',
      paleta: ['madeira', 'carvão', 'areia'],
      ambientes: ['oficina', 'interiores'],
      sujeitos: ['materiais', 'mobiliário'],
      nunca: ['texto sobreposto', 'marcas de terceiros'],
      notas: 'Mostre o cuidado com os materiais e o trabalho da oficina.',
    },
    images: ['3:2', '1:1', '4:5'].map((ratio, i) => ({
      id: `image-${i}`,
      seq: i + 1,
      kind: i === 1 ? 'logo' : 'foto',
      ratio,
      url: i === 1 ? '/favicon.svg' : '/cases/saldo-flow.webp',
      status: i === 2 ? 'rejeitada' : 'disponivel',
      score: i === 0 ? 8.6 : i === 1 ? null : 4.2,
      critique: {},
      alt: 'Imagem sintética do acervo de teste',
      description: 'Materiais e composições disponíveis para revisar no site.',
      requestText: 'Referência de teste',
    })),
    traffic: {
      period: { start: '2026-08-01', end: '2026-08-30' },
      visitors: 1248,
      forms: 34,
      whats: 61,
      cents: 140800,
      partialSpends: 2,
      campaignCount: 2,
      series,
      campaigns: [
        {
          campaign: 'Móveis planejados',
          src: 'google',
          visitors: 814,
          forms: 23,
          whats: 40,
          cents: 140800,
        },
        {
          campaign: '(direto)',
          src: '(direto)',
          visitors: 434,
          forms: 11,
          whats: 21,
          cents: 0,
        },
      ],
      pages: [
        { path: '/', visitors: 1100, actions: 64 },
        { path: '/servicos', visitors: 624, actions: 31 },
      ],
    },
    site: {
      tenant: {
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        hasDesign: true,
      },
      previewRevision: 'test-v1',
      review: {
        current: false,
        complete: false,
        visual: null,
        reviewedAt: null,
        errors: 0,
        findings: [],
        pages: [],
      },
      pages: [
        {
          slug: '',
          title: 'Início',
          type: 'page',
          blocks: 5,
          dirty: true,
          published: true,
          publishedAt: '2026-09-01T00:00:00Z',
          errors: [],
          warnings: [],
        },
      ],
      errors: [],
      warnings: [],
      generation: {
        next: 'revisao',
        photos: 3,
        coveredScenes: 3,
        targetScenes: 3,
        nextScene: null,
        organicPages: 3,
        reviewRounds: 0,
        reviewComplete: false,
        blockingErrors: 0,
      },
    },
    history: [
      {
        id: 'user-1',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Quero um site que mostre o cuidado com os materiais e facilite o pedido de orçamento.',
          },
        ],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'As páginas estão no rascunho. Organizei os serviços, as referências e os contatos. Agora vou revisar a composição em desktop e celular.',
          },
        ],
      },
    ],
  };
}

export async function handoffFixture({ port = 0 } = {}) {
  const root = process.cwd();
  const directory = path.join(root, '.next/static/chunks');
  const css = (
    await Promise.all(
      (
        await readdir(directory)
      )
        .filter((file) => file.endsWith('.css'))
        .map((file) => readFile(path.join(directory, file), 'utf8')),
    )
  )
    .filter((css) => css.includes('.admin-shell'))
    .join('\n');
  if (!css)
    throw new Error('Execute build:vercel antes da verificação do handoff.');
  const data = handoffData();
  const writes = [];
  let failSave = false;
  let editStatus = 200;
  let holdingFeed = false;
  const heldFeeds = [];
  const editWrites = [];
  const server = await createServer({
    configFile: false,
    root,
    cacheDir: path.join(root, 'node_modules/.vite-admin-handoff'),
    define: { 'process.env': '{}' },
    optimizeDeps: {
      noDiscovery: true,
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'framer-motion',
        'zod',
        '@ai-sdk/react',
        'ai',
        'lucide-react',
        'three',
        'next/link',
        'next/image',
        '@neondatabase/serverless',
      ],
    },
    plugins: [
      react(),
      {
        name: 'eixu-handoff-fixture',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'next/navigation') return '\0handoff-navigation';
        },
        load(id) {
          if (id === '\0handoff-navigation')
            return `export function usePathname(){return location.pathname;} export function useSearchParams(){return new URLSearchParams(location.search);} export function useRouter(){return {push:url=>location.assign(url),refresh:()=>{window.__refreshes=(window.__refreshes||0)+1}}}`;
        },
        transform(_source, id) {
          if (id.endsWith('/app/(admin)/admin/actions.ts'))
            return `export async function createTenantAction(){return 'Cadastro simulado para teste.'} export async function deleteTenantAction(){return {ok:false,message:'Exclusão simulada para teste.'}} export async function loginAction(){return 'Usuário ou senha incorretos.'} export async function logoutAction(){}`;
        },
        configureServer(vite) {
          vite.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url, 'http://fixture.test');
            if (url.pathname.startsWith('/_next/static/media/')) {
              res.end(
                await readFile(
                  path.join(
                    root,
                    '.next/static/media',
                    path.basename(url.pathname),
                  ),
                ),
              );
              return;
            }
            if (url.pathname.startsWith('/api/admin/')) {
              res.setHeader('content-type', 'application/json');
              const client = data.clients.find(
                (client) => client.slug === url.pathname.split('/')[3],
              );
              const site = {
                ...data.site,
                tenant: { ...data.site.tenant, ...client },
              };
              if (url.pathname.endsWith('/edit')) {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const body = JSON.parse(Buffer.concat(chunks).toString());
                editWrites.push(body);
                res.statusCode = editStatus;
                if (editStatus === 200)
                  data.site.previewRevision = `test-v${editWrites.length + 1}`;
                res.end(
                  JSON.stringify(
                    editStatus === 200
                      ? { ok: true, changed: true, revision: 'b'.repeat(64) }
                      : {
                          error:
                            editStatus === 409
                              ? 'A página mudou.'
                              : 'Confira o título.',
                          fields:
                            editStatus === 422
                              ? [
                                  {
                                    block: 'hero',
                                    path: 'headline',
                                    message: 'Confira o título.',
                                  },
                                ]
                              : [],
                        },
                  ),
                );
                return;
              }
              if (url.pathname.endsWith('/settings')) {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const body = JSON.parse(
                  Buffer.concat(chunks).toString() || '{}',
                );
                writes.push(body);
                res.statusCode = failSave ? 400 : 200;
                res.end(
                  JSON.stringify(
                    failSave
                      ? { error: 'Não foi possível salvar os dados.' }
                      : { ok: true, social: null },
                  ),
                );
                return;
              }
              if (url.pathname.endsWith('/generation')) {
                if (holdingFeed)
                  await new Promise((resolve) => heldFeeds.push(resolve));
                res.end(
                  JSON.stringify({
                    state: {
                      ...site,
                      previewRevision: data.site.previewRevision,
                    },
                    run: null,
                    events: [],
                    messages: [],
                    lastMessageId: 0,
                    hasMoreMessages: false,
                    everRan: true,
                    serverNow: new Date().toISOString(),
                  }),
                );
                return;
              }
              if (url.pathname.endsWith('/state')) {
                res.end(JSON.stringify(site));
                return;
              }
              if (url.pathname.endsWith('/publish')) {
                res.end(
                  JSON.stringify({
                    published: [''],
                    blocked: [],
                    url: 'https://example.test',
                  }),
                );
                return;
              }
              if (url.pathname.endsWith('/images')) {
                res.end(
                  JSON.stringify({ guide: data.guide, images: data.images }),
                );
                return;
              }
              res.statusCode = 400;
              res.end(
                JSON.stringify({ error: 'Ação indisponível no teste visual.' }),
              );
              return;
            }
            if (url.pathname.startsWith('/s/')) {
              res.setHeader('content-type', 'text/html; charset=utf-8');
              if (url.searchParams.get('edit') === '1') {
                res.end(
                  await vite.transformIndexHtml(
                    url.pathname,
                    await inlineHtml(url.search),
                  ),
                );
                return;
              }
              res.end(
                '<html lang="pt-BR"><body style="font:18px system-ui;background:#f0ece4;color:#2b251f;padding:30px"><h1>Marcenaria Horizonte</h1><p>Prévia sintética para verificar a moldura do editor.</p></body></html>',
              );
              return;
            }
            if (
              url.pathname === '/admin' ||
              url.pathname.startsWith('/admin/')
            ) {
              data.empty = url.searchParams.has('empty');
              const slug = url.pathname.split('/')[2];
              const client = data.clients.find(
                (client) => client.slug === slug,
              );
              const state = {
                ...data,
                tenant: { ...data.tenant, ...client },
                site: {
                  ...data.site,
                  tenant: { ...data.site.tenant, ...client },
                },
              };
              const html = `<html lang="pt-BR" style="--font-admin-sans:Geist;--font-admin-mono:'Geist Mono'"><head><meta charset="utf-8"><style>@font-face{font-family:Geist;src:url('/app/(admin)/fonts/geist-latin.woff2')}@font-face{font-family:'Geist Mono';src:url('/app/(admin)/fonts/geist-mono-latin.woff2')}#root{height:100%}${css}</style></head><body><div id="root"></div><script type="application/json" id="fixture-state">${JSON.stringify(state).replaceAll('<', '\\u003c')}</script><script type="module" src="/tests/browser/fixtures/admin-handoff.tsx"></script></body></html>`;
              res.setHeader('content-type', 'text/html; charset=utf-8');
              res.end(await vite.transformIndexHtml(url.pathname, html));
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
    server: { host: '127.0.0.1', port },
    logLevel: 'error',
  });
  await server.listen();
  return {
    server,
    data,
    writes,
    editWrites,
    holdFeed() {
      holdingFeed = true;
    },
    releaseFeed() {
      holdingFeed = false;
      for (const resolve of heldFeeds.splice(0)) resolve();
    },
    setEditStatus(status) {
      editStatus = status;
    },
    failSave(value) {
      failSave = value;
    },
    base: `http://127.0.0.1:${server.httpServer.address().port}`,
  };
}
