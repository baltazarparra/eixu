import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertStudioEditorContract,
  studioEditorContractSchema,
} from '../lib/studio/editor-contract.mjs';

function contract(fields) {
  return {
    version: 1,
    pages: [
      {
        slug: '',
        label: 'Início',
        sections: [{ id: 'hero', label: 'Hero', fields }],
      },
    ],
  };
}

void test('contrato editorial aceita texto e imagem com chaves estáveis', () => {
  const parsed = assertStudioEditorContract(
    contract([
      { key: 'home.hero.title', label: 'Título', type: 'text', value: 'Olá' },
      {
        key: 'home.hero.image',
        label: 'Imagem',
        type: 'image',
        value: '/hero.webp',
      },
    ]),
  );
  assert.equal(parsed.pages[0].sections[0].fields.length, 2);
});

void test('contrato editorial rejeita chaves repetidas em páginas diferentes', () => {
  const input = contract([
    { key: 'shared.title', label: 'Título', type: 'text', value: 'A' },
  ]);
  input.pages.push({
    slug: 'sobre',
    label: 'Sobre',
    sections: [
      {
        id: 'intro',
        label: 'Introdução',
        fields: [
          { key: 'shared.title', label: 'Título', type: 'text', value: 'B' },
        ],
      },
    ],
  });
  const parsed = studioEditorContractSchema.safeParse(input);
  assert.equal(parsed.success, false);
  assert.match(parsed.error.issues[0].message, /Chave editorial repetida/);
});
