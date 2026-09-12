import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createJiti } from 'jiti';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const sharp = require('sharp');
const j = createJiti(import.meta.url, { alias: { '@': process.cwd() } });
const { measureLogoFit } = await j.import('../lib/images/logo-measure.ts');
const { logoSurfaceIssue, logoFindings } = await j.import(
  '../lib/images/logo-fit.ts',
);
const { deriveWhiteLogo } = await j.import('../lib/images/logo-white.ts');
const { logoFor, surfaceOf } = await j.import('../lib/blocks/theme.ts');

const DARK = '#0b0e14';
const LIGHT = '#ffffff';
const W = 200;
const H = 120;

const solid = (width, height, background) =>
  sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toBuffer();

/** Base transparente com as camadas dadas; alfa real. */
async function layered(layers) {
  const inputs = await Promise.all(
    layers.map(async ([width, height, color, left, top]) => ({
      input: await solid(width, height, color),
      left,
      top,
    })),
  );
  return sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(inputs)
    .png()
    .toBuffer();
}

/** Arquivo sem alfa: tudo composto sobre a cor de fundo. */
async function flat(background, layers, format = 'png') {
  const base = sharp(await layered(layers)).flatten({ background });
  return format === 'jpeg' ? base.jpeg().toBuffer() : base.png().toBuffer();
}

const fixtures = {
  // Placa branca com texto preto: o caso da captura do operador.
  plateWhite: () => flat(LIGHT, [[120, 40, '#111111', 40, 40]]),
  plateWhiteJpeg: () => flat(LIGHT, [[120, 40, '#111111', 40, 40]], 'jpeg'),
  // Placa branca desenhada dentro de um PNG com margem transparente.
  plateWhiteAlpha: () =>
    layered([
      [180, 100, LIGHT, 10, 10],
      [120, 40, '#111111', 40, 40],
    ]),
  // Retângulo vermelho com texto vazado: é a marca, serve em qualquer papel.
  plateColored: () =>
    layered([
      [160, 80, '#d1261a', 20, 20],
      [120, 24, LIGHT, 40, 48],
    ]),
  darkInk: () => layered([[120, 40, '#111111', 40, 40]]),
  // Duas formas: um retângulo claro sólido é, por construção, uma placa clara.
  lightInk: () =>
    layered([
      [60, 40, '#f5f5f5', 40, 40],
      [40, 40, '#f5f5f5', 120, 40],
    ]),
  allWhite: () => flat(LIGHT, []),
  darkPlate: () => flat('#101010', [[120, 24, LIGHT, 40, 48]]),
};

async function pixel(png, x, y) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

async function allOpaquePixelsAreWhite(png) {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels)
    if (data[i + 3] >= 16 && (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250))
      return false;
  return true;
}

await test('a medição reconhece placa, tinta escura e tinta clara', async () => {
  const plate = await measureLogoFit(await fixtures.plateWhite(), 'u');
  assert.equal(plate.hasAlpha, false);
  assert.equal(plate.plate, 'light');
  assert.equal(plate.transparentFraction, 0);
  assert.equal((await measureLogoFit(await fixtures.plateWhiteJpeg(), 'u')).plate, 'light');
  assert.equal((await measureLogoFit(await fixtures.plateWhiteAlpha(), 'u')).plate, 'light');

  const colored = await measureLogoFit(await fixtures.plateColored(), 'u');
  assert.equal(colored.hasAlpha, true);
  assert.equal(colored.plate, null);
  assert.ok(colored.lightFraction > 0.15, String(colored.lightFraction));

  const dark = await measureLogoFit(await fixtures.darkInk(), 'u');
  assert.equal(dark.plate, null);
  assert.ok(dark.opaqueLuminance < 0.05);
  assert.equal(dark.lightFraction, 0);
  assert.ok(dark.transparentFraction > 0.7);

  const light = await measureLogoFit(await fixtures.lightInk(), 'u');
  assert.ok(light.opaqueLuminance > 0.9);
  assert.equal(light.darkFraction, 0);

  const darkPlate = await measureLogoFit(await fixtures.darkPlate(), 'u');
  assert.equal(darkPlate.plate, 'dark');

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="40" y="40" width="120" height="40" fill="#111"/></svg>`,
  );
  const vector = await measureLogoFit(svg, 'u');
  assert.equal(vector.hasAlpha, true);
  assert.equal(vector.plate, null);
});

await test('o problema depende da superfície: placa e tinta escura no escuro, tinta clara no claro', async () => {
  const plate = await measureLogoFit(await fixtures.plateWhite(), 'u');
  const colored = await measureLogoFit(await fixtures.plateColored(), 'u');
  const dark = await measureLogoFit(await fixtures.darkInk(), 'u');
  const light = await measureLogoFit(await fixtures.lightInk(), 'u');
  const darkPlate = await measureLogoFit(await fixtures.darkPlate(), 'u');
  assert.equal(logoSurfaceIssue(plate, DARK), 'placa-clara-em-fundo-escuro');
  assert.equal(logoSurfaceIssue(plate, LIGHT), null);
  assert.equal(logoSurfaceIssue(colored, DARK), null);
  assert.equal(logoSurfaceIssue(colored, LIGHT), null);
  assert.equal(logoSurfaceIssue(dark, DARK), 'tinta-escura-em-fundo-escuro');
  assert.equal(logoSurfaceIssue(dark, LIGHT), null);
  assert.equal(logoSurfaceIssue(light, LIGHT), 'tinta-clara-em-fundo-claro');
  assert.equal(logoSurfaceIssue(light, DARK), null);
  assert.equal(logoSurfaceIssue(darkPlate, LIGHT), 'placa-escura-em-fundo-claro');
});

await test('a versão branca recorta pela luminância e preserva o texto vazado', async () => {
  // Placa branca sem alfa: a placa some e o texto vira branco.
  const plate = await deriveWhiteLogo(await fixtures.plateWhite());
  assert.ok(plate);
  assert.ok(plate.coverage > 0.15 && plate.coverage < 0.25, String(plate.coverage));
  assert.deepEqual(await pixel(plate.png, 100, 60), [255, 255, 255, 255]);
  assert.equal((await pixel(plate.png, 5, 5))[3], 0);
  assert.ok(await allOpaquePixelsAreWhite(plate.png));

  // Placa colorida: a placa vira branca e o texto continua vazado.
  const colored = await deriveWhiteLogo(await fixtures.plateColored());
  assert.ok(colored);
  assert.deepEqual(await pixel(colored.png, 30, 30), [255, 255, 255, 255]);
  assert.equal((await pixel(colored.png, 100, 60))[3], 0);
  assert.equal((await pixel(colored.png, 5, 5))[3], 0);

  // Tinta escura sobre transparente vira tinta branca inteira.
  const dark = await deriveWhiteLogo(await fixtures.darkInk());
  assert.ok(dark);
  assert.ok(dark.coverage > 0.99, String(dark.coverage));

  // Sem arte escura não há versão; um bloco escuro sem alfa viraria um retângulo.
  assert.equal(await deriveWhiteLogo(await fixtures.allWhite()), null);
  assert.equal(await deriveWhiteLogo(await fixtures.darkPlate()), null);
});

await test('o achado do logo usa o papel real do cabeçalho e some com a versão escura', async () => {
  const logoUrl = 'https://blob.test/tenants/x/logo/1-logo.png';
  const fit = await measureLogoFit(await fixtures.plateWhite(), logoUrl);
  const home = (nav = {}, footer = {}) => [
    {
      slug: '',
      blocks: [
        { type: 'nav.bar', props: nav },
        { type: 'footer.compact', props: footer },
      ],
    },
  ];
  const darkBrand = { logoUrl, logoFit: fit, paper: DARK, ink: '#f5f5f4' };
  const findings = logoFindings(darkBrand, home(), []);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'logo-fundo-escuro');
  assert.equal(findings[0].level, 'warn');
  assert.match(findings[0].message, /cabeçalho e no rodapé escuro/);
  assert.match(findings[0].message, /fundo transparente/);

  // Com a versão branca na biblioteca, o aviso cita o número dela.
  const white = {
    seq: 7,
    kind: 'logo',
    status: 'disponivel',
    url: 'https://blob.test/tenants/x/logo/b/branca.png',
    referenceUrls: [logoUrl],
  };
  assert.match(logoFindings(darkBrand, home(), [white])[0].message, /#7/);
  // Aplicada, o aviso some.
  assert.deepEqual(
    logoFindings({ ...darkBrand, logoDarkUrl: white.url }, home(), [white]),
    [],
  );
  // Papel claro: só o cabeçalho em tom ink é escuro.
  const lightBrand = { ...darkBrand, paper: LIGHT, ink: '#14161a' };
  assert.deepEqual(logoFindings(lightBrand, home(), []), []);
  const inkNav = logoFindings(
    lightBrand,
    home({ presentation: { tone: 'ink' } }),
    [],
  );
  assert.equal(inkNav.length, 1);
  assert.match(inkNav[0].message, /^No cabeçalho escuro/);
  // Medição de outro logo não vale para o atual.
  assert.deepEqual(
    logoFindings({ ...darkBrand, logoUrl: 'https://blob.test/outro.png' }, home(), []),
    [],
  );
});

await test('nav e rodapé escolhem a versão do logo pelo papel da seção', () => {
  const brand = {
    logoUrl: 'https://blob.test/logo.png',
    logoDarkUrl: 'https://blob.test/branca.png',
    paper: DARK,
    ink: '#f5f5f4',
    accent: '#5b63d6',
  };
  assert.equal(logoFor(brand), brand.logoDarkUrl);
  assert.equal(logoFor(brand, { background: LIGHT }), brand.logoUrl);
  const light = { ...brand, paper: LIGHT, ink: '#14161a' };
  assert.equal(logoFor(light), light.logoUrl);
  assert.equal(logoFor(light, { tone: 'ink' }), light.logoDarkUrl);
  assert.equal(logoFor(light, { tone: 'accent' }), light.logoDarkUrl);
  assert.equal(logoFor({ ...light, logoDarkUrl: undefined }, { tone: 'ink' }), light.logoUrl);
  assert.equal(surfaceOf(light, 'soft'), '#f6f6f6');
  assert.equal(surfaceOf({ ...light, surface: '#eeeeee' }, 'soft'), '#eeeeee');
  assert.equal(logoFor({}), undefined);
});
