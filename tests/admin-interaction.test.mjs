import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import {
  chatFixture,
  chatRequest,
  readChunks,
} from './helpers/chat-fixture.mjs';

const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { conversationTools, interactionModeFor } = await j.import(
  '../lib/ai/interaction.ts',
);
const { buildTools } = await j.import('../lib/ai/tools.ts');

const conversations = [
  'Oi',
  'O que você acha da abertura?',
  'Quais tipos de carrossel você consegue fazer?',
  'Como eu deixaria este site mais premium?',
  'Seria melhor usar um footer escuro?',
  'Criar uma página mais curta faria sentido?',
  'Trocar o hero por uma foto seria melhor?',
  'Quero saber o que falta para publicar.',
  'Quero conversar sobre a conversão.',
  'Eu quero entender como melhorar a conversão.',
  'Preciso de ideias para a página de serviços.',
  'Me dê ideias para o hero.',
  'Confere se está bom no celular.',
  'Não mude nada, só me explica essa composição.',
  '',
];

for (const message of conversations)
  await test(`conversa não libera escrita: ${message || '(anexo sem texto)'}`, () => {
    assert.equal(interactionModeFor(message), 'conversation');
  });

const actions = [
  'Troque a abertura por editorial.',
  'Pode deixar o footer escuro?',
  'Quero um hero com a imagem #5.',
  'Quero mudar o hero para a imagem #5.',
  'No lugar de apenas uma imagem no hero, quero um carrossel com #4 e #6.',
  'Eu queria uma galeria depois da abertura.',
  'Gostaria de trocar o título.',
  'Melhore a conversão da home.',
  'Otimize a página para celular.',
  'Reorganize a página de serviços.',
  'Centralize o título.',
  'Anime a entrada dos cards.',
  'Quero melhorar a conversão.',
  'Quero que a home fique mais clara.',
  'Preciso que o hero tenha mais contraste.',
  'Vamos criar uma página de serviços.',
  'Na página de serviços, troque a foto pela #8.',
  'Ajuste só o fundo para #173f54.',
  'Analise visualmente este rascunho.',
  'Resolva as pendências de publicação.',
  'Publique o site.',
  'Header mais escuro e fixo.',
];

for (const message of actions)
  await test(`instrução explícita libera ação: ${message}`, () => {
    assert.equal(interactionModeFor(message), 'action');
  });

await test('confirmação curta só vira ação quando responde a uma proposta executável', () => {
  assert.equal(
    interactionModeFor('sim', 'Faz sentido para você?'),
    'conversation',
  );
  assert.equal(
    interactionModeFor('sim', 'Quer que eu aplique o fundo escuro no footer?'),
    'action',
  );
});

await test('filtro de conversa conserva só ferramentas de leitura', () => {
  const filtered = conversationTools({
    read_generator_manual: {},
    list_state: {},
    get_page: {},
    describe_block: {},
    list_images: {},
    lint_page: {},
    lint_site: {},
    edit_page: {},
    build_site: {},
    publish_site: {},
    review_pages: {},
    prepare_site_images: {},
  });
  assert.deepEqual(Object.keys(filtered).sort(), [
    'describe_block',
    'get_page',
    'lint_page',
    'lint_site',
    'list_images',
    'list_state',
    'read_generator_manual',
  ]);
});

await test('buildTools aplica a mesma fronteira no runtime real', () => {
  const tools = buildTools(
    {
      id: 'fixture',
      slug: 'fixture',
      name: 'Fixture',
      brand: {},
      dials: {},
      brief: {},
      imageGuide: {},
    },
    { conversationOnly: true },
  );
  assert.deepEqual(Object.keys(tools).sort(), [
    'describe_block',
    'get_page',
    'lint_page',
    'lint_site',
    'list_images',
    'list_state',
    'read_generator_manual',
  ]);
});

await test('rota marca perguntas como conversa antes de montar prompt e ferramentas', async () => {
  const fixture = await chatFixture();
  await readChunks(
    await fixture.POST(
      chatRequest('O que você acha da hierarquia desta página?'),
    ),
  );
  assert.equal(fixture.prompts[0].conversationOnly, true);
  assert.equal(fixture.prompts[0].editing, false);
  assert.equal(fixture.toolContexts[0].conversationOnly, true);
  assert.equal(fixture.toolContexts[0].editPolicy, undefined);
});
