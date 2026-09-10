import { del } from '@vercel/blob';
import { tool } from 'ai';
import { z } from 'zod';
import { ToolError, safe } from '@/lib/ai/tools';
import { critique } from '@/lib/images/critic';
import { DEFAULT_MODELS, generateCandidates } from '@/lib/images/generate';
import { fetchReference, generateLogoCandidates } from '@/lib/images/logo';
import { critiqueLogo } from '@/lib/images/logo-critic';
import {
  deleteImage,
  getGuide,
  getImage,
  guideIsEmpty,
  referenceMessage,
  referenceReason,
  listImages,
  setGuide,
  setStatus,
} from '@/lib/images/queries';
import { RATIOS, ratioForBlock, type Ratio } from '@/lib/images/ratios';
import { setBrandLogo } from '@/lib/tenant-queries';
import type { ImageStatus, Tenant } from '@/lib/types';

/** Só modelos verificados no gateway desta conta. Recraft recusa a chamada. */
const IMAGE_MODELS = [
  'openai/gpt-image-2',
  'openai/gpt-image-1-mini',
  'bfl/flux-2-pro',
  'bytedance/seedream-4.5',
] as const;

const targetBlock = z.enum([
  'hero.split',
  'hero.cover',
  'hero.poster',
  'hero.editorial',
  'hero.offset',
  'hero.atelier',
  'narrative.split',
  'feature.bento',
  'feature.explorer',
  'media.image',
  'media.gallery',
  'livre',
]);

/** Resolve "#3", "3" ou o uuid para uma imagem do cliente. */
async function requireImage(tenant: Tenant, ref: string) {
  const clean = ref.trim().replace(/^#/, '');
  const all = await listImages(tenant.id);
  const bySeq = /^\d+$/.test(clean)
    ? all.find((image) => image.seq === Number(clean))
    : undefined;
  const image = bySeq ?? (await getImage(tenant.id, clean));
  if (!image) {
    const inventory = all
      .slice(0, 12)
      .map((item) => `#${item.seq} ${item.status}`)
      .join(', ');
    throw new ToolError(
      `Imagem "${ref}" não existe. Biblioteca: ${inventory || 'vazia'}`,
    );
  }
  return image;
}

/**
 * Aprovar uma imagem e trocar o logo do site são decisões do operador. O
 * prompt já diz isso, e mesmo assim o agente aprovou sozinho e aplicou como
 * logo uma variante que o próprio crítico tinha reprovado. Instrução não é
 * garantia: o código exige que o pedido esteja na última mensagem do operador.
 */
function operatorAsked(lastUserText: string): boolean {
  return /\b(aprov\w*|usa\w*|use\w*|aplic\w*|defin\w*|coloc\w*|escolh\w*|pode\s+ser|essa\s+mesma?)\b/i.test(
    lastUserText,
  );
}

export function buildImageTools(tenant: Tenant, lastUserText = '') {
  const requireOperator = (acao: string) => {
    if (!operatorAsked(lastUserText)) {
      console.warn(
        `[imagens] ${acao} bloqueado: o operador não pediu. Mensagem: ${JSON.stringify(lastUserText.slice(0, 80))}`,
      );
      throw new ToolError(
        `${acao} é decisão do operador. Apresente as opções e pergunte qual ele quer, em vez de decidir sozinho.`,
      );
    }
  };

  return {
    define_guide: tool({
      description:
        'Define ou ajusta o guia de imagem do cliente. Passe só os campos que mudam; o resto é preservado. Toda imagem gerada depois obedece a este guia.',
      inputSchema: z.object({
        estilo: z.enum(['fotografia', 'ilustracao', '3d']).optional(),
        luz: z
          .string()
          .max(200)
          .optional()
          .describe('Ex: luz natural de manhã, sombra suave.'),
        paleta: z.array(z.string().max(40)).max(6).optional(),
        ambientes: z.array(z.string().max(60)).max(8).optional(),
        sujeitos: z
          .array(z.string().max(60))
          .max(8)
          .optional()
          .describe('Quem ou o que costuma aparecer.'),
        nunca: z
          .array(z.string().max(60))
          .max(12)
          .optional()
          .describe('O que nunca pode aparecer.'),
        notas: z.string().max(400).optional(),
      }),
      execute: safe(async (input) => {
        const current = await getGuide(tenant.id);
        const guide = await setGuide(tenant.id, { ...current, ...input });
        return { guia: guide };
      }),
    }),

    generate_candidates: tool({
      description:
        'Gera 3 candidatas para um pedido, sobe todas e roda o crítico em cada uma. Devolve ranqueado por nota. Não aprova nada: quem aprova é o operador.',
      inputSchema: z.object({
        request: z
          .string()
          .min(5)
          .max(500)
          .describe(
            'A cena concreta: quem ou o que aparece, fazendo o quê, onde. Sem adjetivo publicitário.',
          ),
        targetBlock: targetBlock.default('livre'),
        ratio: z
          .enum(RATIOS)
          .optional()
          .describe('Derivada do bloco quando omitida.'),
        models: z
          .array(z.enum(IMAGE_MODELS))
          .min(1)
          .max(3)
          .optional()
          .describe(
            'Deixe vazio na dúvida. O padrão mistura dois motores e dá variedade sem ficar lento.',
          ),
        allowText: z
          .boolean()
          .default(false)
          .describe('Só true se o operador pediu texto na imagem.'),
        extraNegatives: z.array(z.string().max(60)).max(6).optional(),
      }),
      execute: safe(async (input) => {
        const guide = await getGuide(tenant.id);
        if (guideIsEmpty(guide)) {
          throw new ToolError(
            'O guia de imagem ainda não existe. Chame define_guide antes de gerar.',
          );
        }

        const ratio: Ratio = input.ratio ?? ratioForBlock(input.targetBlock);
        const { batchId, images, failures } = await generateCandidates({
          tenant,
          guide,
          request: input.request,
          ratio,
          targetBlock: input.targetBlock,
          models: input.models ?? DEFAULT_MODELS,
          allowText: input.allowText,
          extraNegatives: input.extraNegatives,
        });

        if (!images.length) {
          throw new ToolError(
            `Nenhuma candidata foi gerada. Motivos: ${failures.join(' | ') || 'desconhecido'}`,
          );
        }

        const critiques = await Promise.all(
          images.map((image) =>
            critique({
              id: image.id,
              bytes: image.bytes,
              request: input.request,
              guide,
              ratio,
              targetBlock: input.targetBlock,
              allowText: input.allowText,
            }),
          ),
        );

        const ranked = images
          .map((image, index) => ({
            id: image.id,
            numero: `#${image.seq}`,
            modelo: image.model,
            url: image.url,
            nota: critiques[index].nota ?? null,
            aprovado_pelo_critico: critiques[index].aprovado ?? false,
            pontos_fortes: critiques[index].pontos_fortes ?? [],
            problemas:
              critiques[index].problemas ??
              (critiques[index].erro ? [critiques[index].erro] : []),
          }))
          .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));

        return { batchId, ratio, candidatas: ranked, falhas: failures };
      }),
    }),

    generate_logo: tool({
      description:
        'Cria variantes de logotipo e avalia cada uma. Em "modernizar", precisa da URL do logo antigo que o operador anexou no chat; devolve uma variante fiel e uma ousada. Em "criar", propõe conceitos do zero. Não aprova nada e não troca o logo do site.',
      inputSchema: z.object({
        mode: z.enum(['modernizar', 'criar']),
        referenceUrl: z
          .url()
          .optional()
          .describe('URL do logo anexado. Obrigatória em modernizar.'),
        brief: z
          .string()
          .max(400)
          .optional()
          .describe('Segmento, tom, símbolo desejado, cores.'),
        brandName: z
          .string()
          .max(60)
          .optional()
          .describe('Nome exato a escrever. Padrão: o nome do cliente.'),
        wordmark: z
          .boolean()
          .default(true)
          .describe('false quando o operador pediu só o símbolo, sem texto.'),
        variants: z.number().int().min(2).max(3).default(2),
      }),
      execute: safe(async (input) => {
        if (input.mode === 'modernizar' && !input.referenceUrl) {
          throw new ToolError(
            'Para modernizar eu preciso do logo atual. Peça para o operador anexar a imagem no chat.',
          );
        }

        const brandName = input.brandName?.trim() || tenant.name;
        const reference = input.referenceUrl
          ? await fetchReference(input.referenceUrl)
          : undefined;
        const guide = await getGuide(tenant.id);

        const { batchId, images, failures } = await generateLogoCandidates({
          tenant,
          guide,
          mode: input.mode,
          brandName,
          wordmark: input.wordmark,
          brief: input.brief,
          reference,
          referenceUrl: input.referenceUrl,
          variants: input.variants,
        });

        if (!images.length) {
          throw new ToolError(
            `Nenhuma variante foi gerada. Motivos: ${failures.join(' | ') || 'desconhecido'}`,
          );
        }

        const critiques = await Promise.all(
          images.map((image) =>
            critiqueLogo({
              id: image.id,
              bytes: image.bytes,
              variant: image.variant,
              mode: input.mode,
              brandName,
              wordmark: input.wordmark,
              reference,
            }),
          ),
        );

        const ranked = images
          .map((image, index) => ({
            id: image.id,
            numero: `#${image.seq}`,
            variante: image.variant,
            url: image.url,
            nota: critiques[index].nota ?? null,
            fidelidade_original: critiques[index].fidelidade_original ?? null,
            nome_lido: critiques[index].nome_lido ?? null,
            nome_correto: critiques[index].nome_correto ?? null,
            fundo_transparente: critiques[index].fundo_transparente ?? null,
            aprovado_pelo_critico: critiques[index].aprovado ?? false,
            problemas:
              critiques[index].problemas ??
              (critiques[index].erro ? [critiques[index].erro] : []),
          }))
          .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));

        return { batchId, variantes: ranked, falhas: failures };
      }),
    }),

    set_site_logo: tool({
      description:
        'Define uma imagem da biblioteca como o logo do site, na navegação e no rodapé. Use só quando o operador pedir.',
      inputSchema: z.object({
        image: z.string().describe('O número ("#3") ou o id da imagem.'),
      }),
      execute: safe(async ({ image: ref }) => {
        requireOperator('Trocar o logo do site');
        const image = await requireImage(tenant, ref);
        if (image.kind !== 'logo') {
          throw new ToolError(
            `A imagem #${image.seq} é uma foto, não um logo. Gere um logo com generate_logo.`,
          );
        }
        // Sem aprovar por tabela: aplicar o logo são dois passos deliberados.
        if (image.status !== 'aprovada') {
          throw new ToolError(
            `A imagem #${image.seq} ainda não foi aprovada. Peça a aprovação do operador antes de aplicar como logo.`,
          );
        }
        await setBrandLogo(tenant.id, image.url);
        return { ok: true, numero: `#${image.seq}`, logoUrl: image.url };
      }),
    }),

    approve_image: tool({
      description:
        'Aprova uma candidata. Só a partir daí ela fica disponível para o agente do site usar.',
      inputSchema: z.object({
        image: z.string().describe('O número ("#3" ou "3") ou o id da imagem.'),
        alt: z
          .string()
          .max(140)
          .optional()
          .describe('Texto alternativo em português, descrevendo a cena.'),
        description: z.string().max(200).optional(),
      }),
      execute: safe(async ({ image: ref, alt, description }) => {
        requireOperator('Aprovar uma imagem');
        const image = await requireImage(tenant, ref);
        const updated = await setStatus(tenant.id, image.id, 'aprovada', {
          alt,
          description,
        });
        return {
          ok: true,
          numero: `#${updated?.seq}`,
          url: updated?.url,
          alt: updated?.alt,
        };
      }),
    }),

    reject_image: tool({
      description:
        'Marca uma candidata como rejeitada. Ela some das opções do site, mas continua visível na biblioteca.',
      inputSchema: z.object({
        image: z.string(),
        reason: z.string().max(200).optional(),
      }),
      execute: safe(async ({ image: ref, reason }) => {
        const image = await requireImage(tenant, ref);
        await setStatus(tenant.id, image.id, 'rejeitada', { reason });
        return { ok: true, numero: `#${image.seq}` };
      }),
    }),

    list_images: tool({
      description: 'Lista a biblioteca de imagens do cliente.',
      inputSchema: z.object({
        status: z
          .enum(['todas', 'aprovada', 'candidata', 'rejeitada'])
          .default('todas'),
      }),
      execute: safe(async ({ status }) => {
        const images = await listImages(
          tenant.id,
          status === 'todas' ? undefined : (status as ImageStatus),
        );
        return {
          imagens: images.map((image) => ({
            numero: `#${image.seq}`,
            id: image.id,
            url: image.url,
            status: image.status,
            ratio: image.ratio,
            bloco: image.targetBlock,
            nota: image.score,
            alt: image.alt,
            descricao: image.description ?? image.requestText,
          })),
        };
      }),
    }),

    delete_image: tool({
      description:
        'Apaga uma imagem de vez, do banco e do armazenamento. Recusa se ela estiver em uso em alguma página.',
      inputSchema: z.object({ image: z.string() }),
      execute: safe(async ({ image: ref }) => {
        const image = await requireImage(tenant, ref);
        const reason = await referenceReason(tenant.id, image.url);
        if (reason) throw new ToolError(referenceMessage(image.seq, reason));
        await del(image.url).catch(() => undefined);
        await deleteImage(tenant.id, image.id);
        return { ok: true, apagada: `#${image.seq}` };
      }),
    }),
  };
}
