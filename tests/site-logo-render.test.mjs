import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
import { logoAssetFor } from './helpers/logo-fixture.mjs';
const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
});
const { NavBar, FooterCompact } = await jiti.import(
  '../lib/blocks/components.tsx',
);
const { logoFor, logoImage } = await jiti.import('../lib/blocks/theme.ts');
const source = 'https://assets.test/original.png';
const ctx = (brand) => ({
  tenant: {
    id: 'demo',
    slug: 'demo',
    name: 'Marca',
    brand,
    dials: {},
    contacts: {},
  },
  pagePath: '/',
  isPreview: false,
});

await test('nav e rodapé emitem PNG e dimensões proporcionais; override e legado continuam válidos', () => {
  const asset = logoAssetFor(source, 3);
  const brand = { logoUrl: source, logoAsset: asset };
  assert.equal(logoFor(brand), source);
  assert.equal(logoImage(brand).src, asset.nav.url);
  const render = (component, extra = {}, client = brand) =>
    renderToStaticMarkup(
      createElement(component, {
        logoText: 'Marca',
        links: [],
        ctx: ctx(client),
        ...extra,
      }),
    );
  const nav = render(NavBar);
  assert.match(nav, /width="144" height="48"/);
  assert.match(nav, /--logo-height:48px/);
  assert.match(nav, new RegExp(asset.nav.url.replaceAll('.', '\\.')));
  assert.match(render(NavBar, { logoHeight: 100 }), /width="300" height="100"/);
  assert.match(render(FooterCompact), /width="108" height="36"/);
  const stale = { ...brand, logoUrl: 'https://assets.test/changed.png' };
  assert.equal(logoImage(stale).displayHeight, 48);
  assert.equal(logoImage(stale).src, stale.logoUrl);
  assert.match(render(NavBar, {}, stale), /--logo-height:48px/);
  assert.doesNotMatch(render(NavBar, {}, stale), /width="160"/);
});
