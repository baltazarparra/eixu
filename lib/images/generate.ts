import { randomUUID } from 'node:crypto';
import { generateImage } from 'ai';
import { put } from '@vercel/blob';
import sharp from 'sharp';
import { FRAMING, dimensionsFor, type Ratio } from '@/lib/images/ratios';
import { insertImage } from '@/lib/images/queries';
import type { ImageGuide, Tenant, TenantImage } from '@/lib/types';

/** Modelos padrão: dois motores diferentes dão variedade real de composição. */
export const DEFAULT_MODELS = ['openai/gpt-image-2', 'openai/gpt-image-2', 'bfl/flux-2-pro'] as const;

const ESTILO: Record<string, string> = {
  fotografia: 'Fotografia documental, câmera com lente 35mm, profundidade de campo natural',
  ilustracao: 'Ilustração editorial vetorial, traço limpo, sem contorno pesado',
  '3d': 'Render 3D suave, materiais foscos, iluminação de estúdio',
};

/**
 * Monta o prompt final: guia do cliente, pedido, enquadramento do bloco e as
 * negativas. Guardamos essa string na linha da imagem para dar para regenerar
 * igual depois e para o crítico saber o que foi pedido.
 */
export function composePrompt(
  guide: ImageGuide,
  request: string,
  ratio: Ratio,
  targetBlock: string,
  options?: { allowText?: boolean; extraNegatives?: string[] },
): string {
  const parts: string[] = [];
  parts.push(ESTILO[guide.estilo ?? 'fotografia'] ?? ESTILO.fotografia);
  parts.push(request.trim());
  if (guide.ambientes?.length) parts.push(`Ambiente: ${guide.ambientes.join(', ')}`);
  if (guide.sujeitos?.length) parts.push(`Presença típica: ${guide.sujeitos.join(', ')}`);
  if (guide.luz) parts.push(`Luz: ${guide.luz}`);
  if (guide.paleta?.length) parts.push(`Paleta: ${guide.paleta.join(', ')}`);
  if (guide.notas) parts.push(guide.notas);
  parts.push(FRAMING[targetBlock] ?? FRAMING.livre);
  parts.push(`Proporção ${ratio}`);

  const negatives = [
    ...(options?.allowText ? [] : ['nenhum texto, letreiro, legenda ou marca dágua']),
    'nenhum logotipo ou marca reconhecível',
    'sem colagem, sem moldura, sem borda',
    'sem cara de banco de imagens, sem pose artificial',
    ...(guide.nunca ?? []),
    ...(options?.extraNegatives ?? []),
  ];
  parts.push(`Evitar: ${negatives.join('; ')}.`);

  return parts.filter(Boolean).join('. ').replace(/\.\.+/g, '.');
}

export type Candidate = TenantImage & { bytes: Uint8Array };

/**
 * Gera as candidatas em paralelo. Cada uma vira WebP redimensionado antes de
 * subir: um PNG de 1024x1536 passa de 1 MB e derrubaria o LCP do site do
 * cliente, que é justamente o que o gerador existe para proteger.
 */
export async function generateCandidates(input: {
  tenant: Tenant;
  guide: ImageGuide;
  request: string;
  ratio: Ratio;
  targetBlock: string;
  models: readonly string[];
  allowText?: boolean;
  extraNegatives?: string[];
}): Promise<{ batchId: string; images: Candidate[]; failures: string[] }> {
  const batchId = randomUUID();
  const prompt = composePrompt(input.guide, input.request, input.ratio, input.targetBlock, {
    allowText: input.allowText,
    extraNegatives: input.extraNegatives,
  });

  const settled = await Promise.allSettled(
    input.models.map(async (model) => {
      const result = await generateImage({
        model,
        prompt,
        ...dimensionsFor(model, input.ratio),
        maxRetries: 1,
      });
      // Aviso do gateway significa parâmetro ignorado: a imagem pode ter saído
      // na proporção errada, e é melhor descobrir pelo log do que pelo site.
      if (result.warnings.length) {
        console.warn(`[imagens] ${model} ignorou parâmetros:`, JSON.stringify(result.warnings));
      }
      return { model, file: result.image };
    }),
  );

  const images: Candidate[] = [];
  const failures: string[] = [];

  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      const reason = outcome.reason instanceof Error ? outcome.reason.message : 'falha desconhecida';
      failures.push(`${input.models[index]}: ${reason.slice(0, 140)}`);
      continue;
    }
    const { model, file } = outcome.value;
    try {
      const webp = await sharp(Buffer.from(file.uint8Array))
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const blobPath = `tenants/${input.tenant.slug}/gerado/${batchId}/${index + 1}.webp`;
      const blob = await put(blobPath, webp, {
        access: 'public',
        addRandomSuffix: false,
        contentType: 'image/webp',
      });

      const row = await insertImage({
        tenantId: input.tenant.id,
        batchId,
        requestText: input.request,
        targetBlock: input.targetBlock,
        ratio: input.ratio,
        model,
        promptFinal: prompt,
        url: blob.url,
        blobPath,
      });
      images.push({ ...row, bytes: new Uint8Array(webp) });
    } catch (error) {
      failures.push(`${model}: ${error instanceof Error ? error.message.slice(0, 140) : 'falha ao salvar'}`);
    }
  }

  return { batchId, images, failures };
}
