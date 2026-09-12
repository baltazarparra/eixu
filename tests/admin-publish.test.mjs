import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const taste = await j.import('../lib/taste/site.ts');
const lint = await j.import('../lib/taste/lint.ts');
const { DESIGN_AXES } = await j.import('../lib/design/profile.ts');

const design = {
  version: 2,
  concept: 'Conceito',
  signatureElement: 'Assinatura',
  ...Object.fromEntries(DESIGN_AXES.map((axis) => [axis, 'x'])),
};
const tenant = { id: 'tenant-1', slug: 'fixture', brand: { design } };
// O módulo roda em outro realm do vm: arrays e objetos vindos dele não são
// reference-equal aos daqui. A comparação estrutural passa por JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

/**
 * O gate real com lint controlado: as regras têm teste próprio em
 * site-contract; aqui interessa o que recusa, o que agrupa e o que grava.
 */
async function gate({
  siteFindings = [],
  pageErrors = {},
  duplicate = false,
} = {}) {
  const writes = [];
  const pages = ['', 'materiais', 'guia'].map((slug, index) => ({
    id: `page-${index}`,
    slug,
    type: 'page',
    title: `Página ${index}`,
    seo: {},
    meta: {},
    blocks: [{ id: 'b', type: 'editorial.text', props: { body: 'x' } }],
    publishedBlocks: null,
    publishedSeo: null,
  }));
  const sql = Object.assign(
    (parts, ...values) => ({ sql: parts.join('?'), values }),
    {
      transaction: async (statements) => {
        writes.push(...statements);
      },
    },
  );
  const { publishSite } = await loadModule('lib/sites/publish.ts', {
    '@/lib/db': { db: () => sql },
    '@/lib/tenant-queries': { listPages: async () => pages },
    '@/lib/images/queries': { listImages: async () => [] },
    '@/lib/design/uniqueness': {
      hasDuplicateComposition: async () => duplicate,
    },
    '@/lib/taste/site': { ...taste, lintSite: () => siteFindings },
    '@/lib/taste/lint': {
      ...lint,
      lintPage: (page) => pageErrors[page.slug] ?? [],
    },
  });
  return { publishSite, writes };
}

await test('avisos do contrato de projeto não recusam a publicação', async () => {
  // Dois avisos de proporção na home: o botão do painel ficava habilitado e
  // a API respondia "Bloqueado em /, /".
  const { publishSite, writes } = await gate({
    siteFindings: [
      { page: '/', level: 'warn', rule: 'imagem-proporcao', message: 'a' },
      { page: '/', level: 'warn', rule: 'imagem-proporcao', message: 'b' },
      { page: '/guia', level: 'warn', rule: 'layout-repetido', message: 'c' },
    ],
  });
  const result = plain(await publishSite(tenant));
  assert.deepEqual(result.blocked, []);
  assert.deepEqual(result.published, ['/', '/materiais', '/guia']);
  assert.equal(result.url, 'https://fixture.eixu.com.br');
  // Três páginas e o status do cliente, na mesma transação.
  assert.equal(writes.length, 4);
});

await test('erros agrupam por página com todos os motivos e nada é gravado', async () => {
  const { publishSite, writes } = await gate({
    siteFindings: [
      { page: '/', level: 'error', rule: 'home-protagonista', message: 'sem protagonista' },
      { page: '/', level: 'warn', rule: 'home-tons', message: 'ignorado' },
      { page: '/guia', level: 'error', rule: 'pagina-sem-foto', message: 'sem foto' },
    ],
    pageErrors: {
      '': [{ level: 'error', rule: 'props-invalidas', message: 'prop x' }],
    },
    duplicate: true,
  });
  const result = plain(await publishSite(tenant));
  assert.deepEqual(result.published, []);
  assert.deepEqual(
    result.blocked.map((item) => item.page),
    ['/', '/guia'],
  );
  const home = result.blocked[0].preflight;
  assert.match(home, /props-invalidas/);
  assert.match(home, /home-protagonista/);
  assert.match(home, /composicao-duplicada/);
  assert.doesNotMatch(home, /home-tons/);
  assert.equal(writes.length, 0);
});

await test('publicação pontual de slug inexistente responde com o caminho pedido', async () => {
  const { publishSite } = await gate();
  const result = plain(await publishSite(tenant, '/nada/'));
  assert.deepEqual(result.published, []);
  assert.deepEqual(result.blocked, [
    { page: '/nada', preflight: 'Nenhuma página encontrada para publicar.' },
  ]);
});
