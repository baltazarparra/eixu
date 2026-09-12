import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import * as ai from 'ai';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { pageCopy, lintCopy } = await j.import('../lib/copy/lint.ts');
const { VIBE_COPY, SIMPLE_LANGUAGE } = await j.import('../lib/copy/policy.ts');
const { VIBES } = await j.import('../lib/design/vibes.ts');
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const { lintPage } = await j.import('../lib/taste/lint.ts');
const { reviewFingerprint, currentReview } = await j.import(
  '../lib/review/state.ts',
);

const tenant = {
  id: 'copy-fixture',
  slug: 'copy-fixture',
  name: 'Móveis do Bairro',
  brand: {},
  dials: {},
  brief: {},
  imageGuide: {},
};
function page(label = 'Ver mesas e cadeiras') {
  return {
    id: 'copy-page',
    slug: '',
    type: 'thank_you',
    title: 'Móveis do Bairro',
    seo: {
      title: 'Mesas e cadeiras',
      description: 'Conheça nossos móveis de madeira.',
    },
    meta: {},
    publishedBlocks: null,
    publishedSeo: null,
    blocks: [
      {
        id: 'cta',
        type: 'cta.band',
        props: {
          title: 'Móveis de madeira para sua casa',
          body: 'Veja mesas e cadeiras de madeira. Escolha o modelo que combina com a sua casa.',
          cta: { label, href: '/modelos' },
        },
      },
    ],
  };
}

for (const vibe of VIBES)
  await test(`${vibe}: autor recebe a mesma base e só a voz escolhida em todas as fases e edições`, () => {
    const client = { ...tenant, brand: { vibe } };
    for (const context of [
      {},
      { editing: true },
      ...['briefing', 'cenas', 'composicao', 'revisao'].map((phase) => ({
        phase,
      })),
    ]) {
      const prompt = systemPrompt(client, '', '/', '', context);
      assert.ok(prompt.includes(SIMPLE_LANGUAGE));
      assert.ok(prompt.includes(VIBE_COPY[vibe].tone));
      for (const other of VIBES.filter((value) => value !== vibe))
        assert.ok(!prompt.includes(VIBE_COPY[other].tone));
    }
    const sample = page(VIBE_COPY[vibe].example.cta);
    sample.blocks[0].props.title = VIBE_COPY[vibe].example.headline;
    sample.blocks[0].props.body = VIBE_COPY[vibe].example.body;
    assert.deepEqual(lintPage(sample), []);
  });

await test('cliente legado usa voz comercial e a troca de vibe invalida a revisão', () => {
  const prompt = systemPrompt(tenant, '', '/');
  assert.ok(prompt.includes(VIBE_COPY.comercial.tone));
  const reviewed = structuredClone(tenant);
  reviewed.brief.generation = {
    review: {
      fingerprint: reviewFingerprint(tenant, [page()], []),
      complete: true,
      visual: 'complete',
      errors: 0,
    },
  };
  assert.ok(currentReview(reviewed, [page()], []));
  assert.equal(
    currentReview({ ...reviewed, brand: { vibe: 'ousado' } }, [page()], []),
    null,
  );
});

await test('leitura cobre texto aninhado, busca, resumo, formulário, imagem e planos sem ler chaves técnicas', () => {
  const sample = page();
  sample.meta = {
    excerpt: 'Leia a explicação.',
    inbound: { intent: 'INTERNAL', stage: 'discovery' },
  };
  sample.blocks.push(
    {
      id: 'form',
      type: 'form.lead',
      props: {
        fields: [
          {
            name: 'INTERNAL',
            label: 'Seu nome',
            type: 'text',
            options: ['Mesa', 'Cadeira'],
          },
        ],
        submitLabel: 'Enviar mensagem',
        consentText: 'Você pode entrar em contato comigo.',
        redirectTo: '/INTERNAL',
      },
    },
    {
      id: 'photos',
      type: 'media.gallery',
      props: {
        images: [
          {
            src: 'https://INTERNAL.test/dashboard.webp',
            alt: 'Mesa de madeira.',
          },
        ],
        layout: 'INTERNAL',
        presentation: { tone: 'INTERNAL' },
      },
    },
    {
      id: 'plans',
      type: 'pricing.table',
      props: {
        plans: [
          {
            name: 'Plano mensal',
            price: 'R$ 50 por mês',
            features: ['Veja seus pedidos'],
            cta: { label: 'Ver o plano', href: '/INTERNAL' },
          },
        ],
      },
    },
  );
  const fields = pageCopy(sample);
  assert.ok(fields.some((field) => field.path === 'meta.excerpt'));
  assert.ok(fields.some((field) => field.path === 'seo.description'));
  assert.ok(
    fields.some((field) => field.path === 'props.fields[0].options[1]'),
  );
  assert.ok(fields.some((field) => field.path === 'props.images[0].alt'));
  assert.ok(fields.some((field) => field.path === 'props.plans[0].name'));
  assert.ok(
    fields.some((field) => field.path === 'props.plans[0].features[0]'),
  );
  assert.ok(fields.every((field) => !field.text.includes('INTERNAL')));
  assert.deepEqual(lintCopy(sample), []);
});

await test('vocabulário usa limites de palavra e verifica busca, resumo, perguntas, legendas e opções', () => {
  const sample = page();
  sample.seo.description = 'Receba insights.';
  sample.meta.excerpt = 'Faça o download.';
  sample.blocks.push(
    {
      id: 'faq',
      type: 'faq.accordion',
      props: {
        title: 'Perguntas',
        items: [{ q: 'Como funciona o onboarding?', a: 'Veja seu dashboard.' }],
      },
    },
    {
      id: 'media',
      type: 'media.image',
      props: {
        src: 'https://assets.test/feedback.webp',
        alt: 'Veja a performance.',
        caption: 'Seu workflow.',
      },
    },
    {
      id: 'form',
      type: 'form.lead',
      props: {
        fields: [{ name: 'lead', label: 'Interesse', options: ['Upload'] }],
      },
    },
  );
  const findings = lintCopy(sample);
  for (const path of [
    'seo.description',
    'meta.excerpt',
    'props.items[0].q',
    'props.items[0].a',
    'props.alt',
    'props.caption',
    'props.fields[0].options[0]',
  ])
    assert.ok(
      findings.some((finding) => finding.message.startsWith(`${path}:`)),
      path,
    );
  assert.ok(findings.every((finding) => finding.level === 'warn'));
  const plain = page();
  plain.blocks[0].props.body =
    'Fale pelo WhatsApp. Pague com Pix. Veja nossa mesa Capivari. https://assets.test/dashboard';
  assert.deepEqual(lintCopy(plain), []);
});

await test('botões sem ação clara são erros, enquanto o contexto decide jargão e comprimento', () => {
  for (const label of [
    'Saiba mais',
    '  CLIQUE AQUI! ',
    'Learn more',
    'Vamos lá',
    'Submit',
  ])
    assert.ok(
      lintPage(page(label)).some(
        (f) => f.rule === 'acao-pouco-clara' && f.level === 'error',
      ),
      label,
    );
  for (const label of [
    'Ver serviços',
    'Falar pelo WhatsApp',
    'Pedir orçamento',
    'Enviar mensagem',
  ])
    assert.ok(!lintPage(page(label)).some((f) => f.level === 'error'), label);
  const sample = page();
  sample.blocks[0].props.body = 'Usamos CRM (sistema para organizar clientes).';
  assert.ok(lintCopy(sample).some((f) => f.rule === 'linguagem-vocabulario'));
  assert.ok(!lintCopy(sample).some((f) => f.level === 'error'));
  sample.blocks[0].props.body = Array(31).fill('palavra').join(' ');
  assert.ok(
    lintCopy(sample).some(
      (f) => f.rule === 'linguagem-frase-longa' && f.level === 'warn',
    ),
  );
  assert.equal(sample.blocks[0].props.body.split(' ').length, 31);
});

await test('publicação compartilhada bloqueia texto ruim antes de qualquer escrita e aceita o reparo', async () => {
  let target = page('Learn more');
  let writes = 0;
  const sql = () => {
    writes += 1;
    return [];
  };
  sql.transaction = async (operations) => operations;
  const { publishSite } = await loadModule('lib/sites/publish.ts', {
    '@/lib/db': { db: () => sql },
    '@/lib/tenant-queries': { listPages: async () => [target] },
    '@/lib/images/queries': { listImages: async () => [] },
    '@/lib/taste/site': {
      lintSite: () => [],
      publicationState: (pages) => pages,
    },
  });
  for (const slug of [undefined, '']) {
    const result = await publishSite(tenant, slug);
    assert.equal(result.published.length, 0);
    assert.match(result.blocked[0].preflight, /acao-pouco-clara/);
    assert.equal(writes, 0);
  }
  target = page('Ver mesas e cadeiras');
  const repaired = await publishSite(tenant);
  assert.equal(repaired.blocked.length, 0);
  assert.equal(repaired.published.length, 1);
  assert.equal(writes, 2);
});

await test('crítico recebe voz, todos os textos e sinais junto dos pixels e devolve erro de clareza', async () => {
  let calls = 0;
  const { critiquePages } = await loadModule('lib/review/critic.ts', {
    ai: {
      ...ai,
      generateText: async (request) => {
        calls += 1;
        assert.ok(request.instructions.includes(SIMPLE_LANGUAGE));
        assert.ok(request.instructions.includes(VIBE_COPY.artistico.tone));
        assert.match(request.instructions, /linguagem-simples/);
        const content = request.messages[0].content;
        const data = JSON.parse(content[0].text);
        assert.equal(data.pages[0].seo.description, 'Conheça nosso workflow.');
        assert.ok(
          data.pages[0].languageSignals.some(
            (f) => f.rule === 'linguagem-vocabulario',
          ),
        );
        assert.ok(
          content.some(
            (part) => part.type === 'file' && part.data instanceof Uint8Array,
          ),
        );
        return {
          output: {
            findings: [
              {
                page: '/',
                blockId: null,
                level: 'error',
                criterion: 'linguagem-simples',
                evidence: 'A descrição usa workflow sem explicar o sentido.',
                correction: 'Escreva etapas do trabalho na descrição.',
              },
            ],
            strengths: [],
          },
          usage: {},
          steps: [],
        };
      },
    },
  });
  const sample = page();
  sample.seo.description = 'Conheça nosso workflow.';
  const result = await critiquePages(
    { ...tenant, brand: { vibe: 'artistico' } },
    [sample],
    [
      {
        page: '/',
        viewport: 'mobile',
        width: 390,
        overflow: false,
        brokenImages: 0,
        jpeg: Buffer.from('pixels'),
      },
    ],
  );
  assert.equal(calls, 1);
  assert.equal(result.findings[0].level, 'error');
  assert.equal(result.findings[0].criterion, 'linguagem-simples');
});
