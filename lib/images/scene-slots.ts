import { z } from 'zod';

/**
 * Vagas de cena, sem dependência de design. Módulo folha porque o schema do
 * briefing (lib/design/profile.ts) precisa dele e o plano de cenas precisa da
 * gramática da vibe: manter tudo em scene-plan criava um ciclo de imports.
 */
export const SCENE_ROLES = [
  'hero',
  'hero-detail',
  'protagonista',
  'subpagina',
  'apoio',
] as const;
export type SceneRole = (typeof SCENE_ROLES)[number];

export const SCENE_TARGET_BLOCKS = [
  'hero.split',
  'hero.cover',
  'hero.poster',
  'hero.editorial',
  'hero.offset',
  'hero.atelier',
  'narrative.split',
  'feature.bento',
  'feature.explorer',
  'editorial.resources',
  'media.image',
  'media.gallery',
  'signature.composition',
] as const;

export const plannedSceneInputSchema = z.object({
  request: z
    .string()
    .min(30)
    .max(500)
    .describe(
      'Cena concreta ligada ao conteúdo da página: assunto, ação, ambiente e enquadramento.',
    ),
  role: z.enum(SCENE_ROLES),
  targetBlock: z.enum(SCENE_TARGET_BLOCKS),
  page: z.string().max(160).optional(),
});

export type PlannedSceneInput = z.infer<typeof plannedSceneInputSchema>;
