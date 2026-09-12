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

/** Decisões verificáveis em toda a composição, sem transformar a fonte em template. */
export const referenceDirectionSchema = z.object({
  primaryUrl: z
    .url()
    .describe(
      'Referência visual principal, escolhida entre as URLs lidas do cadastro.',
    ),
  decisions: z
    .array(
      z.object({
        aspect: z.enum([
          'layout',
          'typography',
          'imagery',
          'rhythm',
          'surface',
          'mobile',
        ]),
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
  const unread = sources.filter((s) => !s.attempted);
  if (unread.length)
    return [
      `Leia as referências do cadastro com read_reference antes de set_design: ${unread.map((s) => s.url).join(', ')}.`,
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
      'As referências visuais têm prioridade sobre a vibe. Preencha referenceDirection com a fonte principal e aplicações para layout, typography, imagery e rhythm.',
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
  for (const aspect of ['layout', 'typography', 'imagery', 'rhythm'])
    if (!direction.decisions.some((d) => d.aspect === aspect))
      issues.push(`Falta aplicação da referência em ${aspect}.`);
  return issues;
}

export function hasReferenceDirection(
  brand?: { design?: unknown } | null,
): boolean {
  const design = brand?.design as
    | { version?: number; referenceDirection?: unknown }
    | undefined;
  return (
    design?.version === 2 &&
    referenceDirectionSchema.safeParse(design.referenceDirection).success
  );
}
