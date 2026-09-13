import { z } from 'zod';
import {
  CURRENT_SITE_IMAGE_MODEL,
  CURRENT_SITE_MAX_IMPORTS,
  CURRENT_SITE_MAX_PAGES,
  CURRENT_SITE_VERSION,
} from './constants';

export {
  CURRENT_SITE_IMAGE_MODEL,
  CURRENT_SITE_MAX_IMPORTS,
  CURRENT_SITE_MAX_PAGES,
  CURRENT_SITE_VERSION,
};

export const currentSiteLinkSchema = z.object({
  url: z.string().max(2000),
  label: z.string().max(240).default(''),
  kind: z.enum([
    'internal',
    'external',
    'document',
    'email',
    'phone',
    'whatsapp',
    'social',
  ]),
  pageUrl: z.url(),
});

export const currentSiteImageCandidateSchema = z.object({
  url: z.url(),
  pageUrl: z.url(),
  alt: z.string().max(300).default(''),
  context: z.string().max(400).default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  role: z.enum(['photo', 'logo', 'unknown']).default('unknown'),
});

export const currentSitePageSchema = z.object({
  url: z.url(),
  title: z.string().max(240).default(''),
  description: z.string().max(500).default(''),
  canonical: z.url().optional(),
  headings: z.array(z.string().max(240)).max(40).default([]),
  text: z.string().max(8000).default(''),
  links: z.array(currentSiteLinkSchema).max(160).default([]),
  images: z.array(currentSiteImageCandidateSchema).max(100).default([]),
  emails: z.array(z.string().max(320)).max(20).default([]),
  phones: z.array(z.string().max(80)).max(20).default([]),
  addresses: z.array(z.string().max(500)).max(12).default([]),
  structuredData: z
    .array(
      z.object({
        type: z.string().max(120).default(''),
        name: z.string().max(240).default(''),
        description: z.string().max(600).default(''),
        telephone: z.string().max(80).default(''),
        email: z.string().max(320).default(''),
        address: z.string().max(500).default(''),
        url: z.string().max(2000).default(''),
      }),
    )
    .max(20)
    .default([]),
  rendered: z.boolean().default(false),
});

const sourcedFactSchema = z.object({
  text: z.string().trim().min(2).max(500),
  sourceUrl: z.url(),
});

export const currentSiteAnalysisSchema = z.object({
  identity: z.object({
    matches: z.boolean(),
    confidence: z.enum(['high', 'medium', 'low']),
    reason: z.string().trim().min(2).max(500),
  }),
  overview: z.string().trim().min(20).max(1600),
  audiences: z.array(sourcedFactSchema).max(12).default([]),
  offers: z.array(sourcedFactSchema).max(20).default([]),
  regions: z.array(sourcedFactSchema).max(12).default([]),
  differentiators: z.array(sourcedFactSchema).max(16).default([]),
  evidence: z.array(sourcedFactSchema).max(16).default([]),
  callsToAction: z.array(sourcedFactSchema).max(12).default([]),
  pageInsights: z
    .array(
      z.object({
        url: z.url(),
        purpose: z.string().trim().min(2).max(300),
        keyFacts: z.array(z.string().trim().min(2).max(300)).max(12),
      }),
    )
    .max(CURRENT_SITE_MAX_PAGES)
    .default([]),
  usefulLinks: z
    .array(
      z.object({
        url: z.string().max(2000),
        label: z.string().max(240).default(''),
        reason: z.string().trim().min(2).max(300),
        sourceUrl: z.url(),
      }),
    )
    .max(30)
    .default([]),
  selectedImages: z
    .array(
      z.object({
        url: z.url(),
        kind: z.enum(['photo', 'logo']),
        alt: z.string().trim().min(2).max(240),
        reason: z.string().trim().min(2).max(300),
      }),
    )
    .max(CURRENT_SITE_MAX_IMPORTS)
    .default([]),
  conflicts: z
    .array(
      z.object({
        topic: z.string().trim().min(2).max(160),
        currentSiteSays: z.string().trim().min(2).max(400),
        operatorStorySays: z.string().trim().min(2).max(400),
        sourceUrl: z.url(),
      }),
    )
    .max(12)
    .default([]),
  gaps: z.array(z.string().trim().min(2).max(400)).max(16).default([]),
});

export const currentSiteImportedImageSchema = z.object({
  id: z.string(),
  seq: z.number().int().positive(),
  url: z.url(),
  sourceUrl: z.url(),
  pageUrl: z.url(),
  kind: z.enum(['foto', 'logo']),
  alt: z.string().max(240),
});

export const currentSiteReceiptSchema = z.object({
  version: z.literal(CURRENT_SITE_VERSION),
  scanId: z.uuid(),
  url: z.url(),
  finalUrl: z.url().optional(),
  status: z.enum(['ok', 'inacessivel']),
  motivo: z.string().max(1000).optional(),
  crawledAt: z.string(),
  pages: z.array(currentSitePageSchema).max(CURRENT_SITE_MAX_PAGES).default([]),
  links: z.array(currentSiteLinkSchema).max(160).default([]),
  imagesDiscovered: z.number().int().nonnegative().default(0),
  importedImages: z
    .array(currentSiteImportedImageSchema)
    .max(CURRENT_SITE_MAX_IMPORTS)
    .default([]),
  imageFailures: z
    .array(z.string().max(500))
    .max(CURRENT_SITE_MAX_IMPORTS)
    .default([]),
  analysis: currentSiteAnalysisSchema.optional(),
  analysisStatus: z.enum(['ok', 'inacessivel']).optional(),
  analysisReason: z.string().max(1000).optional(),
  renderedPages: z.number().int().nonnegative().default(0),
  limits: z.array(z.string().max(500)).max(12).default([]),
  usage: z.unknown().optional(),
});

export type CurrentSiteLink = z.infer<typeof currentSiteLinkSchema>;
export type CurrentSiteImageCandidate = z.infer<
  typeof currentSiteImageCandidateSchema
>;
export type CurrentSitePage = z.infer<typeof currentSitePageSchema>;
export type CurrentSiteAnalysis = z.infer<typeof currentSiteAnalysisSchema>;
export type CurrentSiteReceipt = z.infer<typeof currentSiteReceiptSchema>;

export function normalizeCurrentSiteUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function currentSiteRecord(value: unknown): CurrentSiteReceipt | null {
  const parsed = currentSiteReceiptSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function currentSiteMatches(value: unknown, url: string): boolean {
  const receipt = currentSiteRecord(value);
  return (
    !!receipt &&
    normalizeCurrentSiteUrl(receipt.url) === normalizeCurrentSiteUrl(url)
  );
}

const facts = (
  label: string,
  values: { text: string; sourceUrl: string }[] | undefined,
) =>
  values?.length
    ? `${label}: ${values.map((value) => `${value.text} (${value.sourceUrl})`).join('; ')}`
    : '';

/** Contexto podado: a coleta completa fica no recibo, e o agente recebe a síntese rastreável. */
export function currentSitePrompt(value: unknown): string {
  const receipt = currentSiteRecord(value);
  if (!receipt) return '';
  if (receipt.status !== 'ok')
    return `Leitura do site atual ${receipt.url}: inacessível. Motivo: ${receipt.motivo ?? 'não informado'}.`;
  const analysis = receipt.analysis;
  const accepted = analysis?.identity.matches ? analysis : undefined;
  const contacts = {
    emails: [...new Set(receipt.pages.flatMap((page) => page.emails))],
    phones: [...new Set(receipt.pages.flatMap((page) => page.phones))],
    addresses: [...new Set(receipt.pages.flatMap((page) => page.addresses))],
  };
  return [
    `Site atual lido: ${receipt.finalUrl ?? receipt.url} (${receipt.pages.length} página(s), ${receipt.importedImages.length} imagem(ns) importada(s)).`,
    analysis?.identity
      ? `Correspondência com o cliente: ${analysis.identity.matches ? 'sim' : 'não'} (${analysis.identity.confidence}): ${analysis.identity.reason}`
      : '',
    accepted?.overview ? `Síntese: ${accepted.overview}` : '',
    !analysis
      ? `Páginas coletadas sem síntese: ${receipt.pages
          .map(
            (page) =>
              `${page.url}: ${page.title}; ${page.description}; ${page.headings.join('; ')}; ${page.text.slice(0, 700)}`,
          )
          .join(' | ')}`
      : '',
    facts('Públicos encontrados', accepted?.audiences),
    facts('Ofertas encontradas', accepted?.offers),
    facts('Regiões encontradas', accepted?.regions),
    facts('Diferenciais encontrados', accepted?.differentiators),
    facts('Provas explícitas', accepted?.evidence),
    facts('Ações encontradas', accepted?.callsToAction),
    accepted?.pageInsights.length
      ? `Páginas e conteúdo: ${accepted.pageInsights
          .map(
            (page) =>
              `${page.url}: ${page.purpose}; ${page.keyFacts.join('; ')}`,
          )
          .join(' | ')}`
      : '',
    accepted?.usefulLinks.length
      ? `Links úteis: ${accepted.usefulLinks
          .map(
            (link) => `${link.label || link.url}: ${link.url} (${link.reason})`,
          )
          .join('; ')}`
      : '',
    (!analysis || accepted) &&
    (contacts.emails.length ||
      contacts.phones.length ||
      contacts.addresses.length)
      ? `Contatos encontrados para conferência: ${JSON.stringify(contacts)}`
      : '',
    accepted && receipt.importedImages.length
      ? `Ativos importados: ${receipt.importedImages
          .map(
            (image) =>
              `#${image.seq} ${image.kind}, ${image.alt}: ${image.url} (origem ${image.sourceUrl})`,
          )
          .join('; ')}`
      : '',
    accepted?.conflicts.length
      ? `Conflitos com a história do operador: ${accepted.conflicts
          .map(
            (conflict) =>
              `${conflict.topic}: site diz "${conflict.currentSiteSays}"; história diz "${conflict.operatorStorySays}" (${conflict.sourceUrl})`,
          )
          .join('; ')}`
      : '',
    analysis?.gaps.length
      ? `Lacunas da leitura: ${analysis.gaps.join('; ')}`
      : '',
    receipt.analysisStatus === 'inacessivel'
      ? `A síntese automática falhou: ${receipt.analysisReason ?? 'motivo não informado'}. Use somente os dados determinísticos acima e declare a lacuna.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
