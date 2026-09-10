import { expectedRatio, type Ratio } from '@/lib/images/ratios';
import type { DesignProfile } from '@/lib/design/profile';

export const SCENE_ROLES = [
  'hero',
  'hero-detail',
  'protagonista',
  'subpagina',
  'apoio',
] as const;
export type SceneRole = (typeof SCENE_ROLES)[number];

export type PlannedScene = {
  role: SceneRole;
  targetBlock: string;
  ratio: Ratio;
  hint: string;
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

/** Plano legível para o prompt da fase de cenas. */
export function scenePlanText(scenes: PlannedScene[]): string {
  return scenes
    .map(
      (scene, index) =>
        `${index + 1}. ${scene.role} · targetBlock ${scene.targetBlock} · ${scene.ratio} · ${scene.hint}`,
    )
    .join('\n');
}
