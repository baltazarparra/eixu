import { launchBrowser } from '@/lib/review/capture';
import { publicResource, type PublicResource } from '@/lib/references/network';

export type RenderedCurrentSitePage = {
  requestedUrl: string;
  finalUrl: string;
  html: string;
  unavailableResources: number;
};

/** DOM pós-JavaScript, sempre atrás do mesmo transporte público e sem cookies. */
export async function renderCurrentSitePages(
  urls: string[],
  request: (url: string) => Promise<PublicResource> = publicResource,
): Promise<RenderedCurrentSitePage[]> {
  if (!urls.length) return [];
  const browser = await launchBrowser([
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=<-loopback>',
    '--disable-quic',
  ]);
  const deadline = setTimeout(() => void browser.close(), 70_000);
  const rendered: RenderedCurrentSitePage[] = [];
  try {
    for (const requestedUrl of [...new Set(urls)].slice(0, 4)) {
      const page = await browser.newPage();
      const allowedOrigin = new URL(requestedUrl).origin;
      let count = 0;
      let bytes = 0;
      let unavailableResources = 0;
      try {
        await page.setViewport({ width: 1280, height: 900 });
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
                incoming.isNavigationRequest() &&
                new URL(incoming.url()).origin !== allowedOrigin
              ) {
                unavailableResources++;
                await incoming.abort();
                return;
              }
              if (
                incoming.method() !== 'GET' ||
                ++count > 300 ||
                bytes > 35_000_000
              ) {
                unavailableResources++;
                await incoming.abort();
                return;
              }
              const resource = await request(incoming.url());
              bytes += resource.body.length;
              if (bytes > 35_000_000) {
                unavailableResources++;
                await incoming.abort();
                return;
              }
              await incoming.respond(resource);
            } catch {
              unavailableResources++;
              if (!incoming.isInterceptResolutionHandled())
                await incoming.abort().catch(() => undefined);
            }
          })();
        });
        const response = await page.goto(requestedUrl, {
          waitUntil: 'networkidle2',
          timeout: 18_000,
        });
        if (!response?.ok()) continue;
        await page.evaluate(async () => {
          for (
            let y = 0;
            y < Math.min(document.documentElement.scrollHeight, 7000);
            y += window.innerHeight
          ) {
            window.scrollTo({ top: y, behavior: 'instant' });
            await new Promise((resolve) => setTimeout(resolve, 80));
          }
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise((resolve) => setTimeout(resolve, 250));
          for (const image of document.querySelectorAll('img'))
            if (image.currentSrc)
              image.setAttribute('data-eixu-current-src', image.currentSrc);
          for (const element of [...document.querySelectorAll('body *')].slice(
            0,
            600,
          )) {
            const background = getComputedStyle(element).backgroundImage;
            const match = /url\(["']?([^"')]+)["']?\)/.exec(background);
            if (match?.[1])
              element.setAttribute('data-eixu-background-src', match[1]);
          }
        });
        rendered.push({
          requestedUrl,
          finalUrl: page.url(),
          html: (await page.content()).slice(0, 1_500_000),
          unavailableResources,
        });
      } catch {
        // A leitura HTML continua disponível; renderização é complemento.
      } finally {
        await page.close().catch(() => undefined);
      }
    }
    return rendered;
  } finally {
    clearTimeout(deadline);
    await browser.close().catch(() => undefined);
  }
}
