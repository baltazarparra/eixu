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
  heroCompositionFor,
  structureGrammar,
  type Vibe,
} from '@/lib/design/vibes';
import type { DesignProfile } from '@/lib/design/profile';
import type { ImageStyle } from '@/lib/types';
import { styleOfPrompt } from '@/lib/images/style';
import {
  commercialScenes,
  resolveCommercialVariants,
} from '@/lib/design/commercial-variants';
import { briefDepth, homeSectionFloor } from '@/lib/taste/metrics';

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
  /** Estilo desta vaga, quando a área pede outra natureza de imagem. */
  estilo?: ImageStyle;
  /** Pede a arte recortada, sem fundo. */
  transparent?: boolean;
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
        Partial<Pick<DesignProfile, 'version'>> &
        Partial<Pick<DesignProfile, 'commercialVariants'>>)
    | undefined,
  organicPages = 3,
  vibe: Vibe = 'comercial',
  brief: Record<string, unknown> = {},
): PlannedScene[] {
  const legacy = design?.version === 2 || design?.version === 3;
  const grammar = legacy ? undefined : structureGrammar(vibe, design);
  const structure = grammar?.structure;
  // V6 usa a abertura escolhida a partir da referência; perfis v4/v5 continuam
  // limitados à faixa da vibe com que foram criados.
  const composition = legacy
    ? design.heroComposition
    : design?.version === 6
      ? design.heroComposition
      : heroCompositionFor(vibe, design?.heroComposition);
  if (design?.version === 8 && structure?.vibe === 'comercial') {
    // As vagas saem da combinação de variações do tenant: cada área declara
    // quantas fotos pede, em que proporção e com que pedido.
    return commercialScenes(
      resolveCommercialVariants(design.commercialVariants),
    ).map((scene) => ({ ...scene, page: '' }));
  }
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
  if (vibe === 'landing') {
    scenes.push(
      {
        role: 'apoio',
        targetBlock: 'media.image',
        ratio: '16:9',
        page: '',
        hint: 'Detalhe real do produto ou resultado para a home; nunca um retrato de depoimento inventado.',
      },
      {
        role: 'apoio',
        targetBlock: 'cta.band',
        ratio: '16:9',
        page: '',
        hint: 'Foto panorâmica de apoio ao fechamento; no layout cover, preserve uma área limpa para o texto sob a camada de contraste.',
      },
    );
    return scenes.map((scene) => ({ ...scene, page: '' }));
  }
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
  if (
    structure?.vibe === 'comercial' &&
    homeSectionFloor(structure, briefDepth(brief)) >= 7 &&
    scenes.length < 6
  )
    scenes.push({
      role: 'apoio',
      targetBlock: 'narrative.split',
      ratio: '5:6',
      page: '',
      hint: 'Cena vertical de apoio para aprofundar a narrativa da home comercial, sem simular prova ou cliente.',
    });
  return scenes.slice(0, 6);
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
  return `${scene.role} · targetBlock ${scene.targetBlock} · ${scene.ratio}${
    scene.estilo ? ` · ${scene.estilo}` : ''
  }${scene.transparent ? ' recortada sem fundo' : ''} · ${scene.request ?? scene.hint}${scene.page ? ` · página ${scene.page}` : ''}`;
}

/** Plano legível para o prompt da fase de cenas. */
export function scenePlanText(scenes: PlannedScene[]): string {
  return scenes
    .map((scene, index) => `${index + 1}. ${sceneText(scene)}`)
    .join('\n');
}

/** O que uma imagem precisa expor para preencher uma vaga do plano. */
export type CoverageImage = {
  targetBlock: string | null;
  ratio: string;
  promptFinal?: string;
};

/**
 * Proporção e natureza. `ratioFits` aceita proporção desconhecida, porque lá ela
 * só vira aviso; aqui ela decidiria pular uma geração inteira, e foto sem
 * proporção legível não pode dar a vaga por preenchida.
 *
 * A natureza importa pelo mesmo motivo: um upload 4:3 do comércio tem o bloco e
 * a proporção da vaga de gravura, e sem esta comparação daria a vaga por
 * coberta — a seção renderizaria fotos sob o CSS feito para traço recortado.
 */
function fits(image: CoverageImage, scene: PlannedScene): boolean {
  if (ratioValue(image.ratio) === null || !ratioFits(image.ratio, scene.ratio))
    return false;
  const natureza = styleOfPrompt(image.promptFinal);
  // Vaga sem estilo próprio segue o guia do cliente, que nunca é gravura: só
  // precisa recusar um desenho recortado. Assim um tenant com guia de
  // ilustração continua aproveitando o que já gerou.
  return scene.estilo ? natureza === scene.estilo : natureza !== 'gravura';
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
