import { launchBrowser } from './browser';
import { PUBLIC_DOCUMENT_TIMEOUT_MS, publicResource } from './network';
import { referenceOutline, type ReferenceOutline } from './outline';
import { abortable } from '@/lib/async/abort';

export type ReferenceShot = {
  viewport: string;
  width: number;
  height: number;
  pageHeight: number;
  truncated: boolean;
  url: string;
  unavailableResources: number;
  styles: ReferenceOutline;
  jpeg: Buffer;
};

export const REFERENCE_CAPTURE_TIMEOUT_MS = 100_000;

/** Tentativas por viewport: origens atrás de CDN recusam de forma alternada. */
const NAVIGATION_ATTEMPTS = 2;
/** Maior que PUBLIC_DOCUMENT_TIMEOUT_MS para o documento esgotar o seu prazo. */
const NAVIGATION_TIMEOUT_MS = 16_000;

type CaptureOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  launch?: typeof launchBrowser;
};

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    function abort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

/** Navegador isolado: toda rede direta falha; só GETs públicos validados são atendidos. */
export async function captureReference(
  url: string,
  request = publicResource,
  options: CaptureOptions = {},
): Promise<ReferenceShot[]> {
  const deadline = AbortSignal.any([
    AbortSignal.timeout(options.timeoutMs ?? REFERENCE_CAPTURE_TIMEOUT_MS),
    ...(options.signal ? [options.signal] : []),
  ]);
  const launch = (options.launch ?? launchBrowser)([
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=<-loopback>',
    '--disable-quic',
  ]).then((browser) => {
    // A extração/abertura do binário pode terminar depois do prazo.
    if (deadline.aborted) browser.process()?.kill('SIGKILL');
    return browser;
  });
  const browser = await abortable(launch, deadline);
  const kill = () => browser.process()?.kill('SIGKILL');
  deadline.addEventListener('abort', kill, { once: true });
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
      deadline.throwIfAborted();
      const page = await abortable(browser.newPage(), deadline);
      try {
        await abortable(
          page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 1,
          }),
          deadline,
        );
        await abortable(page.setBypassServiceWorker(true), deadline);
        await abortable(page.setRequestInterception(true), deadline);
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
              const resource = await abortable(
                request(
                  incoming.url(),
                  deadline,
                  incoming.isNavigationRequest()
                    ? PUBLIC_DOCUMENT_TIMEOUT_MS
                    : undefined,
                ),
                deadline,
              );
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
        // Uma recusa pontual da origem não pode descartar o run inteiro. Na
        // repetição o critério de espera cede: página que nunca fica ociosa
        // ainda rende screenshot utilizável.
        let navigationError: unknown = new Error('Referência não acessível');
        let loaded = false;
        for (let attempt = 0; attempt < NAVIGATION_ATTEMPTS; attempt++) {
          deadline.throwIfAborted();
          // O orçamento descreve a carga que sobrou de pé, não a soma das
          // tentativas: sem zerar, a repetição começa sem cota e falha sozinha.
          count = 0;
          bytes = 0;
          unavailableResources = 0;
          try {
            const response = await abortable(
              page.goto(url, {
                waitUntil: attempt === 0 ? 'networkidle2' : 'domcontentloaded',
                timeout: NAVIGATION_TIMEOUT_MS,
              }),
              deadline,
            );
            if (response?.ok()) {
              loaded = true;
              break;
            }
            navigationError = new Error(
              `Referência respondeu ${response?.status() ?? 'sem status'}`,
            );
          } catch (error) {
            navigationError = error;
          }
          if (attempt + 1 < NAVIGATION_ATTEMPTS)
            await delay(500 * (attempt + 1), deadline);
        }
        if (!loaded) throw navigationError;
        // Limite explícito: páginas infinitas não podem prender o briefing.
        await abortable(
          page.evaluate(async () => {
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
          }),
          deadline,
        );
        // A função é serializada para a página; ela não pode depender de nada
        // deste módulo. Ver lib/references/outline.ts.
        const metrics = await abortable(
          page.evaluate(referenceOutline),
          deadline,
        );
        // pageHeight zerado ou absurdo faz o clip virar erro de protocolo e
        // perder a página já carregada; o viewport é o piso utilizável.
        let height = Math.min(
          Math.max(metrics.pageHeight || viewport.height, 1),
          9000,
        );
        let jpeg: Buffer;
        try {
          jpeg = Buffer.from(
            await abortable(
              page.screenshot({
                type: 'jpeg',
                quality: 80,
                clip: { x: 0, y: 0, width: viewport.width, height },
                captureBeyondViewport: true,
              }),
              deadline,
            ),
          );
        } catch (error) {
          deadline.throwIfAborted();
          if (!/captureScreenshot|Protocol error/i.test(String(error)))
            throw error;
          // Página inteira recusada: a dobra observada vale mais que nada.
          height = viewport.height;
          jpeg = Buffer.from(
            await abortable(
              page.screenshot({ type: 'jpeg', quality: 80 }),
              deadline,
            ),
          );
        }
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
        await abortable(page.close(), AbortSignal.timeout(2000)).catch(kill);
      }
    }
    return shots;
  } finally {
    deadline.removeEventListener('abort', kill);
    await abortable(browser.close(), AbortSignal.timeout(2000)).catch(kill);
  }
}
