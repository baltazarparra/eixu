import { z } from 'zod';
import { intakeSchema } from '@/lib/tenant-intake';

const observation = z.string().min(12).max(700);
export const visualReadingSchema = z.object({
  usable: z
    .boolean()
    .describe(
      'False para login, erro, captcha ou tela sem conteúdo visual suficiente.',
    ),
  layout: observation,
  typography: observation,
  imagery: observation,
  rhythm: observation,
  surface: observation,
  mobile: observation,
  limits: z.array(z.string().max(300)).max(6),
});
export type VisualReading = z.infer<typeof visualReadingSchema>;

/** Aspectos que uma leitura visual pode documentar e dirigir. */
export const REFERENCE_ASPECTS = [
  'layout',
  'typography',
  'imagery',
  'rhythm',
  'surface',
  'mobile',
] as const;
export type ReferenceAspect = (typeof REFERENCE_ASPECTS)[number];

/** Decisões verificáveis em toda a composição, sem transformar a fonte em template. */
export const referenceDirectionSchema = z.object({
  primaryUrl: z
    .url()
    .describe('Única referência visual lida e verificada no cadastro.'),
  decisions: z
    .array(
      z.object({
        aspect: z.enum(REFERENCE_ASPECTS),
        sourceUrl: z.url(),
        observed: observation.describe(
          'Característica observada na leitura visual desta URL.',
        ),
        application: observation.describe(
          'Como realizar a característica nos blocos, variantes e páginas deste cliente.',
        ),
      }),
    )
    .min(4)
    .max(8),
  adaptations: observation.describe(
    'Como unificar as fontes e adaptar marca, conteúdo e mobile sem perder os traços principais.',
  ),
});
export type ReferenceDirection = z.infer<typeof referenceDirectionSchema>;

export function referenceUrls(brief: Record<string, unknown>): string[] {
  const intake = intakeSchema.safeParse(brief.intake);
  return intake.success
    ? [...new Set(intake.data.references.map(normalizeReferenceUrl))]
    : [];
}

export function normalizeReferenceUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export function referenceSources(brief: Record<string, unknown>) {
  const urls = referenceUrls(brief);
  const sources = (Array.isArray(brief.sources) ? brief.sources : []) as {
    url?: string;
    visual?: { status?: string; reading?: unknown; motivo?: string };
  }[];
  return urls.map((url) => {
    const source = sources.findLast(
      (s) => s?.url && normalizeReferenceUrl(s.url) === url,
    );
    const parsed = visualReadingSchema.safeParse(source?.visual?.reading);
    return {
      url,
      attempted: !!source?.visual,
      reading:
        source?.visual?.status === 'ok' && parsed.success && parsed.data.usable
          ? parsed.data
          : null,
      reason: source?.visual?.motivo,
    };
  });
}

/** O agente não pode liberar a faixa só com uma URL ou alegando ter visto a fonte. */
export function referenceDirectionIssues(
  brief: Record<string, unknown>,
  direction?: ReferenceDirection,
): string[] {
  const sources = referenceSources(brief);
  if (sources.length > 1)
    return [
      'A nova direção aceita uma única referência visual. Escolha um link em Dados antes de reconstruir o site.',
    ];
  const unread = sources.filter((s) => !s.attempted);
  if (unread.length)
    return [
      `Leia a referência visual do cadastro com read_reference antes de set_design: ${unread.map((s) => s.url).join(', ')}.`,
    ];
  const readable = sources.filter((s) => s.reading);
  if (!readable.length)
    return direction
      ? [
          'Nenhuma referência visual do cadastro foi verificada. Não invente uma direção baseada em referência; declare a lacuna e use a vibe como apoio.',
        ]
      : [];
  if (!direction)
    return [
      'A referência visual tem prioridade sobre a vibe. Preencha referenceDirection com aplicações para layout, typography, imagery, rhythm, surface e mobile.',
    ];
  const allowed = new Set(readable.map((s) => s.url));
  const issues: string[] = [];
  if (
    !allowed.has(normalizeReferenceUrl(direction.primaryUrl)) ||
    direction.decisions.some(
      (d) => !allowed.has(normalizeReferenceUrl(d.sourceUrl)),
    )
  )
    issues.push(
      'Use somente URLs do cadastro com leitura visual verificada em referenceDirection.',
    );
  if (
    !direction.decisions.some(
      (d) =>
        normalizeReferenceUrl(d.sourceUrl) ===
        normalizeReferenceUrl(direction.primaryUrl),
    )
  )
    issues.push(
      'A referência principal precisa orientar decisões da composição.',
    );
  for (const aspect of REFERENCE_ASPECTS)
    if (!direction.decisions.some((d) => d.aspect === aspect))
      issues.push(`Falta aplicação da referência em ${aspect}.`);
  return issues;
}

/** Direção por referência gravada no perfil, em qualquer versão suportada. */
export function referenceDirectionOf(
  brand?: { design?: unknown } | null,
): ReferenceDirection | null {
  const design = brand?.design as
    | { version?: number; referenceDirection?: unknown }
    | undefined;
  if (!design || ![2, 3, 4, 5, 6, 7].includes(design.version ?? 0)) return null;
  const parsed = referenceDirectionSchema.safeParse(design.referenceDirection);
  if (!parsed.success) return null;
  if (
    design.version === 6 &&
    REFERENCE_ASPECTS.some(
      (aspect) =>
        !parsed.data.decisions.some((decision) => decision.aspect === aspect),
    )
  )
    return null;
  return parsed.data;
}

export function hasReferenceDirection(
  brand?: { design?: unknown } | null,
): boolean {
  return referenceDirectionOf(brand) !== null;
}

/**
 * Aspectos que a referência documentou com traço observado e aplicação. Só
 * eles registram o que a fonte realmente sustenta. No perfil v6 a direção só
 * é aceita quando cobre os seis aspectos, e então passa a comandar toda a
 * faixa visual; versões anteriores continuam legíveis sem migração.
 */
export function referenceAspects(
  brand?: { design?: unknown } | null,
): Set<ReferenceAspect> {
  const direction = referenceDirectionOf(brand);
  return new Set(direction?.decisions.map((decision) => decision.aspect) ?? []);
}
