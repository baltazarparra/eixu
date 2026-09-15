import { inspectNavigation, type NavigationMeasurement } from './navigation';
import { inspectText, type TextInspection } from './text';

export type Shot = {
  page: string;
  viewport: 'desktop' | 'mobile';
  width: number;
  scrollWidth: number;
  overflow: boolean;
  brokenImages: number;
  text: TextInspection;
  navigation?: NavigationMeasurement;
  menuJpeg?: Buffer;
  jpeg: Buffer;
};

export type CaptureProgress = {
  page: string;
  viewport: Shot['viewport'];
  completed: number;
  total: number;
};

export type CaptureFailure = {
  page: string;
  viewport: Shot['viewport'];
  message: string;
};

/** Mantém as capturas boas disponíveis quando só um alvo falha. */
export class CaptureBatchError extends Error {
  constructor(
    message: string,
    readonly shots: Shot[],
    readonly failures: CaptureFailure[],
  ) {
    super(message);
    this.name = 'CaptureBatchError';
  }
}

const VIEWPORTS = [
  { name: 'desktop' as const, width: 1440, height: 900 },
  { name: 'mobile' as const, width: 390, height: 844 },
];

export type EditedBlockSurface = {
  blockId: string;
  found: boolean;
  backgroundColor?: string;
  backgroundImage?: string;
  minimumContrast?: number;
  unmeasurableTexts: number;
  visibleTexts: number;
  textAlignments?: string[];
  contentAlignments?: string[];
  alignmentMismatches?: string[];
};

export type VisualEditMeasurement = {
  status: 'complete' | 'disabled' | 'unavailable';
  ok: boolean;
  issues: string[];
  viewports: {
    viewport: 'desktop' | 'mobile';
    width: number;
    blocks: EditedBlockSurface[];
  }[];
};

/**
 * Chromium na função. Em produção vem do pacote serverless; em máquina de
 * desenvolvimento usa o Chrome instalado, apontado por EIXU_CHROME_PATH.
 */
export async function launchBrowser(extraArgs: string[] = []) {
  const puppeteer = await import('puppeteer-core');
  const local = process.env.EIXU_CHROME_PATH;
  if (local)
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        ...extraArgs,
      ],
    });
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, ...extraArgs],
    defaultViewport: null,
    headless: true,
  });
}

async function setPreviewSession(
  browser: Awaited<ReturnType<typeof launchBrowser>>,
  origin: string,
  cookie?: string,
) {
  const parsedOrigin = new URL(origin);
  const session = cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('eixu_admin='))
    ?.slice('eixu_admin='.length);
  if (!session) return;
  await browser.defaultBrowserContext().setCookie({
    name: 'eixu_admin',
    value: session,
    domain: parsedOrigin.hostname,
    path: '/',
    httpOnly: true,
    secure: parsedOrigin.protocol === 'https:',
    sameSite: 'Strict',
  });
}

/**
 * Confere somente os blocos alterados, sem screenshot nem chamada de modelo.
 * O retorno contém CSS computado e contraste de texto, nunca pixels.
 */
export async function measureEditedBlocks(
  origin: string,
  tenant: string,
  slug: string,
  blockIds: string[],
  options: Pick<CaptureOptions, 'cookie'> = {},
): Promise<VisualEditMeasurement> {
  const targets = [...new Set(blockIds)];
  const browser = await launchBrowser();
  const issues: string[] = [];
  const viewports: VisualEditMeasurement['viewports'] = [];
  try {
    await setPreviewSession(browser, origin, options.cookie);
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage();
      try {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
        });
        await page.emulateMediaFeatures([
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ]);
        const path = slug ? `/${slug}` : '';
        const url = `${origin}/s/${tenant}${path}?preview=1&__tenant=${tenant}`;
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 25_000,
        });
        if (!response?.ok())
          throw new Error(
            'A prévia não pôde ser aberta para medir a edição. Confira a sessão e a página.',
          );
        await page.waitForSelector('.site-theme', { timeout: 8000 });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        });
        const surfaces = (await page.evaluate((ids) => {
          return ids.map((blockId) => {
            const root = document.querySelector<HTMLElement>(
              `[data-block-id="${CSS.escape(blockId)}"]`,
            );
            if (!root)
              return {
                blockId,
                found: false,
                visibleTexts: 0,
                unmeasurableTexts: 0,
              };
            const structural = root.querySelector<HTMLElement>(
              '.site-explorer-panel, .site-proof-strip-numbers, .site-facts-ledger dl',
            );
            const candidates = [
              root,
              root.firstElementChild instanceof HTMLElement
                ? root.firstElementChild
                : undefined,
              structural,
            ].filter((element): element is HTMLElement => Boolean(element));
            const surface =
              candidates.find((element) => {
                const candidate = getComputedStyle(element);
                return (
                  candidate.backgroundImage !== 'none' ||
                  !['transparent', 'rgba(0, 0, 0, 0)'].includes(
                    candidate.backgroundColor,
                  )
                );
              }) ?? root;
            const style = getComputedStyle(surface);
            const alignmentMismatches: string[] = [];
            const textAlignments = new Set<string>();
            const blockTextAlign = root.dataset.textAlign;
            const textNodes = blockTextAlign
              ? [
                  ...root.querySelectorAll<HTMLElement>(
                    'h1, h2, h3, h4, p, blockquote, figcaption, dt, dd, summary, li',
                  ),
                ].filter((node) => node.closest('[data-text-align]') === root)
              : [];
            const fieldNodes = [
              ...root.querySelectorAll<HTMLElement>('[data-text-align]'),
            ];
            for (const node of [...textNodes, ...fieldNodes]) {
              const expected = node.dataset.textAlign ?? blockTextAlign;
              if (!expected) continue;
              const actual = getComputedStyle(node).textAlign;
              textAlignments.add(actual);
              if (actual !== expected)
                alignmentMismatches.push(
                  `texto esperado ${expected}, renderizado ${actual}`,
                );
            }
            const contentAlignments = new Set<string>();
            const contentAlign = root.dataset.contentAlign;
            if (contentAlign) {
              const expected = {
                start: 'flex-start',
                center: 'center',
                end: 'flex-end',
              }[contentAlign];
              for (const node of root.querySelectorAll<HTMLElement>(
                '.site-hero-copy, .site-landing-hero-copy, .site-signature-copy, .site-cta-copy, .site-resource-copy, .site-showcase-copy',
              )) {
                const actual = getComputedStyle(node).alignItems;
                contentAlignments.add(`items:${actual}`);
                if (expected && actual !== expected)
                  alignmentMismatches.push(
                    `grupo esperado ${expected}, renderizado ${actual}`,
                  );
              }
              for (const node of root.querySelectorAll<HTMLElement>(
                '.site-actions, .site-landing-actions, .site-hero-bullets, .site-landing-badges',
              )) {
                const actual = getComputedStyle(node).justifyContent;
                contentAlignments.add(`controls:${actual}`);
                if (expected && actual !== expected)
                  alignmentMismatches.push(
                    `controles esperados ${expected}, renderizados ${actual}`,
                  );
              }
            }
            return {
              blockId,
              found: true,
              backgroundColor: style.backgroundColor,
              backgroundImage: style.backgroundImage,
              visibleTexts: 0,
              unmeasurableTexts: 0,
              textAlignments: [...textAlignments],
              contentAlignments: [...contentAlignments],
              alignmentMismatches: [...new Set(alignmentMismatches)],
            };
          });
        }, targets)) as EditedBlockSurface[];
        const text = await inspectText(
          page,
          { page: `/${slug}`, viewport: viewport.name },
          { contrast: true, blockIds: targets },
        );
        for (const surface of surfaces) {
          const samples = text.contrasts.filter((sample) =>
            sample.selector.startsWith(`[data-block-id="${surface.blockId}"]`),
          );
          const measurable = samples.filter((sample) => sample.measurable);
          surface.visibleTexts = samples.length;
          surface.unmeasurableTexts = samples.length - measurable.length;
          surface.minimumContrast = measurable.length
            ? Math.min(...measurable.map((sample) => sample.ratio))
            : undefined;
          if (!surface.found)
            issues.push(
              `Bloco ${surface.blockId} não encontrado na prévia em ${viewport.width} px.`,
            );
          for (const mismatch of surface.alignmentMismatches ?? [])
            issues.push(
              `Alinhamento divergente em ${viewport.width} px no bloco ${surface.blockId}: ${mismatch}.`,
            );
          for (const sample of samples.filter(
            (item) => item.measurable && item.ratio < 4.5,
          ))
            issues.push(
              `"${sample.text.slice(0, 60)}" com contraste ${sample.ratio.toFixed(1).replace('.', ',')}:1 sobre o fundo renderizado em ${viewport.width} px no bloco ${surface.blockId}.`,
            );
          for (const sample of samples.filter((item) => !item.measurable))
            issues.push(
              `"${sample.text.slice(0, 60)}" está sobre uma imagem que não pode ter contraste provado sem pixels em ${viewport.width} px no bloco ${surface.blockId}.`,
            );
        }
        viewports.push({
          viewport: viewport.name,
          width: viewport.width,
          blocks: surfaces,
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return {
    status: 'complete',
    ok: issues.length === 0,
    issues: [...new Set(issues)],
    viewports,
  };
}

type CaptureOptions = {
  cookie?: string;
  maxPages?: number;
  /** Duas páginas equilibram latência e memória na função serverless. */
  concurrency?: number;
  /** Repete somente o viewport que falhou. */
  retries?: number;
  onProgress?: (progress: CaptureProgress) => void | Promise<void>;
};

/**
 * Renderiza o rascunho e devolve o que a página realmente virou. As páginas
 * usam o mesmo browser, duas por vez, e cada viewport tem recuperação local.
 */
export async function capturePages(
  origin: string,
  tenant: string,
  slugs: string[],
  options: CaptureOptions = {},
): Promise<Shot[]> {
  const targets = [...new Set(slugs)].slice(0, options.maxPages ?? 12);
  const total = targets.length * VIEWPORTS.length;
  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? 2, targets.length || 1),
  );
  const retries = Math.max(0, Math.min(options.retries ?? 1, 2));
  const browser = await launchBrowser();
  const shots: Shot[] = [];
  const failures: CaptureFailure[] = [];
  let completed = 0;
  let cursor = 0;

  try {
    await setPreviewSession(browser, origin, options.cookie);

    const captureViewport = async (
      slug: string,
      viewport: (typeof VIEWPORTS)[number],
    ): Promise<Shot> => {
      const page = await browser.newPage();
      try {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
        });
        await page.emulateMediaFeatures([
          { name: 'prefers-reduced-motion', value: 'reduce' },
        ]);
        const url = `${origin}/s/${tenant}/${slug}?preview=1&__tenant=${tenant}`;
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 25_000,
        });
        if (!response?.ok())
          throw new Error(
            'A prévia não pôde ser aberta para revisão. Confira a sessão e a página.',
          );
        await page.waitForSelector('.site-theme', { timeout: 8000 });
        // Rola até o fim para disparar lazy loading e as entradas de seção.
        await page.evaluate(async () => {
          await document.fonts.ready;
          const step = window.innerHeight;
          for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await new Promise((resolve) => setTimeout(resolve, 120));
          }
          await Promise.all(
            [...document.querySelectorAll('img')].map((image) =>
              image.decode().catch(() => undefined),
            ),
          );
          // O CSS usa rolagem suave. Capturar durante o retorno deslocava
          // barras fixas sobre o conteúdo e gerava defeitos visuais falsos.
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise((resolve) => setTimeout(resolve, 250));
        });
        await page.waitForFunction(() => window.scrollY === 0);
        const measured = (await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          brokenImages: [...document.querySelectorAll('img')].filter(
            (image) => image.complete && image.naturalWidth === 0,
          ).length,
        }))) as {
          scrollWidth: number;
          innerWidth: number;
          brokenImages: number;
        };
        const raw = Buffer.from(
          await page.screenshot({ fullPage: true, type: 'png' }),
        );
        const sharp = (await import('sharp')).default;
        const jpeg = await sharp(raw)
          .resize({
            width: viewport.name === 'desktop' ? 1200 : 390,
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        const navigation = await inspectNavigation(page);
        const text = await inspectText(page, {
          page: `/${slug}`,
          viewport: viewport.name,
        });
        return {
          page: `/${slug}`,
          viewport: viewport.name,
          width: viewport.width,
          scrollWidth: measured.scrollWidth,
          overflow: measured.scrollWidth > measured.innerWidth + 2,
          brokenImages: measured.brokenImages,
          text,
          jpeg,
          ...navigation,
        };
      } finally {
        await page.close();
      }
    };

    const worker = async () => {
      while (cursor < targets.length) {
        const slug = targets[cursor++];
        for (const viewport of VIEWPORTS) {
          let lastError: unknown;
          for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
              shots.push(await captureViewport(slug, viewport));
              lastError = undefined;
              break;
            } catch (error) {
              lastError = error;
            }
          }
          if (lastError)
            failures.push({
              page: `/${slug}`,
              viewport: viewport.name,
              message:
                lastError instanceof Error
                  ? lastError.message.slice(0, 240)
                  : 'Falha inesperada na captura.',
            });
          completed += 1;
          await options.onProgress?.({
            page: `/${slug}`,
            viewport: viewport.name,
            completed,
            total,
          });
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    await browser.close();
  }

  shots.sort(
    (a, b) =>
      a.page.localeCompare(b.page) ||
      VIEWPORTS.findIndex((item) => item.name === a.viewport) -
        VIEWPORTS.findIndex((item) => item.name === b.viewport),
  );
  if (failures.length)
    throw new CaptureBatchError(
      `${failures.length} captura(s) não completaram após a repetição local. Primeira falha: ${failures[0].message}`,
      shots,
      failures,
    );
  return shots;
}
