import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJiti } from 'jiti';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { GENERATOR_MANUAL_SECTIONS, generatorManualIndex, readGeneratorManual } =
  await j.import('../lib/ai/generator-manual.ts');
const { BLOCK_TYPES } = await j.import('../lib/blocks/registry.ts');
const { buildTools } = await j.import('../lib/ai/tools.ts');
const { systemPrompt } = await j.import('../lib/taste/prompt.ts');

const manual = await readFile('docs/manual-gerador-sites.md', 'utf8');
const tenant = {
  id: 'fixture',
  slug: 'fixture',
  name: 'Fixture',
  brand: {},
  dials: {},
  brief: {},
  imageGuide: {},
};

await test('todas as seções indexadas existem e podem ser lidas', () => {
  const ids = GENERATOR_MANUAL_SECTIONS.map(([id]) => id);
  assert.equal(new Set(ids).size, ids.length);
  const content = readGeneratorManual(ids);
  for (const [id, heading] of GENERATOR_MANUAL_SECTIONS) {
    assert.match(generatorManualIndex(), new RegExp(`- ${id}: ${heading}`));
    assert.match(content, new RegExp(`## ${heading}`));
  }
  assert.ok(content.length > 10_000);
});

await test('manual cobre todos os tipos de bloco do catálogo atual', () => {
  assert.equal(BLOCK_TYPES.length, 30);
  for (const type of BLOCK_TYPES)
    assert.ok(manual.includes(`\`${type}\``), `bloco ausente: ${type}`);
});

await test('manual cobre todas as ferramentas expostas pelo buildTools', () => {
  const names = Object.keys(
    buildTools(tenant, {
      lastUserText: 'Resolva as pendências de publicação.',
    }),
  );
  assert.equal(names.length, 33);
  assert.equal(new Set(names).size, names.length);
  for (const name of names)
    assert.ok(manual.includes(`\`${name}\``), `ferramenta ausente: ${name}`);
});

await test('prompt de conversa traz o índice sem abrir o catálogo de escrita', () => {
  const prompt = systemPrompt(tenant, '', '/', '', { conversationOnly: true });
  assert.match(prompt, /## Conversa atual/);
  assert.match(prompt, /## Manual do gerador/);
  assert.match(prompt, /read_generator_manual/);
  assert.doesNotMatch(prompt, /## Catálogo/);
  assert.doesNotMatch(prompt, /## Execução com critério de qualidade/);
  assert.match(prompt, /Não invente mudança, recibo ou pendência/);
});
