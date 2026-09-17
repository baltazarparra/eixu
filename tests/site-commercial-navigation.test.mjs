import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createJiti } from 'jiti';

const root = process.cwd();
const j = createJiti(import.meta.url, {
  alias: { '@': root },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { CommercialV8Fixture } = await j.import(
  './browser/fixtures/commercial-v8.tsx',
);
const { COMMERCIAL_V8_STRUCTURE_KEYS } = await j.import(
  '../lib/design/structures.ts',
);

const home = renderToString(
  createElement(CommercialV8Fixture, {
    structureKey: COMMERCIAL_V8_STRUCTURE_KEYS[0],
  }),
);
const interna = renderToString(
  createElement(CommercialV8Fixture, {
    structureKey: COMMERCIAL_V8_STRUCTURE_KEYS[0],
    page: 'interna',
  }),
);
const navBlock = (html) =>
  html.match(/<div class="site-block"[^>]*data-block="nav\.bar"[^>]*>/)?.[0] ??
  '';

/**
 * A navegação sobreposta da Comercial v8 depende da abertura da página. O hero
 * fica dentro do `<main>` e a navegação fora, então nenhum seletor de irmão os
 * liga: uma regra escrita como `nav + hero` não casa em página alguma e a
 * sobreposição desaparece em silêncio, inclusive na home. O renderer resolve a
 * decisão e a publica; estes testes prendem os dois lados desse contrato.
 */
await test('o renderer publica a abertura do miolo na navegação', () => {
  assert.match(
    navBlock(home),
    /data-opening="hero\.split:brand"/,
    'a home abre na fachada e a navegação precisa anunciar isso',
  );
  assert.match(
    navBlock(interna),
    /data-opening="hero\.statement:framed"/,
    'a interna abre em hero.statement e não pode ser lida como fachada',
  );
});

await test('o miolo separa a navegação do hero por um <main>', () => {
  // O motivo de `data-opening` existir. Se um dia a navegação e o hero virarem
  // irmãos, a leitura por atributo continua correta — mas o teste acima deixa
  // de ser a única prova, e esta nota explica por que ele foi escrito.
  const ordem = [
    ...home.matchAll(
      /<main>|<div class="site-block"[^>]*data-block="([^"]+)"[^>]*data-layout="([^"]+)"/g,
    ),
  ].map((m) => (m[0] === '<main>' ? '<main>' : `${m[1]}:${m[2]}`));
  assert.deepEqual(ordem.slice(0, 3), [
    'nav.bar:bar',
    '<main>',
    'hero.split:brand',
  ]);
});

await test('o CSS da v8 lê a abertura publicada, não um irmão', async () => {
  const css = await readFile('app/(sites)/commercial.css', 'utf8');
  assert.match(
    css,
    /\.site-block\[data-block='nav\.bar'\]\[data-opening='hero\.split:brand'\]/,
    'a sobreposição precisa ser condicionada pela abertura publicada',
  );
  assert.doesNotMatch(
    css,
    /\+\s*\.site-block\[data-block='hero/,
    'alcançar o hero como irmão da navegação é impossível: o <main> os separa',
  );
});
