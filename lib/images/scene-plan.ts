import { z } from 'zod';
import {
  RATIOS,
  expectedRatio,
  ratioFits,
  type Ratio,
} from '@/lib/images/ratios';
import type { DesignProfile } from '@/lib/design/profile';

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

export type PlannedScene = {
  role: SceneRole;
  targetBlock: string;
  ratio: Ratio;
  hint: string;
  /** Pedido semântico produzido junto do plano editorial. */
  request?: string;
  page?: string;
};

/**
 * Repertório mínimo para a composição prevista no contrato: abertura, detalhe
 * de materialidade quando o hero é atelier, aplicações da seção protagonista e
 * uma cena por página orgânica. Sem esse plano o agente gerava duas fotos e
 * montava três páginas de texto.
 */
export function scenePlan(
  design: Pick<DesignProfile, 'heroComposition'> | undefined,
  organicPages = 3,
): PlannedScene[] {
  const composition = design?.heroComposition ?? 'split';
  const heroBlock = `hero.${composition}`;
  const scenes: PlannedScene[] = [
    {
      role: 'hero',
      targetBlock: heroBlock,
      ratio: expectedRatio(heroBlock),
      hint: 'A cena de abertura, na composição escolhida para o hero.',
    },
  ];
  if (composition === 'atelier')
    scenes.push({
      role: 'hero-detail',
      targetBlock: 'hero.atelier',
      ratio: expectedRatio('hero.atelier'),
      hint: 'O detalhe em primeiro plano que acompanha o ambiente na abertura.',
    });
  for (let i = 0; i < 2; i++)
    scenes.push({
      role: 'protagonista',
      targetBlock: 'feature.explorer',
      ratio: expectedRatio('feature.explorer'),
      hint: 'Uma aplicação concreta do serviço ou produto, para a seção protagonista da home.',
    });
  const inner = Math.max(0, Math.min(3, organicPages - 1));
  for (let i = 0; i < inner; i++) {
    const block = i % 2 === 0 ? 'narrative.split' : 'media.image';
    scenes.push({
      role: 'subpagina',
      targetBlock: block,
      ratio: expectedRatio(block),
      hint: 'A cena de uma página interna, coerente com o assunto dela.',
    });
  }
  return scenes;
}

/** O plano semântico precisa preencher exatamente as vagas estruturais. */
export function sceneRequestsMatchPlan(
  plan: PlannedScene[],
  requests: PlannedSceneInput[],
): boolean {
  if (plan.length !== requests.length) return false;
  const remaining = [...plan];
  for (const request of requests) {
    const index = remaining.findIndex(
      (scene) =>
        scene.role === request.role &&
        scene.targetBlock === request.targetBlock,
    );
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return remaining.length === 0;
}

/** Uma cena legível para o prompt. */
export function sceneText(scene: PlannedScene): string {
  return `${scene.role} · targetBlock ${scene.targetBlock} · ${scene.ratio} · ${scene.request ?? scene.hint}${scene.page ? ` · página ${scene.page}` : ''}`;
}

/** Plano legível para o prompt da fase de cenas. */
export function scenePlanText(scenes: PlannedScene[]): string {
  return scenes
    .map((scene, index) => `${index + 1}. ${sceneText(scene)}`)
    .join('\n');
}

/** O que uma imagem precisa expor para preencher uma vaga do plano. */
export type CoverageImage = { targetBlock: string | null; ratio: string };

/**
 * `ratioFits` aceita proporção desconhecida, porque lá ela só vira aviso. Aqui
 * ela decidiria pular uma geração inteira: foto sem proporção legível não pode
 * dar a vaga por preenchida.
 */
function fits(image: CoverageImage, scene: PlannedScene): boolean {
  return (
    (RATIOS as readonly string[]).includes(image.ratio) &&
    ratioFits(image.ratio, scene.ratio)
  );
}

/**
 * Casa a biblioteca disponível com as vagas do plano, uma imagem por vaga. A
 * primeira passada exige o mesmo bloco; a segunda aceita o que sobrevive ao
 * recorte, para uma foto 4:5 antiga cobrir outra vaga 4:5 em vez de obrigar
 * uma geração paga. O papel não precisa ser persistido: bloco e proporção
 * identificam a vaga, inclusive as duas do atelier.
 */
export function sceneCoverage(
  plan: PlannedScene[],
  available: CoverageImage[],
): { covered: PlannedScene[]; missing: PlannedScene[] } {
  const pool = [...available];
  const covered: PlannedScene[] = [];
  const pending: PlannedScene[] = [];
  const missing: PlannedScene[] = [];

  for (const scene of plan) {
    const index = pool.findIndex(
      (image) => image.targetBlock === scene.targetBlock && fits(image, scene),
    );
    if (index === -1) pending.push(scene);
    else {
      pool.splice(index, 1);
      covered.push(scene);
    }
  }
  for (const scene of pending) {
    const index = pool.findIndex((image) => fits(image, scene));
    if (index === -1) missing.push(scene);
    else {
      pool.splice(index, 1);
      covered.push(scene);
    }
  }
  return { covered, missing };
}
