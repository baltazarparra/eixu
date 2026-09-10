import { del } from '@vercel/blob';
import { tool } from 'ai';
import { z } from 'zod';
import { ToolError, safe } from '@/lib/ai/tools';
import { critique } from '@/lib/images/critic';
import { DEFAULT_MODELS, generateCandidates } from '@/lib/images/generate';
import {
  deleteImage,
  getGuide,
  getImage,
  guideIsEmpty,
  isReferenced,
  listImages,
  setGuide,
  setStatus,
} from '@/lib/images/queries';
import { RATIOS, ratioForBlock, type Ratio } from '@/lib/images/ratios';
import type { ImageStatus, Tenant } from '@/lib/types';

/** Só modelos verificados no gateway desta conta. Recraft recusa a chamada. */
const IMAGE_MODELS = [
  'openai/gpt-image-2',
  'openai/gpt-image-1-mini',
  'bfl/flux-2-pro',
  'bytedance/seedream-4.5',
] as const;

const targetBlock = z.enum(['hero.split', 'narrative.split', 'media.image', 'media.gallery', 'livre']);

/** Resolve "#3", "3" ou o uuid para uma imagem do cliente. */
async function requireImage(tenant: Tenant, ref: string) {
  const clean = ref.trim().replace(/^#/, '');
  const all = await listImages(tenant.id);
  const bySeq = /^\d+$/.test(clean) ? all.find((image) => image.seq === Number(clean)) : undefined;
  const image = bySeq ?? (await getImage(tenant.id, clean));
  if (!image) {
    const inventory = all.slice(0, 12).map((item) => `#${item.seq} ${item.status}`).join(', ');
    throw new ToolError(`Imagem "${ref}" não existe. Biblioteca: ${inventory || 'vazia'}`);
  }
  return image;
}

export function buildImageTools(tenant: Tenant) {
  return {
    define_guide: tool({
      description:
        'Define ou ajusta o guia de imagem do cliente. Passe só os campos que mudam; o resto é preservado. Toda imagem gerada depois obedece a este guia.',
      inputSchema: z.object({
        estilo: z.enum(['fotografia', 'ilustracao', '3d']).optional(),
        luz: z.string().max(200).optional().describe('Ex: luz natural de manhã, sombra suave.'),
        paleta: z.array(z.string().max(40)).max(6).optional(),
        ambientes: z.array(z.string().max(60)).max(8).optional(),
        sujeitos: z.array(z.string().max(60)).max(8).optional().describe('Quem ou o que costuma aparecer.'),
        nunca: z.array(z.string().max(60)).max(12).optional().describe('O que nunca pode aparecer.'),
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
          .describe('A cena concreta: quem ou o que aparece, fazendo o quê, onde. Sem adjetivo publicitário.'),
        targetBlock: targetBlock.default('livre'),
        ratio: z.enum(RATIOS).optional().describe('Derivada do bloco quando omitida.'),
        models: z
          .array(z.enum(IMAGE_MODELS))
          .min(1)
          .max(3)
          .optional()
          .describe('Deixe vazio na dúvida. O padrão mistura dois motores e dá variedade sem ficar lento.'),
        allowText: z.boolean().default(false).describe('Só true se o operador pediu texto na imagem.'),
        extraNegatives: z.array(z.string().max(60)).max(6).optional(),
      }),
      execute: safe(async (input) => {
        const guide = await getGuide(tenant.id);
        if (guideIsEmpty(guide)) {
          throw new ToolError('O guia de imagem ainda não existe. Chame define_guide antes de gerar.');
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
          throw new ToolError(`Nenhuma candidata foi gerada. Motivos: ${failures.join(' | ') || 'desconhecido'}`);
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
            problemas: critiques[index].problemas ?? (critiques[index].erro ? [critiques[index].erro] : []),
          }))
          .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));

        return { batchId, ratio, candidatas: ranked, falhas: failures };
      }),
    }),

    approve_image: tool({
      description: 'Aprova uma candidata. Só a partir daí ela fica disponível para o agente do site usar.',
      inputSchema: z.object({
        image: z.string().describe('O número ("#3" ou "3") ou o id da imagem.'),
        alt: z.string().max(140).optional().describe('Texto alternativo em português, descrevendo a cena.'),
        description: z.string().max(200).optional(),
      }),
      execute: safe(async ({ image: ref, alt, description }) => {
        const image = await requireImage(tenant, ref);
        const updated = await setStatus(tenant.id, image.id, 'aprovada', { alt, description });
        return { ok: true, numero: `#${updated?.seq}`, url: updated?.url, alt: updated?.alt };
      }),
    }),

    reject_image: tool({
      description: 'Marca uma candidata como rejeitada. Ela some das opções do site, mas continua visível na biblioteca.',
      inputSchema: z.object({ image: z.string(), reason: z.string().max(200).optional() }),
      execute: safe(async ({ image: ref, reason }) => {
        const image = await requireImage(tenant, ref);
        await setStatus(tenant.id, image.id, 'rejeitada', { reason });
        return { ok: true, numero: `#${image.seq}` };
      }),
    }),

    list_images: tool({
      description: 'Lista a biblioteca de imagens do cliente.',
      inputSchema: z.object({ status: z.enum(['todas', 'aprovada', 'candidata', 'rejeitada']).default('todas') }),
      execute: safe(async ({ status }) => {
        const images = await listImages(tenant.id, status === 'todas' ? undefined : (status as ImageStatus));
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
      description: 'Apaga uma imagem de vez, do banco e do armazenamento. Recusa se ela estiver em uso em alguma página.',
      inputSchema: z.object({ image: z.string() }),
      execute: safe(async ({ image: ref }) => {
        const image = await requireImage(tenant, ref);
        if (await isReferenced(tenant.id, image.url)) {
          throw new ToolError(`A imagem #${image.seq} está em uso numa página. Troque a imagem do bloco antes de apagar.`);
        }
        await del(image.url).catch(() => undefined);
        await deleteImage(tenant.id, image.id);
        return { ok: true, apagada: `#${image.seq}` };
      }),
    }),
  };
}
