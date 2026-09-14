import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import { editPages, pageEditFixture } from './helpers/page-edit-fixture.mjs';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { applyPageEdit, pageRevision, contentLossError } = await j.import(
  '../lib/ai/page-edits.ts',
);
const { editPolicyFor, asksRemoval } = await j.import(
  '../lib/ai/edit-policy.ts',
);
const { RenderBlocks } = await j.import('../lib/blocks/render.tsx');
const { blockSchemas } = await j.import('../lib/blocks/registry.ts');
const { factWritten } = await j.import('../lib/ai/tools.ts');

const input = (page, operations) => ({
  page: page.slug,
  revision: pageRevision(page),
  operations,
});

/** O hero com selos que motivou a guarda: três frases sob os botões. */
function heroPage() {
  const page = editPages()[0];
  page.blocks[1] = {
    id: 'hero',
    type: 'hero.split',
    props: {
      headline: 'Água de coco integral direto para a garrafa',
      subtext: 'Colhida e envasada fresca, direto da fruta.',
      cta: { label: 'Pedir pelo WhatsApp', href: '/go/wa' },
      bullets: [
        '100% integral e não reconstituída',
        'Sem conservantes e zero açúcares',
        'Aproximadamente 3 cocos por litro',
      ],
    },
  };
  return page;
}

const moveRequest = 'coloque esses labels embaixo do title';

await test('pedido de mover não apaga: unset, lista menor e texto vazio são recusados', () => {
  const page = heroPage();
  const policy = editPolicyFor(moveRequest, [page]);
  assert.equal(policy.kind, 'edit');
  assert.equal(policy.removal, false);
  const attempts = [
    [{ op: 'unset', block: 'hero', path: 'bullets' }],
    [
      {
        op: 'set',
        block: 'hero',
        path: 'bullets',
        value: ['100% integral e não reconstituída'],
      },
    ],
    [{ op: 'remove', block: 'faq' }],
    [
      {
        op: 'replace_text',
        block: 'hero',
        path: 'subtext',
        from: 'Colhida e envasada fresca, direto da fruta.',
        to: '',
      },
    ],
  ];
  for (const operations of attempts) {
    assert.throws(
      () => applyPageEdit(page, input(page, operations), policy),
      (error) => {
        // Apagar a seção inteira é barrado antes, pelo tamanho da remoção; as
        // demais tentativas continuam recusadas pela perda de texto.
        assert.match(
          error.message,
          operations[0].op === 'remove'
            ? /não autoriza esse tamanho/
            : /não menciona remoção/,
        );
        assert.match(error.message, /Nenhuma alteração (salva|foi salva)/);
        return true;
      },
      JSON.stringify(operations),
    );
  }
  // A recusa é do lote inteiro: a página em memória continua intacta.
  assert.deepEqual(page.blocks[1].props.bullets.length, 3);
});

await test('remoção pedida pelo operador passa, em cada forma reconhecida', () => {
  for (const text of [
    'remova os selos do hero',
    'tire as etiquetas da abertura',
    'apague o bloco de dúvidas',
    'deixe só dois selos',
    'quero a abertura sem os selos',
  ]) {
    assert.equal(asksRemoval(text), true, text);
    const page = heroPage();
    const policy = editPolicyFor(text, [page]);
    const result = applyPageEdit(
      page,
      input(page, [{ op: 'unset', block: 'hero', path: 'bullets' }]),
      policy,
    );
    assert.equal(result.blocks[1].props.bullets, undefined, text);
  }
});

await test('a guarda não alcança apresentação, posição dos selos nem a geração', () => {
  const page = heroPage();
  const policy = editPolicyFor(moveRequest, [page]);
  const kept = applyPageEdit(
    page,
    input(page, [
      { op: 'set', block: 'hero', path: 'bulletsPlacement', value: 'headline' },
      {
        op: 'set',
        block: 'intro',
        path: 'presentation.background',
        value: '#173f54',
      },
      {
        op: 'replace_text',
        block: 'hero',
        path: 'bullets.0',
        from: '100% integral e não reconstituída',
        to: '100% integral, sem reconstituição',
      },
    ]),
    policy,
  );
  assert.equal(kept.blocks[1].props.bulletsPlacement, 'headline');
  assert.equal(kept.blocks[1].props.bullets.length, 3);
  assert.equal(kept.blocks[2].props.presentation.background, '#173f54');
  // Sem política, composição e reparo continuam livres para recompor.
  const rebuilt = applyPageEdit(
    page,
    input(page, [{ op: 'unset', block: 'hero', path: 'bullets' }]),
    undefined,
  );
  assert.equal(rebuilt.blocks[1].props.bullets, undefined);
  assert.equal(contentLossError(undefined, page.blocks, rebuilt.blocks), null);
});

await test('troca de tipo que não migra o texto é recusada sem pedido de remoção', () => {
  const page = heroPage();
  const policy = editPolicyFor(moveRequest, [page]);
  assert.throws(
    () =>
      applyPageEdit(
        page,
        input(page, [
          {
            op: 'replace_block',
            block: 'hero',
            replacement: {
              type: 'hero.statement',
              props: {
                headline: 'Água de coco integral direto para a garrafa',
                cta: { label: 'Pedir pelo WhatsApp', href: '/go/wa' },
              },
            },
          },
        ]),
        policy,
      ),
    /não migrado/,
  );
});

await test('a recusa chega ao executor real sem gravar nem tocar o publicado', async () => {
  const f = await pageEditFixture(moveRequest);
  const before = structuredClone(f.pages);
  const result = await f.tools.edit_page.execute(
    input(f.pages[0], [{ op: 'unset', block: 'hero', path: 'subtext' }]),
  );
  assert.match(result.error, /não menciona remoção/);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.pages, before);
});

await test('os selos do hero saem sob os botões ou sob o título, na ordem do DOM', () => {
  const order = (html, mark) => html.indexOf(mark);
  for (const [type, field, placementField] of [
    ['hero.split', 'bullets', 'bulletsPlacement'],
    ['hero.landing', 'badges', 'badgesPlacement'],
  ]) {
    for (const placement of ['cta', 'headline']) {
      const props =
        type === 'hero.split'
          ? {
              ...heroPage().blocks[1].props,
              [placementField]: placement,
              layout: 'editorial',
            }
          : {
              layout: 'form',
              headline: 'Mesas sob medida para trabalhar em casa',
              subtext: 'Você escolhe a medida e a cor.',
              cta: { label: 'Pedir orçamento', href: '/#contato' },
              [field]: [
                { label: '12 acabamentos', evidence: '12 acabamentos' },
              ],
              [placementField]: placement,
              form: {
                title: 'Peça seu orçamento',
                fields: [
                  { name: 'nome', label: 'Nome', type: 'text', required: true },
                  {
                    name: 'email',
                    label: 'E-mail',
                    type: 'email',
                    required: true,
                  },
                ],
              },
            };
      assert.equal(
        blockSchemas[type].safeParse(props).success,
        true,
        `${type} ${placement}`,
      );
      const html = renderToStaticMarkup(
        createElement(RenderBlocks, {
          blocks: [{ id: 'hero', type, props }],
          ctx: {
            tenant: {
              id: 't',
              slug: 't',
              name: 'Teste',
              brand: {
                vibe: type === 'hero.landing' ? 'landing' : 'comercial',
              },
              brief: {},
              dials: {},
              imageGuide: {},
            },
            pagePath: '/',
          },
        }),
      );
      assert.match(html, new RegExp(`data-placement="${placement}"`));
      const list = order(html, `data-placement="${placement}"`);
      const action = order(html, 'href="');
      assert.ok(list > 0, `${type} ${placement}: lista ausente`);
      if (placement === 'headline') assert.ok(list < action);
      else assert.ok(list > action);
    }
  }
});

await test('um fato só vira evidência quando o operador o escreveu', () => {
  const written =
    'Ganhamos o prêmio do Estadão em 2023. São três cocos por litro.';
  assert.equal(
    factWritten('Ganhamos o prêmio do Estadão em 2023', written),
    true,
  );
  assert.equal(factWritten('São três cocos por litro', written), true);
  assert.equal(factWritten('melhor água de coco do Brasil', written), false);
  assert.equal(factWritten('prêmio Estadão 2024', written), false);
  assert.equal(factWritten('', written), false);
  assert.equal(
    factWritten(
      'Ganhamos o prêmio Estadão 2023',
      'Não ganhamos o prêmio Estadão 2023.',
    ),
    false,
  );
  assert.equal(
    factWritten(
      '10 anos de experiência',
      'Temos 10 funcionários e 2 anos de experiência.',
    ),
    false,
  );
  assert.equal(
    factWritten(
      'Ganhamos o prêmio Estadão 2023',
      'Ganhamos o prêmio Estadão 2023?',
    ),
    false,
  );
  assert.equal(
    factWritten(
      'Ganhamos o prêmio Estadão 2023?',
      'Ganhamos o prêmio Estadão 2023?',
    ),
    false,
  );
  assert.equal(factWritten('Sem conservantes', 'Sem conservantes.'), true);
});

await test('confirm_evidence grava o que o operador escreveu e recusa o resto', async () => {
  const operatorText =
    'A foto nova é do produto. Prêmio Estadão 2023. Três cocos por litro.';
  const updates = [];
  const tenant = {
    id: 'fixture',
    slug: 'fixture',
    name: 'Fixture',
    brand: {},
    brief: { intake: { evidence: ['Envase no mesmo dia'] } },
    dials: {},
    imageGuide: {},
  };
  const mocks = {
    '@/lib/db': {
      db:
        () =>
        async (parts, ...values) => {
          updates.push({ sql: parts.join('?'), values });
          return [{ id: 'fixture' }];
        },
    },
    '@/lib/tenant-queries': {
      ...(await j.import('../lib/tenant-queries.ts')),
      listPages: async () => [],
    },
    '@/lib/images/queries': {
      ...(await j.import('../lib/images/queries.ts')),
      listImages: async () => [],
    },
  };
  const { buildTools } = await loadModule('lib/ai/tools.ts', mocks);
  const tools = buildTools(tenant, {
    operatorText,
    lastUserText: operatorText,
    editPolicy: { kind: 'edit' },
  });
  assert.ok(tools.confirm_evidence, 'disponível na edição');

  const refused = await tools.confirm_evidence.execute({
    facts: ['melhor água de coco do Brasil'],
  });
  assert.match(refused.error, /não encontrei estes fatos/i);
  assert.equal(updates.length, 0);

  const saved = await tools.confirm_evidence.execute({
    facts: ['Prêmio Estadão 2023', 'Três cocos por litro'],
  });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.deepEqual(saved.added, [
    'Prêmio Estadão 2023',
    'Três cocos por litro',
  ]);
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /jsonb_set\(brief, '\{evidence\}'/);

  // Repetir não duplica, mesmo com outra grafia.
  const again = await tools.confirm_evidence.execute({
    facts: ['prêmio estadão 2023'],
  });
  assert.deepEqual(again.added, [], JSON.stringify(again));
  assert.equal(updates.length, 1);

  // O que já veio do cadastro não precisa passar por aqui, e continua exigindo
  // que o operador tenha escrito o fato nesta conversa.
  const fromIntake = await tools.confirm_evidence.execute({
    facts: ['Envase no mesmo dia'],
  });
  assert.match(fromIntake.error, /não encontrei estes fatos/i);
  assert.equal(updates.length, 1);

  // O escopo restrito de cabeçalho continua sem a ferramenta.
  const scoped = buildTools(tenant, {
    operatorText,
    editPolicy: { kind: 'navigation-style', targets: [], paths: ['position'] },
  });
  assert.equal(scoped.confirm_evidence, undefined);
});
