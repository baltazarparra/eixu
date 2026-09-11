import { isDesignProfile } from '@/lib/design/profile';
import {
  sceneCoverage,
  scenePlanText,
  sceneText,
} from '@/lib/images/scene-plan';
import { REVIEW_ROUNDS } from '@/lib/generation/marker';
import { plannedScenes } from '@/lib/sites/generation';
import { generatedPhotos } from '@/lib/taste/metrics';
import type { Phase } from '@/lib/taste/phases';
import { systemPrompt, type PromptContext } from '@/lib/taste/prompt';
import type { Page, Tenant, TenantImage } from '@/lib/types';

/**
 * O prompt de uma fase é o mesmo no chat e no runner do servidor. Estava só
 * dentro da rota, então o laço da geração precisava de um navegador aberto
 * para existir.
 */

/** A fase só abre com o estado que ela pressupõe. */
export function phaseBlocker(
  phase: Phase,
  tenant: Tenant,
  pages: Page[],
): string | null {
  const hasDesign = isDesignProfile(tenant.brand.design);
  if (phase !== 'briefing' && !hasDesign)
    return 'A direção de arte ainda não existe. Rode a fase de briefing antes.';
  if (phase === 'revisao' && !pages.length)
    return 'Não há páginas para revisar. Rode a fase de composição antes.';
  return null;
}

export function pagesSummary(pages: Page[]): string {
  return pages
    .map(
      (page) =>
        `- /${page.slug} (${page.type}, ${page.blocks.length} blocos${page.publishedBlocks ? ', publicada' : ''}): ${page.title}`,
    )
    .join('\n');
}

export function imagesSummary(images: TenantImage[]): string {
  return images
    .filter((image) => image.status !== 'rejeitada')
    .slice(0, 12)
    .map(
      (image) =>
        `- #${image.seq} (${image.kind}), ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? image.requestText}`,
    )
    .join('\n');
}

export function sourcesText(tenant: Tenant): string {
  if (!Array.isArray(tenant.brief.sources)) return '';
  return (
    tenant.brief.sources as {
      url?: string;
      status?: string;
      motivo?: string;
      titulo?: string;
      texto?: string;
    }[]
  )
    .map((source) =>
      `- ${source.url} [${source.status}${source.motivo ? `: ${source.motivo}` : ''}] ${source.titulo ?? ''} ${source.texto ?? ''}`.trim(),
    )
    .join('\n');
}

/**
 * Plano, cobertura e as vagas que faltam. A etapa recebe todas de uma vez: o
 * estúdio gera em lotes paralelos, e uma requisição por cena transformava
 * cinco fotos em cinco minutos de espera com o painel parado.
 */
export function scenesContext(tenant: Tenant, images: TenantImage[]) {
  const plan = plannedScenes(tenant);
  const { covered, missing } = sceneCoverage(plan, generatedPhotos(images));
  return {
    scenePlan: scenePlanText(plan),
    coverage: `${covered.length} de ${plan.length} vagas já têm foto disponível.`,
    ...(missing.length
      ? {
          missingScenes: missing
            .map((scene, index) => `${index + 1}. ${sceneText(scene)}`)
            .join('\n'),
        }
      : {}),
  };
}

/**
 * Última leitura registrada. Em uma rodada seguinte, o cabeçalho diz de onde
 * o turno começa e quais pendências precisam de uma nova conferência.
 */
export function reviewContext(tenant: Tenant, round = 0): string {
  const receipt = JSON.stringify(
    (tenant.brief.generation as { review?: unknown } | undefined)?.review ??
      null,
  );
  if (round < 1) return receipt;
  const continuation =
    round < REVIEW_ROUNDS
      ? 'Se ainda houver pendências e trabalho salvo, a geração pode abrir outra rodada automaticamente.'
      : 'Esta é a última rodada desta execução. Se restarem pendências, informe o que falta sem prometer continuação automática.';
  const previous =
    round > 1
      ? 'A anterior terminou sem conferência limpa. Comece por review_pages no rascunho atual e priorize os erros. '
      : '';
  return `Rodada ${round} de ${REVIEW_ROUNDS} da revisão. ${previous}${continuation} Última leitura registrada:\n${receipt}`;
}

/** Instruções completas de uma fase, prontas para o agente. */
export function phaseInstructions(input: {
  tenant: Tenant;
  pages: Page[];
  images: TenantImage[];
  phase: Phase;
  /** Rodada da revisão, quando a fase repete para conferir o rascunho atual. */
  round?: number;
  page?: string;
  extra?: Partial<PromptContext>;
}): string {
  const { tenant, pages, images, phase } = input;
  const context: PromptContext = {
    phase,
    sources: sourcesText(tenant),
    review: reviewContext(tenant, input.round ?? 0),
    ...(phase === 'cenas' ? scenesContext(tenant, images) : {}),
    ...input.extra,
  };
  return systemPrompt(
    tenant,
    pagesSummary(pages),
    input.page ? `/${input.page}` : '/',
    imagesSummary(images),
    context,
  );
}
