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
  const targets = slugs.slice(0, options.maxPages ?? 3);
  const browser = await launch();
  const shots: Shot[] = [];
  try {
    for (const slug of targets) {
      // Mobile só na home: é onde a maior variedade de layouts aparece, e cada
      // captura extra custa tokens de imagem na revisão.
      const viewports = slug === '' ? VIEWPORTS : VIEWPORTS.slice(0, 1);
      for (const viewport of viewports) {
        const page = await browser.newPage();
        try {
          await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 1,
          });
          if (options.cookie)
            await page.setExtraHTTPHeaders({ cookie: options.cookie });
          const url = `${origin}/s/${tenant}/${slug}?preview=1&__tenant=${tenant}`;
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 25_000 });
          // Rola até o fim para disparar lazy loading e as entradas de seção.
          await page.evaluate(async () => {
            const step = window.innerHeight;
            for (let y = 0; y < document.body.scrollHeight; y += step) {
              window.scrollTo(0, y);
              await new Promise((resolve) => setTimeout(resolve, 120));
            }
            window.scrollTo(0, 0);
            await new Promise((resolve) => setTimeout(resolve, 250));
          });
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
          // A página inteira é alta demais para o modelo; reduzir a largura e
          // recomprimir mantém a leitura de composição a um custo aceitável.
          const jpeg = await sharp(raw)
            .resize({ width: viewport.name === 'desktop' ? 900 : 420 })
            .jpeg({ quality: 68 })
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
