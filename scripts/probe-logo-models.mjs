// Sonda paga explícita, com referências sintéticas e arquivos apenas locais.
import { mkdir, writeFile } from 'node:fs/promises';
import { generateImage } from 'ai';
import sharp from 'sharp';
import { createJiti } from 'jiti';
if (!process.argv.includes('--live')) {
  console.log(
    'Use --live [--reading-only | --images-only]. Ensaio completo: 4 gerações de imagem, leituras em 5 logos por 2 modelos e críticas. Somente logos sintéticos, sem banco/Blob.',
  );
  process.exit(0);
}
const jiti = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { cleanLogo, alphaBounds } = await jiti.import(
  '../lib/images/logo-asset.ts',
);
const { logoPrecheck, critiqueLogo } = await jiti.import(
  '../lib/images/logo-critic.ts',
);
const { readLogo } = await jiti.import('../lib/images/logo-read.ts');
const { composeLogoPrompt } = await jiti.import('../lib/images/logo.ts');
const dir = `outputs/logo-studio/probe-${Date.now()}`;
await mkdir(dir, { recursive: true });
const report = {
  createdAt: new Date().toISOString(),
  scope: 'Logos sintéticos; sem Neon, Blob ou publicação.',
  directory: dir,
  readings: [],
  images: [],
};
const save = () =>
  writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2) + '\n');
const names = ['MIRA', 'VÉRTICE', 'LINHA 8', 'CASA UNA', 'NORTE'];
const fixtures = [];
for (const [i, name] of names.entries()) {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540"><rect width="900" height="540" fill="white"/><path d="M100 210h100v120H100z M120 230v80h60v-80z" fill="#214a56" fill-rule="evenodd"/><text x="240" y="310" font-family="DejaVu Sans" font-size="${name.length > 6 ? 76 : 100}" font-weight="${i % 2 ? 'normal' : 'bold'}" fill="#214a56">${name}</text></svg>`,
  );
  const source = await sharp(svg).jpeg({ quality: 95 }).toBuffer();
  const { master } = await cleanLogo(source);
  fixtures.push({ name, master });
  await writeFile(`${dir}/fixture-${i}.jpg`, source);
  await writeFile(`${dir}/reference-${i}.png`, master);
}
if (!process.argv.includes('--images-only')) {
  for (const model of [
    'google/gemini-3.8-flash',
    'anthropic/claude-sonnet-5',
  ]) {
    for (const fixture of fixtures) {
      const started = Date.now();
      let failure;
      const reading = await readLogo(fixture.master, {
        model,
        onError: (error) => {
          failure =
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'Falha na leitura';
        },
      });
      report.readings.push({
        model,
        expected: fixture.name,
        reading,
        error: failure,
        exact: reading?.nome_lido === fixture.name,
        durationMs: Date.now() - started,
      });
      console.log(JSON.stringify(report.readings.at(-1)));
      await save();
    }
  }
}
if (!process.argv.includes('--reading-only')) {
  const tenant = { name: 'MIRA', brand: { accent: '#214a56', ink: '#214a56' } };
  const text = composeLogoPrompt({
    tenant,
    guide: {},
    brandName: 'MIRA',
    wordmark: true,
    variant: 'fiel',
  });
  const settings = [
    { model: 'openai/gpt-image-2', fidelity: false },
    { model: 'openai/gpt-image-2', fidelity: true },
    { model: 'openai/gpt-image-2.5-flare', fidelity: false },
    { model: 'openai/gpt-image-2.5-sunburst', fidelity: false },
  ];
  for (const [index, setting] of settings.entries()) {
    const started = Date.now();
    try {
      const result = await generateImage({
        model: setting.model,
        prompt: { text, images: [fixtures[0].master] },
        size: '1536x1024',
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(180_000),
        providerOptions: {
          openai: {
            background: 'transparent',
            output_format: 'png',
            ...(setting.fidelity ? { input_fidelity: 'high' } : {}),
          },
        },
      });
      const durationMs = Date.now() - started;
      const bytes = Buffer.from(result.image.uint8Array);
      await writeFile(`${dir}/model-${index}.png`, bytes);
      await writeFile(
        `${dir}/model-${index}-response.json`,
        JSON.stringify(
          {
            ...setting,
            durationMs,
            warnings: result.warnings,
            originalBytes: bytes.length,
          },
          null,
          2,
        ),
      );
      const clean = await cleanLogo(bytes);
      await writeFile(`${dir}/model-${index}-clean.png`, clean.master);
      const raw = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const box = alphaBounds({
        data: raw.data,
        width: raw.info.width,
        height: raw.info.height,
      });
      const critique = await critiqueLogo({
        id: 'synthetic-probe',
        persist: false,
        bytes: new Uint8Array(clean.master),
        variant: 'fiel',
        mode: 'modernizar',
        brandName: 'MIRA',
        wordmark: true,
        reference: fixtures[0].master,
      });
      report.images.push({
        ...setting,
        durationMs,
        warnings: result.warnings,
        precheck: await logoPrecheck(bytes),
        bboxFraction: box
          ? (box.width * box.height) / (raw.info.width * raw.info.height)
          : 0,
        originalBytes: bytes.length,
        cleanBytes: clean.master.length,
        cleanWidth: clean.width,
        cleanHeight: clean.height,
        critique,
      });
      // Mesma imagem e referência para comparar fidelidade dos dois leitores.
      if (index === 0 && !process.argv.includes('--images-only')) {
        report.fidelityComparison = [];
        for (const model of [
          'google/gemini-3.8-flash',
          'anthropic/claude-sonnet-5',
        ]) {
          const critique = await critiqueLogo({
            id: 'synthetic-probe',
            persist: false,
            model,
            bytes: new Uint8Array(clean.master),
            variant: 'fiel',
            mode: 'modernizar',
            brandName: 'MIRA',
            wordmark: true,
            reference: fixtures[0].master,
          });
          report.fidelityComparison.push({ model, critique });
        }
      }
    } catch (error) {
      report.images.push({
        ...setting,
        durationMs: Date.now() - started,
        error:
          error instanceof Error
            ? error.message.slice(0, 240)
            : 'Falha na sonda',
      });
    }
    console.log(JSON.stringify(report.images.at(-1)));
    await save();
  }
}
await save();
console.log(`Relatório: ${dir}/report.json`);
