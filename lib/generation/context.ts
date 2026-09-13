import { isDesignProfile } from '@/lib/design/profile';
import {
  sceneCoverage,
  scenePlanText,
  sceneText,
} from '@/lib/images/scene-plan';
import { plannedScenes } from '@/lib/sites/generation';
import { availablePhotos } from '@/lib/taste/metrics';
import type { Phase } from '@/lib/taste/phases';
import { systemPrompt, type PromptContext } from '@/lib/taste/prompt';
import type { Page, Tenant, TenantImage } from '@/lib/types';
import { CURRENT_SITE_IMAGE_MODEL } from '@/lib/current-site/constants';

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
        `- #${image.seq} (${image.kind}${image.model === 'upload' ? ', enviada pelo operador' : image.model === CURRENT_SITE_IMAGE_MODEL ? ', importada do site atual' : ''}), ${image.ratio}, ${image.targetBlock ?? 'livre'}: ${image.url} | ${image.alt ?? image.description ?? image.requestText}`,
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
      visual?: unknown;
    }[]
  )
    .map((source) =>
      `- ${source.url} [${source.status}${source.motivo ? `: ${source.motivo}` : ''}] ${source.titulo ?? ''} ${source.texto ?? ''}${source.visual ? `\nLeitura visual: ${JSON.stringify(source.visual)}` : ''}`.trim(),
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
  const { covered, missing } = sceneCoverage(plan, availablePhotos(images));
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
 * Última leitura registrada e limite da única passagem de conferência.
 */
export function reviewContext(tenant: Tenant): string {
  const receipt = JSON.stringify(
    (tenant.brief.generation as { review?: unknown } | undefined)?.review ??
      null,
  );
  return `Análise solicitada pelo operador, fora da geração. Comece por review_pages no rascunho atual. Indisponibilidade visual encerra a tentativa, sem editar por esse motivo nem reabrir a geração. Última leitura registrada:\n${receipt}`;
}

/** Instruções completas de uma fase, prontas para o agente. */
export function phaseInstructions(input: {
  tenant: Tenant;
  pages: Page[];
  images: TenantImage[];
  phase: Phase;
  page?: string;
  extra?: Partial<PromptContext>;
}): string {
  const { tenant, pages, images, phase } = input;
  const context: PromptContext = {
    phase,
    sources: sourcesText(tenant),
    review: phase === 'revisao' ? reviewContext(tenant) : undefined,
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
