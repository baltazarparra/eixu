import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  jsx: { runtime: 'automatic' },
  fsCache: false,
});
const { SiteIcon } = await jiti.import('../lib/blocks/icon.tsx');
const { ICON_NAMES } = await jiti.import('../lib/design/iconography.ts');
const { DISPLAY_FONTS, BODY_FONTS, DISPLAY_TYPE, BODY_TYPE } =
  await jiti.import('../lib/design/typography.ts');
const { designProfileInputSchema, completeDesignProfile } = await jiti.import(
  '../lib/design/profile.ts',
);
const { laneIssues, VIBE_LANE } = await jiti.import('../lib/design/vibes.ts');
const { themeVars } = await jiti.import('../lib/blocks/theme.ts');
const {
  contrastRatio,
  mixOklabHex,
  oklchLightness,
  GLOW_LIGHT_FLOOR,
  GLOW_DARK_CEILING,
  GLOW_CONTRAST,
} = await jiti.import('../lib/blocks/contrast.ts');
const { blockSchemas } = await jiti.import('../lib/blocks/registry.ts');
const { lintPage } = await jiti.import('../lib/taste/lint.ts');
const { VisualSystemFixture, visualBlocks, visualTenant } = await jiti.import(
  './browser/fixtures/visual-system.tsx',
);

await test('todas as famílias atravessam schema, persistência e tokens, incluindo clientes legados', () => {
  for (const displayFont of DISPLAY_FONTS)
    for (const bodyFont of BODY_FONTS) {
      const fonts = designProfileInputSchema
        .pick({ displayFont: true, bodyFont: true })
        .parse({ displayFont, bodyFont });
      const design = completeDesignProfile({
        ...visualTenant('comercial').brand.design,
        ...fonts,
      });
      const vars = themeVars({ design });
      assert.equal(
        vars['--font-display'],
        `var(${DISPLAY_TYPE[displayFont].variable})`,
      );
      assert.equal(vars['--font-body'], `var(${BODY_TYPE[bodyFont].variable})`);
      assert.ok(Number(vars['--body-leading']) >= 1.5);
      assert.ok(!Object.values(vars).includes(undefined));
    }
  for (const [font, expected] of [
    ['sans', '--font-sans'],
    ['serif', '--font-serif'],
    ['mono', '--font-mono'],
  ]) {
    assert.equal(themeVars({ font })['--font-site'], `var(${expected})`);
  }
  assert.equal(
    designProfileInputSchema.shape.bodyFont.safeParse('condensed').success,
    false,
  );
});

await test('brilhos de fundo saem resolvidos, claros e medidos contra a tinta', () => {
  // Os valores vêm da tabela do estudo em
  // docs/archive/gradient-technique-plan-2026-09-13.md, medida sobre papel
  // branco e tinta #1f2937 com paletas de clientes reais.
  const ink = '#1f2937';
  for (const [accent, expected] of [
    ['#ffdd00', '#ffec93'],
    ['#b80505', '#f5cac3'],
    ['#1f6feb', '#bdd6fd'],
    ['#fffbeb', '#fffdf3'],
    // #c45c26 reprova no AA e accessibleAccent o escurece antes: o brilho sai
    // do acento efetivamente usado, não do hex cru do cadastro.
    ['#c45c26', '#efcdbe'],
  ]) {
    const vars = themeVars({ ink, paper: '#ffffff', accent });
    assert.equal(vars['--glow'], expected, accent);
    assert.match(vars['--glow'], /^#[0-9a-f]{6}$/);
    assert.ok(oklchLightness(vars['--glow']) >= GLOW_LIGHT_FLOOR, accent);
    assert.ok(contrastRatio(ink, vars['--glow']) >= GLOW_CONTRAST, accent);
    // O apoio é medido contra a parada mais forte, que é onde ele some.
    assert.ok(contrastRatio(vars['--muted-glow'], vars['--glow']) >= 4.5);
  }

  // Paleta do Skinão: o destaque vira o segundo brilho e a superfície chapada.
  const skinao = themeVars({
    ink,
    paper: '#ffffff',
    accent: '#ffdd00',
    highlight: '#b80505',
    accentAlt: '#fffbeb',
  });
  assert.equal(skinao['--glow-2'], '#f5cac3');
  assert.equal(
    skinao['--glow-2-flat'],
    mixOklabHex('#ffffff', skinao['--glow-2'], 0.4),
  );
  assert.ok(
    contrastRatio(skinao['--muted-glow-2'], skinao['--glow-2']) >= 4.5,
  );
  assert.ok(
    contrastRatio(skinao['--muted-glow-2-flat'], skinao['--glow-2-flat']) >=
      4.5,
  );
  // Clarear preserva croma; --accent-deep misturava com a tinta e sujava a cor.
  assert.equal(skinao['--accent-glow'], '#ffea88');
  assert.ok(
    contrastRatio(skinao['--accent-ink'], skinao['--accent-glow']) >= 4.5,
  );
  assert.equal(skinao['--accent-deep'], undefined);
  assert.equal(skinao['--wash'], undefined);
  assert.equal(skinao['--wash-2'], undefined);
  assert.equal(skinao['--muted-wash'], undefined);

  // Papel escuro tem teto de claridade, não piso: o brilho não pode clarear
  // até virar uma faixa branca no meio da vibe moderna.
  const darkPaper = themeVars({
    ink: '#fafafa',
    paper: '#101112',
    accent: '#1f6feb',
    accentAlt: '#b45309',
  });
  assert.ok(oklchLightness(darkPaper['--glow']) <= GLOW_DARK_CEILING);
  assert.ok(contrastRatio('#fafafa', darkPaper['--glow']) >= GLOW_CONTRAST);

  // Sem mistura legível o brilho devolve o papel e o fundo fica plano, como
  // já acontecia com a lavagem.
  const flat = themeVars({
    ink: '#808080',
    paper: '#ffffff',
    accent: '#f2f2f2',
    accentAlt: '#eeeeee',
  });
  assert.equal(flat['--glow'], '#ffffff');
  assert.equal(flat['--glow-2'], '#ffffff');

  // Nenhum token de fundo escurece em direção à tinta: o brilho da faixa de
  // conversão só clareia, e os brilhos de papel claro ficam acima do piso.
  for (const accent of ['#ffdd00', '#b80505', '#1f6feb', '#c45c26']) {
    const vars = themeVars({ ink, paper: '#ffffff', accent });
    assert.ok(
      oklchLightness(vars['--accent-glow']) >=
        oklchLightness(vars['--accent']),
      `--accent-glow escureceu com ${accent}`,
    );
  }
  for (const vars of [skinao, flat])
    for (const token of ['--glow', '--glow-2', '--glow-2-flat'])
      assert.ok(
        oklchLightness(vars[token]) >= GLOW_LIGHT_FLOOR,
        `${token} abaixo do piso de claridade`,
      );
});

await test('novos pares pertencem às vibes sem liberar serifas no moderno ou display no corpo', () => {
  for (const [vibe, lane] of Object.entries(VIBE_LANE)) {
    const input = {
      ...Object.fromEntries(
        Object.entries(lane.axes).map(([key, values]) => [key, values[0]]),
      ),
      radius: lane.radius[0],
      paper: vibe === 'moderno' ? '#101112' : '#ffffff',
      surface: vibe === 'moderno' ? '#18191a' : '#ffffff',
      ink: vibe === 'moderno' ? '#fafafa' : '#171717',
      ...Object.fromEntries(
        Object.entries(lane.dials).map(([key, range]) => [key, range[0]]),
      ),
    };
    for (const displayFont of lane.axes.displayFont)
      for (const bodyFont of lane.axes.bodyFont) {
        assert.deepEqual(
          laneIssues(vibe, { ...input, displayFont, bodyFont }),
          [],
        );
      }
    if (vibe === 'moderno')
      assert.ok(
        laneIssues(vibe, { ...input, displayFont: 'classic' }).some((issue) =>
          issue.startsWith('displayFont'),
        ),
      );
  }
});

await test('símbolos têm quatro desenhos no SSR e não criam controles sem nome', () => {
  const layers = new Set();
  for (const vibe of ['comercial', 'moderno', 'ousado', 'artistico']) {
    for (const name of ICON_NAMES) {
      const html = renderToStaticMarkup(
        createElement(SiteIcon, { name, vibe }),
      );
      assert.match(html, /<svg[^>]+focusable="false"/);
      assert.match(html, /aria-hidden="true"/);
      assert.match(html, /<path/);
      assert.doesNotMatch(html, /tabindex|onclick|<img/);
      if (name === 'layers') layers.add(html.slice(html.indexOf('<svg')));
    }
  }
  assert.equal(layers.size, 4);
});

await test('ícone passa pelo schema e pelo renderer em cada variante, sem aceitar SVG arbitrário', () => {
  for (const type of [
    'feature.numbered',
    'feature.bento',
    'feature.explorer',
    'narrative.split',
    'editorial.resources',
  ]) {
    const block = visualBlocks.find((block) => block.type === type);
    let layoutSchema = blockSchemas[type].shape.layout;
    if (!layoutSchema.options) layoutSchema = layoutSchema.unwrap();
    for (const vibe of ['comercial', 'moderno', 'ousado', 'artistico'])
      for (const layout of layoutSchema.options) {
        const props = blockSchemas[type].parse({
          ...block.props,
          layout,
          items: block.props.items.map((item) => ({ ...item, icon: 'leaf' })),
        });
        const html = renderToStaticMarkup(
          createElement(VisualSystemFixture, {
            vibe,
            blocks: [{ ...block, props }],
          }),
        );
        assert.match(html, /data-icon="leaf"/);
        assert.match(html, new RegExp(`data-icon-vibe="${vibe}"`));
        assert.ok(html.includes(props.items[0].title));
      }
    const invalid = blockSchemas[type].safeParse({
      ...block.props,
      items: block.props.items.map((item) => ({
        ...item,
        icon: '<svg onload=alert(1)>',
      })),
    });
    assert.equal(invalid.success, false);
    assert.equal(blockSchemas[type].safeParse(block.props).success, true);
  }
});

await test('omitir icon mantém conteúdo e ações sem acrescentar símbolos ou molduras vazias', () => {
  const blocks = visualBlocks.map((block) => ({
    ...block,
    props: {
      ...block.props,
      ...(Array.isArray(block.props.items)
        ? {
            items: block.props.items.map(({ icon: _icon, ...item }) => item),
          }
        : {}),
    },
  }));
  const html = renderToStaticMarkup(
    createElement(VisualSystemFixture, { blocks }),
  );
  assert.doesNotMatch(html, /data-icon="(?:book|camera|compass|layers|route)"/);
  assert.doesNotMatch(html, /site-resource-symbol|site-icon-heading/);
  assert.match(html, /Ambientes desenhados para aprender/);
  assert.match(html, /data-icon="plus"/);
  assert.match(html, /data-icon="arrow-up-right"/);
});

await test('pre-flight avisa sobre repetição no conteúdo, preservando controles e prioridade da foto', () => {
  const service = visualBlocks.find(
    (block) => block.type === 'feature.numbered',
  );
  const bento = visualBlocks.find((block) => block.type === 'feature.bento');
  const page = (blocks) => ({
    blocks,
    type: 'page',
    title: 'Estudo',
    seo: {},
  });
  const repeated = {
    ...service,
    props: {
      ...service.props,
      items: service.props.items.map((item) => ({ ...item, icon: 'leaf' })),
    },
  };
  const warning = lintPage(page([repeated])).filter(
    (finding) => finding.rule === 'icones-repetidos',
  );
  assert.equal(warning.length, 1);
  assert.equal(warning[0].level, 'warn');
  assert.match(warning[0].message, /3 itens/);

  const adjacent = {
    ...bento,
    props: {
      ...bento.props,
      items: bento.props.items.map((item, index) => ({
        ...item,
        icon: index ? 'tools' : 'leaf',
      })),
    },
  };
  assert.ok(
    lintPage(page([service, adjacent])).some(
      (finding) => finding.rule === 'icones-repetidos',
    ),
  );
  const withPhoto = {
    ...adjacent,
    props: {
      ...adjacent.props,
      items: adjacent.props.items.map((item) => ({
        ...item,
        image: 'https://assets.test/one.svg',
      })),
    },
  };
  assert.equal(
    lintPage(page([service, withPhoto])).some(
      (finding) => finding.rule === 'icones-repetidos',
    ),
    false,
  );
  const html = renderToStaticMarkup(
    createElement(VisualSystemFixture, { blocks: [withPhoto] }),
  );
  assert.doesNotMatch(html, /data-icon=/);
  const controls = visualBlocks.filter((block) =>
    ['faq.accordion', 'pricing.table', 'form.lead'].includes(block.type),
  );
  assert.equal(
    lintPage(page(controls)).some(
      (finding) => finding.rule === 'icones-repetidos',
    ),
    false,
  );
});
