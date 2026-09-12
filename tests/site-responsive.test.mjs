import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import * as ai from 'ai';
import { loadModule } from './helpers/load-module.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { RESPONSIVE_CONTRACT } = await j.import('../lib/design/responsive.ts');
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');
const tenant = {
  id: 'fixture',
  slug: 'fixture',
  name: 'Ateliê',
  brand: {},
  dials: {},
  brief: {},
  imageGuide: {},
};

await test('contrato mobile chega à geração e edição de todas as vibes e perfis', () => {
  for (const vibe of ['comercial', 'moderno', 'ousado', 'artistico'])
    for (const version of [undefined, 2, 3, 4])
      for (const context of [
        {},
        { editing: true },
        ...['briefing', 'cenas', 'composicao', 'revisao'].map((phase) => ({
          phase,
        })),
      ]) {
        const client = {
          ...tenant,
          brand: { vibe, design: version ? { version } : undefined },
        };
        assert.ok(
          systemPrompt(client, '', '/', '', context).includes(
            RESPONSIVE_CONTRACT,
          ),
        );
      }
});

await test('crítico recebe menu aberto como imagem binária, com medições separadas do texto', async () => {
  let received;
  const { critiquePages } = await loadModule('lib/review/critic.ts', {
    ai: {
      ...ai,
      generateText: async (request) => {
        received = request;
        return {
          output: { findings: [], strengths: [] },
          usage: {},
          steps: [],
        };
      },
    },
  });
  await critiquePages(
    tenant,
    [{ slug: '', title: 'Início', blocks: [], seo: {}, meta: {} }],
    [
      {
        page: '/',
        viewport: 'mobile',
        width: 390,
        scrollWidth: 390,
        overflow: false,
        brokenImages: 0,
        navigation: { compact: true, opened: true, closed: true, issues: [] },
        jpeg: Buffer.from('closed pixels'),
        menuJpeg: Buffer.from('open pixels'),
      },
    ],
  );
  assert.ok(received.instructions.includes(RESPONSIVE_CONTRACT));
  const content = received.messages[0].content;
  const files = content.filter((part) => part.type === 'file');
  assert.equal(files.length, 2);
  assert.equal(Buffer.from(files[1].data).toString(), 'open pixels');
  const text = content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
  assert.match(text, /menu aberto/);
  assert.match(text, /"opened":true/);
  assert.doesNotMatch(text, /open pixels|closed pixels|base64/);
});
