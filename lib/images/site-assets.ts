import { critique } from '@/lib/images/critic';
import { generateCandidates } from '@/lib/images/generate';
import { getGuide, guideIsEmpty, setGuide } from '@/lib/images/queries';
import type { Ratio } from '@/lib/images/ratios';
import type { Tenant } from '@/lib/types';

/** O chat de site usa o mesmo gerador, armazenamento e crítico do estúdio. */
export async function prepareSiteImages(
  tenant: Tenant,
  scenes: { request: string; targetBlock: string; ratio: Ratio }[],
) {
  let guide = await getGuide(tenant.id);
  if (guideIsEmpty(guide))
    guide = await setGuide(tenant.id, {
      estilo: 'fotografia',
      luz: 'Luz natural coerente com o ambiente; sombras suaves e materiais plausíveis.',
      paleta: [
        tenant.brand.paper,
        tenant.brand.accent,
        tenant.brand.accentAlt,
      ].filter((v): v is string => !!v),
      notas: `${tenant.brand.design?.concept ?? ''}. Imagens ilustrativas coerentes com a oferta: ${typeof tenant.brief.offer === 'string' ? tenant.brief.offer : tenant.name}. Não representam obras, equipe ou instalações comprovadas da empresa.`,
      nunca: [
        'Texto e logos inventados',
        'Pessoas ou resultados apresentados como reais sem evidência',
      ],
    });
  const candidates = [];
  // Sequencial: a numeração humana de imagens pertence ao tenant.
  for (const scene of scenes) {
    const result = await generateCandidates({
      tenant,
      guide,
      ...scene,
      models: ['openai/gpt-image-2'],
    });
    for (const image of result.images) {
      const review = await critique({
        id: image.id,
        bytes: image.bytes,
        guide,
        ...scene,
      });
      candidates.push({
        numero: `#${image.seq}`,
        url: image.url,
        ratio: image.ratio,
        alt: review.alt_sugerido ?? '',
        status: 'candidata',
        nota: review.nota ?? null,
        problemas: review.problemas ?? [],
        targetBlock: scene.targetBlock,
      });
    }
    if (result.failures.length)
      return {
        candidatas: candidates,
        falhas: result.failures,
        aprovacao: 'A aprovação das candidatas é do operador.',
      };
  }
  return {
    candidatas: candidates,
    aprovacao:
      'Monte o rascunho com estas imagens e peça a aprovação do operador no estúdio antes de publicar.',
  };
}
