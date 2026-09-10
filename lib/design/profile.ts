import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const creativeBriefSchema = z.object({
  audience: z.string().min(8).max(180),
  offer: z.string().min(8).max(180),
  goal: z.string().min(8).max(140),
  personality: z.array(z.string().min(2).max(32)).min(2).max(5),
  evidence: z.array(z.string().min(3).max(140)).max(8).default([]),
  constraints: z.array(z.string().min(3).max(140)).max(8).default([]),
  /** O que não foi confirmado por fonte alguma. Impede afirmação sem evidência. */
  gaps: z.array(z.string().min(3).max(140)).max(6).default([]),
});

export const designProfileInputSchema = z.object({
  brief: creativeBriefSchema,
  concept: z
    .string()
    .min(16)
    .max(180)
    .describe(
      'Ideia visual concreta ligada ao negócio, não um adjetivo genérico.',
    ),
  signatureElement: z
    .string()
    .min(8)
    .max(120)
    .describe('Um elemento visual memorável que se repete com intenção.'),
  accent: hex,
  accentAlt: hex,
  ink: hex,
  paper: hex,
  surface: hex,
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']),
  displayFont: z.enum(['sans', 'editorial', 'geometric', 'humanist', 'mono']),
  bodyFont: z.enum(['sans', 'editorial', 'geometric', 'humanist']),
  heroComposition: z.enum([
    'split',
    'cover',
    'poster',
    'editorial',
    'offset',
    'atelier',
  ]),
  navigation: z.enum(['bar', 'floating', 'minimal', 'contrast']),
  rhythm: z.enum(['alternating', 'chapters', 'continuous', 'compact']),
  imageTreatment: z.enum(['full-bleed', 'framed', 'collage', 'cutout']),
  surfaceStyle: z.enum(['flat', 'layered', 'outlined', 'contrast']),
  motif: z.enum(['none', 'grid', 'rings', 'stripes', 'corners']),
  variance: z.number().int().min(1).max(10),
  motion: z.number().int().min(1).max(10),
  density: z.number().int().min(1).max(10),
});

export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
export type DesignProfileInput = z.infer<typeof designProfileInputSchema>;

export type DesignProfile = Omit<
  DesignProfileInput,
  | 'brief'
  | 'accent'
  | 'accentAlt'
  | 'ink'
  | 'paper'
  | 'surface'
  | 'radius'
  | 'variance'
  | 'motion'
  | 'density'
> & {
  version: 2;
  signature: string;
  definedAt: string;
};

export const DESIGN_AXES = [
  'displayFont',
  'bodyFont',
  'heroComposition',
  'navigation',
  'rhythm',
  'imageTreatment',
  'surfaceStyle',
  'motif',
] as const satisfies readonly (keyof DesignProfile)[];

export function designSignature(
  profile: Pick<DesignProfile, (typeof DESIGN_AXES)[number]>,
): string {
  return DESIGN_AXES.map((axis) => profile[axis]).join('|');
}

export function completeDesignProfile(
  input: DesignProfileInput,
  now = new Date().toISOString(),
): DesignProfile {
  const structural = {
    concept: input.concept,
    signatureElement: input.signatureElement,
    displayFont: input.displayFont,
    bodyFont: input.bodyFont,
    heroComposition: input.heroComposition,
    navigation: input.navigation,
    rhythm: input.rhythm,
    imageTreatment: input.imageTreatment,
    surfaceStyle: input.surfaceStyle,
    motif: input.motif,
  };
  return {
    version: 2,
    ...structural,
    signature: designSignature(structural),
    definedAt: now,
  };
}

export function isDesignProfile(value: unknown): value is DesignProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<DesignProfile>;
  return (
    profile.version === 2 &&
    typeof profile.concept === 'string' &&
    typeof profile.signatureElement === 'string' &&
    DESIGN_AXES.every((axis) => typeof profile[axis] === 'string')
  );
}

/** Quantidade de decisões estruturais diferentes entre duas direções. */
export function designDistance(a: DesignProfile, b: DesignProfile): number {
  return DESIGN_AXES.reduce(
    (distance, axis) => distance + Number(a[axis] !== b[axis]),
    0,
  );
}

export function nearestDesign(
  candidate: DesignProfile,
  existing: unknown[],
): { distance: number; profile: DesignProfile } | null {
  let nearest: { distance: number; profile: DesignProfile } | null = null;
  for (const value of existing) {
    if (!isDesignProfile(value)) continue;
    const distance = designDistance(candidate, value);
    if (!nearest || distance < nearest.distance)
      nearest = { distance, profile: value };
  }
  return nearest;
}

type BlockLike = { type: string; props: Record<string, unknown> };

/** Assinatura da silhueta da página, sem texto, imagem ou dado do cliente. */
export function compositionSignature(blocks: BlockLike[]): string {
  return blocks
    .filter(
      (block) =>
        !block.type.startsWith('nav.') && !block.type.startsWith('footer.'),
    )
    .map((block) => {
      const layout =
        typeof block.props.layout === 'string' ? block.props.layout : 'default';
      const presentation =
        block.props.presentation && typeof block.props.presentation === 'object'
          ? (block.props.presentation as Record<string, unknown>)
          : {};
      const tone =
        typeof presentation.tone === 'string' ? presentation.tone : 'paper';
      const edge =
        typeof presentation.edge === 'string' ? presentation.edge : 'none';
      return `${block.type}:${layout}:${tone}:${edge}`;
    })
    .join('>');
}
