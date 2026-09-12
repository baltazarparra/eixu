import { launchBrowser } from '@/lib/review/capture';
import { publicResource } from './network';

export type ReferenceShot = {
  viewport: string;
  width: number;
  height: number;
  pageHeight: number;
  truncated: boolean;
  url: string;
  unavailableResources: number;
  styles: unknown;
  jpeg: Buffer;
};

/** Navegador isolado: toda rede direta falha; só GETs públicos validados são atendidos. */
export async function captureReference(
  url: string,
  request = publicResource,
): Promise<ReferenceShot[]> {
  const browser = await launchBrowser([
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=<-loopback>',
    '--disable-quic',
  ]);
  const deadline = setTimeout(() => {
    void browser.close();
  }, 55_000);
  const shots: ReferenceShot[] = [];
  try {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      // Uma página pesada no desktop não pode consumir o orçamento do mobile.
      let count = 0;
      let bytes = 0;
      let unavailableResources = 0;
      const page = await browser.newPage();
      try {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
        });
        await page.setBypassServiceWorker(true);
        await page.setRequestInterception(true);
        page.on('request', (incoming) => {
          void (async () => {
            try {
              if (
                /^(data:|blob:)/.test(incoming.url()) &&
                !incoming.isNavigationRequest()
              ) {
                await incoming.continue();
                return;
              }
              if (
                incoming.method() !== 'GET' ||
                ++count > 400 ||
                bytes > 50_000_000
              ) {
                unavailableResources++;
                await incoming.abort();
                return;
              }
              const resource = await request(incoming.url());
              bytes += resource.body.length;
              if (bytes > 50_000_000) {
                unavailableResources++;
                await incoming.abort();
                return;
              }
              await incoming.respond(resource);
            } catch {
              unavailableResources++;
              if (!incoming.isInterceptResolutionHandled())
                await incoming.abort().catch(() => {});
            }
          })();
        });
        const response = await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 20_000,
        });
        if (!response?.ok()) throw new Error('Referência não acessível');
        // Limite explícito: páginas infinitas não podem prender o briefing.
        await page.evaluate(async () => {
          await Promise.race([
            document.fonts.ready,
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]);
          for (
            let y = 0;
            y < Math.min(document.documentElement.scrollHeight, 9000);
            y += window.innerHeight
          ) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise((resolve) => setTimeout(resolve, 300));
        });
        const metrics = await page.evaluate(() => ({
          pageHeight: document.documentElement.scrollHeight,
          styles: [
            ...document.querySelectorAll(
              'body, nav, h1, h2, main > section, main > article',
            ),
          ]
            .slice(0, 18)
            .map((el) => {
              const css = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return {
                tag: el.tagName,
                text: (el.textContent ?? '').trim().slice(0, 140),
                font: css.fontFamily,
                size: css.fontSize,
                weight: css.fontWeight,
                color: css.color,
                background: css.backgroundColor,
                display: css.display,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            }),
        }));
        const height = Math.min(metrics.pageHeight, 9000);
        const jpeg = Buffer.from(
          await page.screenshot({
            type: 'jpeg',
            quality: 80,
            clip: { x: 0, y: 0, width: viewport.width, height },
            captureBeyondViewport: true,
          }),
        );
        shots.push({
          viewport: viewport.name,
          width: viewport.width,
          height,
          pageHeight: metrics.pageHeight,
          truncated: height < metrics.pageHeight,
          url: page.url(),
          unavailableResources,
          styles: metrics.styles,
          jpeg,
        });
      } finally {
        await page.close().catch(() => {});
      }
    }
    return shots;
  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
}
