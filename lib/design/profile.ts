import { z } from 'zod';
import { REFERENCE_ASPECTS, referenceDirectionSchema } from './references';
import {
  BODY_FONTS,
  BODY_TYPE,
  DISPLAY_FONTS,
  DISPLAY_TYPE,
} from './typography';
import { plannedSceneInputSchema } from '@/lib/images/scene-slots';
import {
  isStructureKey,
  structureKeySchema,
  type StructureKey,
} from './structures';

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
  /** Plano editorial verificável; opcional para preservar briefings legados. */
  pagePlan: z
    .array(
      z.object({
        slug: z.string().max(160),
        stage: z.enum(['discovery', 'consideration', 'conversion']),
        intent: z.string().min(8).max(180),
        content: z.string().min(20).max(500),
        evidence: z.array(z.string().min(3).max(180)).max(8),
      }),
    )
    .min(1)
    .max(12)
    .optional(),
  /** Nasce junto do plano editorial; o estúdio executa sem novo turno de IA. */
  imageScenes: z.array(plannedSceneInputSchema).min(5).max(6).optional(),
});

export const designProfileInputSchema = z.object({
  brief: creativeBriefSchema,
  structure: structureKeySchema
    .optional()
    .describe(
      'Sem referência, uma das três estruturas da vibe. Com referência visual verificada, a mais próxima entre as doze estruturas disponíveis.',
    ),
  structureRationale: z
    .string()
    .min(20)
    .max(220)
    .describe(
      'Por que esta estrutura atende a oferta, o público e a jornada deste cliente.',
    )
    .optional(),
  referenceDirection: referenceDirectionSchema
    .optional()
    .describe(
      'Obrigatória quando há referência visual do cadastro verificada; prevalece sobre a faixa da vibe.',
    ),
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
  // As cores da marca vêm do cadastro quando o operador as definiu; aí estes
  // campos são ignorados e a direção decide só estrutura e leitura.
  accent: hex.optional(),
  accentAlt: hex.optional(),
  ink: hex,
  paper: hex,
  surface: hex,
  radius: z.enum(['none', 'sm', 'md', 'lg', 'full']),
  displayFont: z
    .enum(DISPLAY_FONTS)
    .describe(
      DISPLAY_FONTS.map((id) => `${id}: ${DISPLAY_TYPE[id].name}`).join('; '),
    ),
  bodyFont: z
    .enum(BODY_FONTS)
    .describe(
      BODY_FONTS.map((id) => `${id}: ${BODY_TYPE[id].name}`).join('; '),
    ),
  heroComposition: z.enum([
    'split',
    'cover',
    'poster',
    'editorial',
    'offset',
    'atelier',
    'stage',
    'form',
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

/** O schema enviado ao modelo e a execução usam o mesmo contexto de forma. */
export function designSchemaFor(vibe: string) {
  return designProfileInputSchema.superRefine((input, ctx) => {
    const landing = vibe === 'landing';
    const pages = input.brief.pagePlan;
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (landing) {
      if (!['stage', 'form'].includes(input.heroComposition))
        issue(['heroComposition'], 'Landing Page abre em stage ou form.');
      if (input.navigation !== 'minimal')
        issue(
          ['navigation'],
          'Landing Page usa navegação minimal com âncoras.',
        );
      if (
        !pages ||
        pages.length !== 1 ||
        pages[0].slug !== '' ||
        pages[0].stage !== 'conversion'
      )
        issue(
          ['brief', 'pagePlan'],
          'Landing Page exige somente a home, slug vazio e stage conversion.',
        );
      if (
        input.structure !== undefined ||
        input.structureRationale !== undefined
      )
        issue(
          ['structure'],
          'Landing Page não usa structure nem structureRationale.',
        );
    } else {
      if (['stage', 'form'].includes(input.heroComposition))
        issue(['heroComposition'], 'stage e form pertencem à Landing Page.');
      if (!input.structure || !input.structureRationale)
        issue(
          ['structure'],
          'Escolha a estrutura multipágina e explique o motivo.',
        );
      if (pages && pages.length < 3)
        issue(
          ['brief', 'pagePlan'],
          'Site multipágina exige no mínimo três páginas orgânicas.',
        );
    }
  });
}

export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
export type DesignProfileInput = z.infer<typeof designProfileInputSchema>;

/**
 * Versões do perfil. 2 e 3 preservam sites publicados: uma referência
 * verificada os renderiza na base comercial neutra. A 4 traz a gramática por
 * vibe, a referência modulando aspectos e a vibe preservada no renderer. A 5
 * fixa uma das três estruturas da vibe e sua composição autoral. A 6 dá à
 * referência verificada autoridade sobre a estrutura e toda a direção visual;
 * a vibe permanece como voz e fallback. A 7 é a landing de página única,
 * sem estrutura multipágina, com ou sem direção por referência.
 */
export const DESIGN_PROFILE_VERSION = 6;

export type DesignProfile = Omit<
  DesignProfileInput,
  | 'brief'
  | 'structure'
  | 'structureRationale'
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
  version: 2 | 3 | 4 | 5 | 6 | 7;
  structure?: StructureKey;
  structureRationale?: string;
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
  profile: Pick<DesignProfile, (typeof DESIGN_AXES)[number]> & {
    structure?: StructureKey;
  },
): string {
  return [profile.structure, ...DESIGN_AXES.map((axis) => profile[axis])]
    .filter(Boolean)
    .join('|');
}

export function completeDesignProfile(
  input: DesignProfileInput,
  now = new Date().toISOString(),
): DesignProfile {
  const structural = {
    concept: input.concept,
    signatureElement: input.signatureElement,
    structure: input.structure,
    structureRationale: input.structureRationale,
    displayFont: input.displayFont,
    bodyFont: input.bodyFont,
    heroComposition: input.heroComposition,
    navigation: input.navigation,
    rhythm: input.rhythm,
    imageTreatment: input.imageTreatment,
    surfaceStyle: input.surfaceStyle,
    motif: input.motif,
    ...(input.referenceDirection
      ? { referenceDirection: input.referenceDirection }
      : {}),
  };
  return {
    version: ['stage', 'form'].includes(input.heroComposition)
      ? 7
      : input.referenceDirection
        ? DESIGN_PROFILE_VERSION
        : 5,
    ...structural,
    signature: designSignature(structural),
    definedAt: now,
  };
}

export function isDesignProfile(value: unknown): value is DesignProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<DesignProfile>;
  const reference = referenceDirectionSchema.safeParse(
    profile.referenceDirection,
  );
  return (
    [2, 3, 4, 5, 6, 7].includes(profile.version ?? 0) &&
    typeof profile.concept === 'string' &&
    typeof profile.signatureElement === 'string' &&
    ((profile.version === 7 &&
      ['stage', 'form'].includes(profile.heroComposition ?? '') &&
      !profile.structure) ||
      (profile.version ?? 0) < 5 ||
      ([5, 6].includes(profile.version ?? 0) &&
        isStructureKey(profile.structure) &&
        typeof profile.structureRationale === 'string')) &&
    (!(
      profile.version === 6 ||
      (profile.version === 7 && profile.referenceDirection)
    ) ||
      (reference.success &&
        REFERENCE_ASPECTS.every((aspect) =>
          reference.data.decisions.some(
            (decision) => decision.aspect === aspect,
          ),
        ))) &&
    DESIGN_AXES.every((axis) => typeof profile[axis] === 'string')
  );
}

/** Quantidade de decisões estruturais diferentes entre duas direções. */
export function designDistance(a: DesignProfile, b: DesignProfile): number {
  return DESIGN_AXES.reduce(
    (distance, axis) => distance + Number(a[axis] !== b[axis]),
    Number(a.structure !== b.structure),
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
