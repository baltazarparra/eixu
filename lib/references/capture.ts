import type { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './browser';
import { publicResource } from './network';
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

export type ReferenceCapture = {
  shots: ReferenceShot[];
  failures: Array<{ viewport: string; message: string }>;
};

/** Orçamento da captura inteira e de cada viewport dentro dela. */
export const REFERENCE_CAPTURE_TIMEOUT_MS = 120_000;
export const REFERENCE_VIEWPORT_TIMEOUT_MS = 50_000;

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

type CaptureOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
  launch?: typeof launchBrowser;
};

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Falha desconhecida';
}

async function renderViewport(
  page: Page,
  url: string,
  viewport: (typeof VIEWPORTS)[number],
  deadline: AbortSignal,
  request: typeof publicResource,
): Promise<ReferenceShot> {
  // Uma página pesada no desktop não pode consumir o orçamento do mobile.
  let count = 0;
  let bytes = 0;
  let unavailableResources = 0;
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
          request(incoming.url(), deadline),
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
  const response = await abortable(
    page.goto(url, { waitUntil: 'networkidle2', timeout: 20_000 }),
    deadline,
  );
  if (!response?.ok())
    throw new Error(
      response
        ? `Referência respondeu HTTP ${response.status()}`
        : 'Referência não acessível',
    );
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
  const metrics = await abortable(page.evaluate(referenceOutline), deadline);
  const height = Math.min(metrics.pageHeight, 9000);
  const jpeg = Buffer.from(
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
  return {
    viewport: viewport.name,
    width: viewport.width,
    height,
    pageHeight: metrics.pageHeight,
    truncated: height < metrics.pageHeight,
    url: page.url(),
    unavailableResources,
    styles: metrics.styles,
    jpeg,
  };
}

async function captureViewport(
  browser: Browser,
  url: string,
  viewport: (typeof VIEWPORTS)[number],
  deadline: AbortSignal,
  request: typeof publicResource,
  kill: () => void,
): Promise<ReferenceShot> {
  for (let attempt = 0; ; attempt += 1) {
    deadline.throwIfAborted();
    const page = await abortable(browser.newPage(), deadline);
    try {
      return await renderViewport(page, url, viewport, deadline, request);
    } catch (error) {
      // Uma falha de rede no documento costuma passar na segunda tentativa.
      // O orçamento do viewport continua sendo o limite real.
      if (attempt >= 1 || deadline.aborted) throw error;
    } finally {
      await abortable(page.close(), AbortSignal.timeout(2000)).catch(kill);
    }
  }
}

/**
 * Navegador isolado: toda rede direta falha; só GETs públicos validados são
 * atendidos. Cada viewport tem orçamento próprio e uma segunda tentativa: um
 * desktop lento ou uma queda momentânea não podem apagar a captura inteira.
 */
export async function captureReference(
  url: string,
  request = publicResource,
  options: CaptureOptions = {},
): Promise<ReferenceCapture> {
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
  const failures: ReferenceCapture['failures'] = [];
  try {
    for (const viewport of VIEWPORTS) {
      const budget = AbortSignal.any([
        deadline,
        AbortSignal.timeout(REFERENCE_VIEWPORT_TIMEOUT_MS),
      ]);
      try {
        shots.push(
          await captureViewport(browser, url, viewport, budget, request, kill),
        );
      } catch (error) {
        failures.push({
          viewport: viewport.name,
          message: failureMessage(error),
        });
      }
    }
    // Um viewport entregue vale mais do que nenhuma evidência visual.
    if (!shots.length)
      throw new Error(failures[0]?.message ?? 'Referência não acessível');
    return { shots, failures };
  } finally {
    deadline.removeEventListener('abort', kill);
    await abortable(browser.close(), AbortSignal.timeout(2000)).catch(kill);
  }
}
