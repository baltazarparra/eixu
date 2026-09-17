import { randomUUID } from 'node:crypto';
import { generateImage } from 'ai';
import { putTenantBlob } from '@/lib/blob/tenant-files';
import sharp from 'sharp';
import { FRAMING, dimensionsFor, type Ratio } from '@/lib/images/ratios';
import { insertImage } from '@/lib/images/queries';
import { trackImageUsage } from '@/lib/ai/usage-ledger';
import type { ImageGuide, ImageStyle, Tenant, TenantImage } from '@/lib/types';

const ESTILO: Record<ImageStyle, string> = {
  fotografia:
    'Fotografia documental, câmera com lente 35mm, profundidade de campo natural',
  ilustracao: 'Ilustração editorial vetorial, traço limpo, sem contorno pesado',
  '3d': 'Render 3D suave, materiais foscos, iluminação de estúdio',
  gravura:
    'Gravura de traço, desenho a bico de pena com hachura fina e monocromática, assunto isolado e recortado, sem cenário ao redor',
};

/** As negativas de fotografia não servem a um desenho e vice-versa. */
const NEGATIVAS: Record<ImageStyle, readonly string[]> = {
  fotografia: ['sem cara de banco de imagens, sem pose artificial'],
  ilustracao: ['sem cara de banco de imagens'],
  '3d': ['sem cara de banco de imagens'],
  gravura: [
    'sem fotografia, sem render, sem textura fotográfica',
    'sem cenário, sem chão, sem sombra projetada',
    'sem preenchimento de cor chapada no fundo',
  ],
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
  options?: {
    allowText?: boolean;
    extraNegatives?: string[];
    /** Estilo da vaga; sobrepõe o do guia só nesta cena. */
    estilo?: ImageStyle;
    /** Pede a arte recortada, sem fundo. */
    transparent?: boolean;
  },
): string {
  const estilo = options?.estilo ?? guide.estilo ?? 'fotografia';
  const parts: string[] = [];
  parts.push(ESTILO[estilo] ?? ESTILO.fotografia);
  parts.push(request.trim());
  // Ambiente, presença e luz descrevem uma cena fotográfica. Numa gravura
  // recortada eles pediriam o cenário que a arte justamente não deve ter; a
  // paleta continua, porque é o que mantém o desenho no tom do projeto.
  if (estilo !== 'gravura') {
    if (guide.ambientes?.length)
      parts.push(`Ambiente: ${guide.ambientes.join(', ')}`);
    if (guide.sujeitos?.length)
      parts.push(`Presença típica: ${guide.sujeitos.join(', ')}`);
    if (guide.luz) parts.push(`Luz: ${guide.luz}`);
  }
  if (guide.paleta?.length) parts.push(`Paleta: ${guide.paleta.join(', ')}`);
  if (guide.notas) parts.push(guide.notas);
  // Ambiente e luz descrevem uma cena fotográfica; numa gravura recortada eles
  // pediriam justamente o cenário que a arte não deve ter.
  if (estilo !== 'gravura') parts.push(FRAMING[targetBlock] ?? FRAMING.livre);
  if (options?.transparent)
    parts.push(
      'Fundo totalmente transparente, sem cor de fundo, com a arte recortada até a borda do traço',
    );
  parts.push(`Proporção ${ratio}`);

  const negatives = [
    ...(options?.allowText
      ? []
      : ['nenhum texto, letreiro, legenda ou marca dágua']),
    'nenhum logotipo ou marca reconhecível',
    'sem colagem, sem moldura, sem borda',
    ...NEGATIVAS[estilo],
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
  /** Estilo desta vaga, quando a área pede outra natureza de imagem. */
  estilo?: ImageStyle;
  /** Pede a arte sem fundo ao gerador. */
  transparent?: boolean;
  /** Imagem existente do tenant, usada para uma alteração por número. */
  reference?: Buffer;
  referenceUrl?: string;
}): Promise<{ batchId: string; images: Candidate[]; failures: string[] }> {
  const batchId = randomUUID();
  const prompt = composePrompt(
    input.guide,
    input.request,
    input.ratio,
    input.targetBlock,
    {
      allowText: input.allowText,
      extraNegatives: input.extraNegatives,
      estilo: input.estilo,
      transparent: input.transparent,
    },
  );

  const settled = await Promise.allSettled(
    input.models.map(async (model) => {
      const result = await trackImageUsage(
        { tenantId: input.tenant.id, kind: 'imagem', model },
        () =>
          generateImage({
            model,
            prompt: input.reference
              ? { text: prompt, images: [input.reference] }
              : prompt,
            ...dimensionsFor(model, input.ratio),
            // O canal alfa precisa ser pedido ao provedor: só a negativa no
            // texto devolve um fundo chapado. PNG é o formato que o carrega
            // até o sharp, que preserva o alfa ao converter para WebP.
            ...(input.transparent
              ? {
                  providerOptions: {
                    openai: {
                      background: 'transparent',
                      output_format: 'png',
                    },
                  },
                }
              : {}),
            maxRetries: 1,
          }),
      );
      // Aviso do gateway significa parâmetro ignorado: a imagem pode ter saído
      // na proporção errada, e é melhor descobrir pelo log do que pelo site.
      if (result.warnings.length) {
        console.warn(
          `[imagens] ${model} ignorou parâmetros:`,
          JSON.stringify(result.warnings),
        );
      }
      return { model, file: result.image };
    }),
  );

  const images: Candidate[] = [];
  const failures: string[] = [];

  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      const reason =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : 'falha desconhecida';
      failures.push(`${input.models[index]}: ${reason.slice(0, 140)}`);
      continue;
    }
    const { model, file } = outcome.value;
    try {
      const webp = await sharp(Buffer.from(file.uint8Array))
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();

      const blob = await putTenantBlob(
        input.tenant.id,
        `gerado/${batchId}/${index + 1}.webp`,
        webp,
        {
          access: 'public',
          addRandomSuffix: false,
          contentType: 'image/webp',
        },
      );

      const row = await insertImage({
        tenantId: input.tenant.id,
        batchId,
        requestText: input.request,
        targetBlock: input.targetBlock,
        ratio: input.ratio,
        model,
        promptFinal: prompt,
        url: blob.url,
        blobPath: blob.pathname,
        referenceUrls: input.referenceUrl ? [input.referenceUrl] : [],
      });
      images.push({ ...row, bytes: new Uint8Array(webp) });
    } catch (error) {
      failures.push(
        `${model}: ${error instanceof Error ? error.message.slice(0, 140) : 'falha ao salvar'}`,
      );
    }
  }

  return { batchId, images, failures };
}
