import {
  expectedRatio,
  ratioFits,
  ratioValue,
  type Ratio,
} from '@/lib/images/ratios';
import {
  SCENE_ROLES,
  SCENE_TARGET_BLOCKS,
  plannedSceneInputSchema,
  type PlannedSceneInput,
  type SceneRole,
} from '@/lib/images/scene-slots';
import {
  VIBE_GRAMMAR,
  heroCompositionFor,
  type Vibe,
} from '@/lib/design/vibes';
import { structureFor } from '@/lib/design/structures';
import type { DesignProfile } from '@/lib/design/profile';

export {
  SCENE_ROLES,
  SCENE_TARGET_BLOCKS,
  plannedSceneInputSchema,
  type PlannedSceneInput,
  type SceneRole,
};

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
 * uma cena por página orgânica.
 *
 * Os alvos vêm da gramática da vibe (lib/design/vibes.ts), não de uma lista
 * fixa. Antes o plano pedia sempre feature.explorer, narrative.split e
 * media.image, e a foto nascia rotulada com esse bloco: a composição montava a
 * mesma sequência em qualquer vibe, porque usar a foto em outro lugar virava
 * aviso de proporção. Medido em 12/09/2026 nos clientes chiquinho e tech.
 * Perfis v2/v3 conservam o plano anterior para retomar sem descartar pedidos
 * semânticos nem reabrir vagas já cobertas pela biblioteca.
 */
export function scenePlan(
  design:
    | (Pick<DesignProfile, 'heroComposition'> &
        Partial<Pick<DesignProfile, 'structure'>> &
        Partial<Pick<DesignProfile, 'version'>>)
    | undefined,
  organicPages = 3,
  vibe: Vibe = 'comercial',
): PlannedScene[] {
  const legacy = design?.version === 2 || design?.version === 3;
  const structure =
    design?.version === 5 ? structureFor(vibe, design.structure) : null;
  const grammar = legacy
    ? undefined
    : structure
      ? { ...VIBE_GRAMMAR[vibe], ...structure }
      : VIBE_GRAMMAR[vibe];
  // A abertura da home pertence à vibe. Sob direção por referência o eixo pode
  // ter sido escolhido fora da faixa; a cena segue a composição que a vibe
  // sustenta, senão a foto nasceria na proporção de um hero que a home não usa.
  const composition = legacy
    ? design.heroComposition
    : heroCompositionFor(vibe, design?.heroComposition);
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
  const [protagonist, protagonistLayout] = (
    grammar?.protagonists[0] ?? 'feature.explorer:showroom'
  ).split(':');
  for (let i = 0; i < 2; i++)
    scenes.push({
      role: 'protagonista',
      targetBlock: protagonist,
      ratio:
        structure?.signatureRatio ??
        expectedRatio(protagonist, protagonistLayout),
      hint: `Uma aplicação concreta do serviço ou produto, para a seção protagonista da home em ${grammar?.protagonists[0] ?? 'feature.explorer:showroom'}.`,
    });
  const inner = Math.max(0, Math.min(3, organicPages - 1));
  for (let i = 0; i < inner; i++) {
    const support = grammar?.support ?? ['narrative.split', 'media.image'];
    const block = support[i % support.length];
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
    ratioValue(image.ratio) !== null && ratioFits(image.ratio, scene.ratio)
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
