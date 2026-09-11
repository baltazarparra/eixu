import { critique } from '@/lib/images/critic';
import { generateCandidates } from '@/lib/images/generate';
import { fetchReference, generateLogoCandidates } from '@/lib/images/logo';
import { critiqueLogo } from '@/lib/images/logo-critic';
import { getGuide } from '@/lib/images/queries';
import { RATIOS, type Ratio } from '@/lib/images/ratios';
import type { Critique, Tenant, TenantImage } from '@/lib/types';

/** Mantém a imagem anterior no acervo e gera uma versão usando seus pixels. */
export async function reviseImage(
  tenant: Tenant,
  previous: TenantImage,
  request: string,
  logo: { brandName?: string; wordmark?: boolean } = {},
): Promise<TenantImage> {
  if (!(RATIOS as readonly string[]).includes(previous.ratio))
    throw new Error(`A proporção da imagem #${previous.seq} não é suportada.`);
  const [guide, reference] = await Promise.all([
    getGuide(tenant.id),
    fetchReference(previous.url),
  ]);
  const description = `Alterar a imagem #${previous.seq}: ${request}`;
  let image: TenantImage;
  let review: Critique;
  if (previous.kind === 'logo') {
    const brandName = logo.brandName?.trim() || tenant.name;
    const wordmark = logo.wordmark ?? previous.critique.nome_lido !== '';
    const result = await generateLogoCandidates({
      tenant,
      guide,
      mode: 'modernizar',
      brandName,
      wordmark,
      revision: request,
      reference,
      referenceUrl: previous.url,
      variants: 1,
    });
    const generated = result.images[0];
    if (!generated)
      throw new Error(
        result.failures.join(' | ') || 'Não foi possível alterar o logo.',
      );
    review = await critiqueLogo({
      id: generated.id,
      bytes: generated.bytes,
      variant: generated.variant,
      mode: 'modernizar',
      brandName,
      wordmark,
      reference,
    });
    image = generated;
  } else {
    const result = await generateCandidates({
      tenant,
      guide,
      request: `${description}. Use a imagem anexada como base e preserve o que não foi solicitado mudar.`,
      ratio: previous.ratio as Ratio,
      targetBlock: previous.targetBlock ?? 'livre',
      models: ['openai/gpt-image-2'],
      reference,
      referenceUrl: previous.url,
    });
    const generated = result.images[0];
    if (!generated)
      throw new Error(
        result.failures.join(' | ') || 'Não foi possível alterar a imagem.',
      );
    review = await critique({
      id: generated.id,
      bytes: generated.bytes,
      guide,
      request: description,
      ratio: previous.ratio,
      targetBlock: previous.targetBlock ?? 'livre',
    });
    image = generated;
  }
  return {
    ...image,
    alt: review.alt_sugerido || `Imagem gerada para ${tenant.name}`,
    description: review.descricao || description,
    critique: review,
    score: review.nota ?? null,
  };
}
