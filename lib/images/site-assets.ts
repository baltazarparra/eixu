import { critique } from '@/lib/images/critic';
import { generateCandidates } from '@/lib/images/generate';
import { getGuide } from '@/lib/images/queries';
import type { Ratio } from '@/lib/images/ratios';
import type { SceneRole } from '@/lib/images/scene-plan';
import type { Tenant } from '@/lib/types';

export type SiteScene = {
  request: string;
  targetBlock: string;
  ratio: Ratio;
  role: SceneRole;
};

/** Executa em lotes: o gateway aguenta o paralelo, o banco numera sozinho. */
async function inBatches<I, O>(
  items: I[],
  size: number,
  run: (item: I) => Promise<O>,
): Promise<O[]> {
  const out: O[] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

/**
 * O chat de site usa o mesmo gerador, armazenamento e crítico do estúdio.
 * O guia de imagem precisa existir antes: um guia genérico produzia cenas sem
 * paleta nem ambiente, que é o que deixava o site sem identidade.
 */
export async function prepareSiteImages(tenant: Tenant, scenes: SiteScene[]) {
  const guide = await getGuide(tenant.id);
  const results = await inBatches(scenes, 3, async (scene) => {
    const result = await generateCandidates({
      tenant,
      guide,
      request: scene.request,
      ratio: scene.ratio,
      targetBlock: scene.targetBlock,
      models: ['openai/gpt-image-2'],
    });
    const reviewed = await Promise.all(
      result.images.map(async (image) => {
        const review = await critique({
          id: image.id,
          bytes: image.bytes,
          guide,
          request: scene.request,
          ratio: scene.ratio,
          targetBlock: scene.targetBlock,
        });
        const nota = review.nota ?? null;
        return {
          numero: `#${image.seq}`,
          url: image.url,
          ratio: image.ratio,
          alt: review.alt_sugerido ?? '',
          status: 'disponivel' as const,
          papel: scene.role,
          targetBlock: scene.targetBlock,
          nota,
          problemas: review.problemas ?? [],
          // Nota baixa ou reprovação do crítico não descarta nada sozinha:
          // serve para o agente decidir entre usar e pedir outra cena.
          recomendacao:
            review.aprovado && (nota ?? 0) >= 7
              ? ('usar' as const)
              : ('regerar' as const),
        };
      }),
    );
    return { imagens: reviewed, falhas: result.failures };
  });

  const imagens = results.flatMap((r) => r.imagens);
  const falhas = results.flatMap((r) => r.falhas);
  return {
    imagens,
    ...(falhas.length ? { falhas } : {}),
    orientacao:
      'As imagens já estão na biblioteca e podem ser usadas pelas URLs retornadas, sem aprovação. O usuário pode pedir alterações pelo número no chat do site.',
  };
}
