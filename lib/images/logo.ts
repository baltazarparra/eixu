import { randomUUID } from 'node:crypto';
import { generateImage } from 'ai';
import { putTenantBlob } from '@/lib/blob/tenant-files';
import sharp from 'sharp';
import { insertImage } from '@/lib/images/queries';
import type { ImageGuide, Tenant, TenantImage } from '@/lib/types';

/**
 * Logo sai sempre do gpt-image-2. Testado no gateway: é o único que devolve
 * PNG com alfa real, com e sem imagem de referência. O flux-kontext aceita a
 * referência mas entrega fundo branco, o que não serve para uma marca.
 */
const LOGO_MODEL = 'openai/gpt-image-2';

const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;

export type LogoVariant =
  | 'fiel'
  | 'ousada'
  | 'fiel-mono'
  | 'conceito-1'
  | 'conceito-2'
  | 'conceito-3';

export type LogoCandidate = TenantImage & {
  bytes: Uint8Array;
  variant: LogoVariant;
};

/** Baixa o logo antigo do Blob e normaliza para PNG quadrado. */
export async function fetchReference(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      `Não consegui baixar a imagem de referência (${response.status}).`,
    );
  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.length > MAX_REFERENCE_BYTES)
    throw new Error('A imagem de referência passa de 8 MB.');
  // SVG e formatos exóticos viram PNG; o modelo só aceita bitmap.
  return sharp(raw)
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
}

const BASE =
  'Logotipo vetorial flat, formas limpas e sólidas, fundo totalmente transparente. Sem sombra, sem gradiente fotográfico, sem textura, sem mockup, sem moldura, sem cartão de visita, sem fundo colorido.';

function nameRule(brandName: string, wordmark: boolean): string {
  if (!wordmark)
    return 'Sem nenhum texto ou letra na imagem, apenas o símbolo.';
  const spelled = brandName.toUpperCase().split('').join('-');
  return `Escreva exatamente o nome "${brandName}", letra por letra ${spelled}. Nenhuma outra palavra, sigla ou slogan.`;
}

function palette(tenant: Tenant, guide: ImageGuide): string {
  const colors = [
    tenant.brand.accent,
    tenant.brand.ink,
    ...(guide.paleta ?? []),
  ].filter(Boolean);
  return colors.length ? `Paleta: ${colors.slice(0, 4).join(', ')}.` : '';
}

export function composeLogoPrompt(input: {
  variant: LogoVariant;
  tenant: Tenant;
  guide: ImageGuide;
  brandName: string;
  wordmark: boolean;
  brief?: string;
}): string {
  const { variant, tenant, guide, brandName, wordmark, brief } = input;
  const direction: Record<LogoVariant, string> = {
    fiel: 'Refaça este logotipo mantendo o mesmo símbolo, as mesmas cores e as mesmas proporções. Apenas refine: traços mais limpos, espaçamento consistente, tipografia mais legível. A marca precisa continuar reconhecível à primeira vista.',
    'fiel-mono':
      'Refaça este logotipo mantendo símbolo e proporções, em uma cor só, versão monocromática para uso em fundo claro.',
    ousada:
      'Reinterprete este logotipo. Mantenha a ideia central reconhecível, mas simplifique a forma, reduza detalhes e modernize a tipografia. Pode mudar o arranjo e ajustar as cores.',
    'conceito-1': 'Um símbolo simples e memorável acima ou ao lado do nome.',
    'conceito-2':
      'Um monograma com a inicial do nome, dentro de uma forma geométrica simples, com o nome ao lado.',
    'conceito-3': wordmark
      ? 'Apenas tipografia trabalhada, sem símbolo, com um detalhe gráfico discreto em uma letra.'
      : 'Um símbolo abstrato e geométrico que sugira o segmento, sem nenhuma letra.',
  };

  return [
    BASE,
    direction[variant],
    brief ? `Contexto do negócio: ${brief}` : `Negócio: ${tenant.name}.`,
    nameRule(brandName, wordmark),
    palette(tenant, guide),
    'Precisa continuar legível reduzido a 48 pixels de altura.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function variantsFor(
  mode: 'modernizar' | 'criar',
  count: number,
): LogoVariant[] {
  const modernize: LogoVariant[] = ['fiel', 'ousada', 'fiel-mono'];
  const create: LogoVariant[] = ['conceito-1', 'conceito-2', 'conceito-3'];
  return (mode === 'modernizar' ? modernize : create).slice(0, count);
}

export async function generateLogoCandidates(input: {
  tenant: Tenant;
  guide: ImageGuide;
  mode: 'modernizar' | 'criar';
  brandName: string;
  wordmark: boolean;
  brief?: string;
  reference?: Buffer;
  referenceUrl?: string;
  variants: number;
}): Promise<{ batchId: string; images: LogoCandidate[]; failures: string[] }> {
  const batchId = randomUUID();
  const variants = variantsFor(input.mode, input.variants);
  const requestText =
    input.mode === 'modernizar'
      ? `Modernizar o logo de ${input.brandName}`
      : `Criar logo para ${input.brandName}`;

  const settled = await Promise.allSettled(
    variants.map(async (variant) => {
      const text = composeLogoPrompt({
        variant,
        tenant: input.tenant,
        guide: input.guide,
        brandName: input.brandName,
        wordmark: input.wordmark,
        brief: input.brief,
      });
      const result = await generateImage({
        model: LOGO_MODEL,
        prompt: input.reference ? { text, images: [input.reference] } : text,
        size: '1024x1024',
        providerOptions: {
          openai: { background: 'transparent', output_format: 'png' },
        },
        maxRetries: 1,
      });
      if (result.warnings.length) {
        console.warn(
          `[logo] ${LOGO_MODEL} ignorou parâmetros:`,
          JSON.stringify(result.warnings),
        );
      }
      return { variant, text, file: result.image };
    }),
  );

  const images: LogoCandidate[] = [];
  const failures: string[] = [];

  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      const reason =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : 'falha desconhecida';
      failures.push(`${variants[index]}: ${reason.slice(0, 140)}`);
      continue;
    }
    const { variant, text, file } = outcome.value;
    try {
      // Fica em PNG de 1024 para preservar transparência e nitidez de borda,
      // mas quantizado: arte chapada em paleta cai de cerca de 880 KB para
      // 140 KB sem perda visível, e esse arquivo aparece em toda página do
      // cliente, na navegação e no rodapé.
      const png = await sharp(Buffer.from(file.uint8Array))
        .png({ palette: true, quality: 90, effort: 8 })
        .toBuffer();
      const blob = await putTenantBlob(
        input.tenant.id,
        `logo/${batchId}/${variant}.png`,
        png,
        { access: 'public', addRandomSuffix: false, contentType: 'image/png' },
      );

      const row = await insertImage({
        tenantId: input.tenant.id,
        batchId,
        requestText,
        targetBlock: 'logo',
        ratio: '1:1',
        model: LOGO_MODEL,
        promptFinal: text,
        url: blob.url,
        blobPath: blob.pathname,
        kind: 'logo',
        referenceUrls: input.referenceUrl ? [input.referenceUrl] : [],
      });
      images.push({ ...row, bytes: new Uint8Array(png), variant });
    } catch (error) {
      failures.push(
        `${variant}: ${error instanceof Error ? error.message.slice(0, 140) : 'falha ao salvar'}`,
      );
    }
  }

  return { batchId, images, failures };
}
