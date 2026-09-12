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

const VIEWPORTS = [
  { name: 'desktop' as const, width: 1440, height: 900 },
  { name: 'mobile' as const, width: 390, height: 844 },
];

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

/**
 * Renderiza o rascunho e devolve o que a página realmente virou. O crítico de
 * imagem olha a foto isolada; ninguém olhava a composição montada.
 */
export async function capturePages(
  origin: string,
  tenant: string,
  slugs: string[],
  options: { cookie?: string; maxPages?: number } = {},
): Promise<Shot[]> {
  const targets = [...new Set(slugs)].slice(0, options.maxPages ?? 12);
  const browser = await launchBrowser();
  const shots: Shot[] = [];
  try {
    for (const slug of targets) {
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
          // O header Cookie global também iria para fotos de outros domínios.
          // O cookie jar limita a sessão ao host da prévia e ignora os demais.
          const session = options.cookie
            ?.split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('eixu_admin='))
            ?.slice('eixu_admin='.length);
          if (session)
            await page.browserContext().setCookie({
              name: 'eixu_admin',
              value: session,
              domain: new URL(origin).hostname,
              path: '/',
              httpOnly: true,
              secure: new URL(origin).protocol === 'https:',
              sameSite: 'Strict',
            });
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
            const step = window.innerHeight;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
              window.scrollTo({ top: y, behavior: 'instant' });
              await new Promise((resolve) => setTimeout(resolve, 120));
            }
            // O CSS usa rolagem suave. Capturar durante o retorno deslocava
            // barras fixas sobre o conteúdo e gerava defeitos visuais falsos.
            window.scrollTo({ top: 0, behavior: 'instant' });
            await new Promise((resolve) => setTimeout(resolve, 250));
          });
          await page.waitForFunction(() => window.scrollY === 0);
          const measured = (await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            // Quebrada é a que terminou de carregar sem pixel algum. Lazy
            // ainda decodificando tem complete falso e não é defeito.
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
          // Preserva leitura de texto e composição. Os bytes são enviados
          // como imagem ao crítico, nunca serializados como texto no chat.
          const jpeg = await sharp(raw)
            .resize({
              width: viewport.name === 'desktop' ? 1200 : 390,
              withoutEnlargement: true,
            })
            .jpeg({ quality: 85 })
            .toBuffer();
          shots.push({
            page: `/${slug}`,
            viewport: viewport.name,
            width: viewport.width,
            scrollWidth: measured.scrollWidth,
            overflow: measured.scrollWidth > measured.innerWidth + 2,
            brokenImages: measured.brokenImages,
            jpeg,
          });
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return shots;
}
