import { randomUUID } from 'node:crypto';
import { analyzeCurrentSite } from './analyze';
import { crawlCurrentSite } from './crawl';
import {
  importCurrentSiteImages,
  type CurrentSiteImageSelection,
} from './import-image';
import {
  CURRENT_SITE_VERSION,
  currentSiteReceiptSchema,
  type CurrentSiteReceipt,
} from './schema';

/** Orquestra coleta, síntese e importação; cada camada mantém seu próprio limite. */
export async function readCurrentSite(input: {
  tenantId: string;
  tenantName: string;
  url: string;
  operatorStory: string;
}): Promise<CurrentSiteReceipt> {
  const scanId = randomUUID();
  const crawledAt = new Date().toISOString();
  let crawl;
  try {
    crawl = await crawlCurrentSite(input.url);
  } catch (error) {
    return currentSiteReceiptSchema.parse({
      version: CURRENT_SITE_VERSION,
      scanId,
      url: input.url,
      status: 'inacessivel',
      motivo:
        error instanceof Error
          ? `Não foi possível navegar no site atual: ${error.message}`
          : 'Não foi possível navegar no site atual.',
      crawledAt,
      pages: [],
      links: [],
      imagesDiscovered: 0,
      importedImages: [],
      imageFailures: [],
      renderedPages: 0,
      limits: [],
    });
  }

  let analysis: Awaited<ReturnType<typeof analyzeCurrentSite>> | undefined;
  let analysisReason: string | undefined;
  try {
    analysis = await analyzeCurrentSite(
      crawl,
      input.tenantId,
      input.tenantName,
      input.operatorStory,
    );
  } catch (error) {
    analysisReason =
      error instanceof Error
        ? `Não foi possível sintetizar a coleta: ${error.message}`
        : 'Não foi possível sintetizar a coleta.';
  }

  const candidates = new Map(crawl.images.map((image) => [image.url, image]));
  const selections: CurrentSiteImageSelection[] = (
    analysis?.analysis.identity.matches ? analysis.analysis.selectedImages : []
  )
    .map((selected) => {
      const candidate = candidates.get(selected.url);
      if (!candidate) return null;
      return {
        ...candidate,
        kind: candidate.role === 'logo' ? 'logo' : selected.kind,
        selectedAlt: selected.alt,
        reason: selected.reason,
      };
    })
    .filter((value): value is CurrentSiteImageSelection => value !== null);
  const imported = analysis
    ? await importCurrentSiteImages(input.tenantId, scanId, selections)
    : { importedImages: [], failures: [] };

  return currentSiteReceiptSchema.parse({
    version: CURRENT_SITE_VERSION,
    scanId,
    url: input.url,
    finalUrl: crawl.finalUrl,
    status: 'ok',
    crawledAt,
    // Links e candidatos já têm pageUrl e são consumidos antes daqui. Evita
    // duplicar os mesmos inventários em cada página do recibo persistido.
    pages: crawl.pages.map((page) => ({ ...page, links: [], images: [] })),
    links: crawl.links,
    imagesDiscovered: crawl.images.length,
    importedImages: imported.importedImages,
    imageFailures: imported.failures,
    analysis: analysis?.analysis,
    analysisStatus: analysis ? 'ok' : 'inacessivel',
    ...(analysisReason ? { analysisReason } : {}),
    renderedPages: crawl.renderedPages,
    limits: [
      ...crawl.limits,
      ...(imported.failures.length
        ? [
            `${imported.failures.length} ativo(s) selecionado(s) não puderam ser importados.`,
          ]
        : []),
    ],
    ...(analysis ? { usage: analysis.usage } : {}),
  });
}
