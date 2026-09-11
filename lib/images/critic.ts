import { Output, generateText } from 'ai';
import { z } from 'zod';
import { saveCritique } from '@/lib/images/queries';
import type { Critique, ImageGuide } from '@/lib/types';

const score = z.number().min(0).max(10);

export const critiqueSchema = z.object({
  fidelidade: score.describe('A imagem entrega o que foi pedido?'),
  coerencia_guia: score.describe(
    'Obedece estilo, luz, paleta e proibições do guia?',
  ),
  realismo: score.describe(
    'Anatomia, geometria, perspectiva e materiais sem artefato.',
  ),
  sem_alucinacao: score.describe(
    '10 quando não há texto, logo ou marca inventados.',
  ),
  autenticidade: score.describe('0 quando parece banco de imagens genérico.'),
  adequacao_bloco: score.describe('Funciona recortada na proporção do bloco?'),
  nota: score.describe('Nota final, ponderando as anteriores.'),
  aprovado: z.boolean(),
  tem_texto: z
    .boolean()
    .describe('Existe qualquer texto legível ou ilegível na imagem?'),
  pontos_fortes: z.array(z.string().max(120)).max(4),
  problemas: z.array(z.string().max(140)).max(6),
  alt_sugerido: z
    .string()
    .max(140)
    .describe('Texto alternativo em português, descritivo.'),
  descricao: z
    .string()
    .max(200)
    .describe('Uma frase para o operador achar esta imagem depois.'),
});

const MODEL = () =>
  process.env.EIXU_CRITIC_MODEL ||
  process.env.EIXU_MODEL ||
  'google/gemini-3.8-flash';

/**
 * Crítico de imagem. Olha a imagem de verdade, não o prompt, e devolve nota
 * com justificativa. A avaliação orienta o uso e os ajustes, sem criar uma
 * etapa de aprovação nem impedir a disponibilidade da imagem.
 */
export async function critique(input: {
  id: string;
  bytes: Uint8Array;
  request: string;
  guide: ImageGuide;
  ratio: string;
  targetBlock: string;
  allowText?: boolean;
}): Promise<Critique> {
  const guideText = [
    input.guide.estilo ? `estilo ${input.guide.estilo}` : null,
    input.guide.luz ? `luz ${input.guide.luz}` : null,
    input.guide.paleta?.length
      ? `paleta ${input.guide.paleta.join(', ')}`
      : null,
    input.guide.ambientes?.length
      ? `ambientes ${input.guide.ambientes.join(', ')}`
      : null,
    input.guide.nunca?.length ? `nunca ${input.guide.nunca.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');

  try {
    const { output } = await generateText({
      model: MODEL(),
      output: Output.object({ schema: critiqueSchema }),
      maxRetries: 1,
      instructions: `Você é um diretor de arte revisando uma imagem que vai para o site de um cliente real. Seja duro e específico: aponte o defeito onde ele está, não elogie por educação.

Reprove, ou seja aprovado = false, sempre que:
- realismo abaixo de 6, por mão deformada, dedo a mais, objeto derretido, perspectiva impossível, reflexo incoerente;
- sem_alucinacao abaixo de 6, por texto inventado, logo, marca ou selo que não existe;
- tem_texto verdadeiro quando texto não foi pedido;
- a imagem contradiz o guia do cliente;
- nota abaixo de 7.

Autenticidade mede o oposto de banco de imagens: pessoa sorrindo para a câmera sem motivo, aperto de mão corporativo, cenário limpo demais, tudo isso derruba a nota.
Escreva em português do Brasil. Problemas em frases curtas e concretas.`,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file', data: input.bytes, mediaType: 'image/webp' },
            {
              type: 'text',
              text: [
                `Pedido do operador: ${input.request}`,
                `Guia do cliente: ${guideText || 'não definido'}`,
                `Bloco de destino: ${input.targetBlock}, proporção ${input.ratio}`,
                input.allowText
                  ? 'Texto na imagem foi autorizado neste pedido.'
                  : 'Texto na imagem não foi autorizado.',
              ].join('\n'),
            },
          ],
        },
      ],
    });

    await saveCritique(input.id, output);
    return output;
  } catch (error) {
    // Falha do crítico não invalida a imagem: ela continua disponível, sem nota.
    const failed: Critique = {
      erro:
        error instanceof Error
          ? error.message.slice(0, 160)
          : 'falha na crítica',
    };
    await saveCritique(input.id, failed);
    return failed;
  }
}
