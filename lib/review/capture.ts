import sharp from 'sharp';

export type Shot = {
  page: string;
  viewport: 'desktop' | 'mobile';
  width: number;
  scrollWidth: number;
  overflow: boolean;
  brokenImages: number;
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

/**
 * Chromium na função. Em produção vem do pacote serverless; em máquina de
 * desenvolvimento usa o Chrome instalado, apontado por EIXU_CHROME_PATH.
 */
async function launch() {
  const puppeteer = await import('puppeteer-core');
  const local = process.env.EIXU_CHROME_PATH;
  if (local)
    return puppeteer.launch({
      executablePath: local,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
    });
  const chromium = (await import('@sparticuz/chromium')).default;
  return puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: chromium.args,
    defaultViewport: null,
    headless: true,
  });
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
  const browser = await launch();
  const shots: Shot[] = [];
  const failures: CaptureFailure[] = [];
  let completed = 0;
  let cursor = 0;

  try {
    const parsedOrigin = new URL(origin);
    const session = options.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('eixu_admin='))
      ?.slice('eixu_admin='.length);
    if (session)
      await browser.defaultBrowserContext().setCookie({
        name: 'eixu_admin',
        value: session,
        domain: parsedOrigin.hostname,
        path: '/',
        httpOnly: true,
        secure: parsedOrigin.protocol === 'https:',
        sameSite: 'Strict',
      });

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
        const jpeg = await sharp(raw)
          .resize({
            width: viewport.name === 'desktop' ? 1200 : 390,
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toBuffer();
        return {
          page: `/${slug}`,
          viewport: viewport.name,
          width: viewport.width,
          scrollWidth: measured.scrollWidth,
          overflow: measured.scrollWidth > measured.innerWidth + 2,
          brokenImages: measured.brokenImages,
          jpeg,
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
