import { Output, generateText, type FilePart, type TextPart } from 'ai';
import sharp from 'sharp';
import { z } from 'zod';
import { saveCritique } from '@/lib/images/queries';
import type { Critique } from '@/lib/types';

const score = z.number().min(0).max(10);

export const logoCritiqueSchema = z.object({
  legibilidade_48px: score.describe('Continua legível na miniatura de 48 pixels?'),
  vetor_flat: score.describe('Parece vetor chapado, e não render ou foto?'),
  monocromia_viavel: score.describe('Funcionaria em uma cor só?'),
  fundo_transparente: z.boolean(),
  sem_textura_fotografica: score.describe('10 quando não há textura, sombra ou mockup.'),
  sem_texto_extra: z.boolean().describe('false se aparece slogan, sigla ou palavra além do nome.'),
  nome_lido: z.string().max(80).describe('Exatamente o texto que você lê na imagem. Vazio se não há texto.'),
  nome_correto: z.boolean(),
  fidelidade_original: score.nullable().describe('0 a 10 quando existe logo original. Nulo quando não existe.'),
  nota: score,
  aprovado: z.boolean(),
  pontos_fortes: z.array(z.string().max(120)).max(4),
  problemas: z.array(z.string().max(140)).max(6),
  alt_sugerido: z.string().max(140),
  descricao: z.string().max(200),
});

const MODEL = () => process.env.EIXU_CRITIC_MODEL || process.env.EIXU_MODEL || 'anthropic/claude-opus-4.5';

export type Precheck = {
  hasAlpha: boolean;
  transparentFraction: number;
  width: number;
  height: number;
};

/**
 * Medições que não dependem do modelo. Transparência é fato, não opinião: se
 * o PNG vem sem alfa, o logo não serve, e o modelo às vezes não percebe porque
 * o visualizador dele compõe sobre branco.
 */
export async function logoPrecheck(bytes: Uint8Array): Promise<Precheck> {
  const buffer = Buffer.from(bytes);
  const meta = await sharp(buffer).metadata();
  if (!meta.hasAlpha) {
    return { hasAlpha: false, transparentFraction: 0, width: meta.width ?? 0, height: meta.height ?? 0 };
  }
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] < 16) transparent += 1;
  }
  const total = info.width * info.height;
  return {
    hasAlpha: true,
    transparentFraction: total ? transparent / total : 0,
    width: info.width,
    height: info.height,
  };
}

/** Prévia do logo no tamanho real de uso, reampliada para o modelo enxergar. */
async function thumbnail(bytes: Uint8Array): Promise<Uint8Array> {
  const png = await sharp(Buffer.from(bytes))
    .resize(48, 48, { fit: 'inside' })
    .resize(192, 192, { kernel: 'nearest' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
  return new Uint8Array(png);
}

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();

export async function critiqueLogo(input: {
  id: string;
  bytes: Uint8Array;
  variant: string;
  mode: 'modernizar' | 'criar';
  brandName: string;
  wordmark: boolean;
  reference?: Buffer;
}): Promise<Critique> {
  const precheck = await logoPrecheck(input.bytes);

  try {
    const preview = await thumbnail(input.bytes);
    const content: (FilePart | TextPart)[] = [
      { type: 'file', data: input.bytes, mediaType: 'image/png' },
      { type: 'file', data: preview, mediaType: 'image/png' },
      ...(input.reference
        ? [{ type: 'file' as const, data: new Uint8Array(input.reference), mediaType: 'image/png' }]
        : []),
      {
        type: 'text',
        text: [
          `Modo: ${input.mode}. Variante: ${input.variant}.`,
          input.wordmark ? `Nome que deve aparecer escrito, exatamente: "${input.brandName}".` : 'Este logo não deve ter texto nenhum.',
          'A primeira imagem é o logo. A segunda é o mesmo logo reduzido a 48 pixels e reampliado, para você julgar a legibilidade no tamanho real de uso.',
          input.reference ? 'A terceira imagem é o logo original, para comparar.' : 'Não existe logo original.',
          `Medição automática: ${JSON.stringify(precheck)}`,
        ].join('\n'),
      },
    ];

    const { output } = await generateText({
      model: MODEL(),
      output: Output.object({ schema: logoCritiqueSchema }),
      maxRetries: 1,
      instructions: `Você é um diretor de identidade visual revisando um logotipo que vai virar a marca de um cliente real. Seja específico e duro.

Reprove, ou seja aprovado = false, quando:
- o nome aparece com grafia errada, letra trocada, letra a mais ou faltando;
- há palavra, slogan ou sigla além do nome pedido;
- o fundo não é transparente, ou há retângulo de fundo desenhado;
- parece render 3D, foto, adesivo ou mockup em vez de vetor chapado;
- some ou vira borrão na miniatura de 48 pixels;
- na variante fiel, a fidelidade ao original fica abaixo de 5, porque descaracterizou a marca;
- na variante ousada, a fidelidade fica acima de 9, porque não mudou nada.

Em nome_lido escreva exatamente o que você lê na imagem, caractere por caractere, mesmo que esteja errado. É assim que a grafia é conferida.
Escreva em português do Brasil. Problemas em frases curtas e concretas.`,
      messages: [{ role: 'user', content }],
    });

    // O modelo às vezes não percebe o fundo, porque o visualizador dele compõe
    // sobre branco. A medição decide.
    const problems = [...output.problemas];
    let approved = output.aprovado;
    if (!precheck.hasAlpha || precheck.transparentFraction < 0.05) {
      approved = false;
      problems.unshift('O arquivo não tem fundo transparente de verdade.');
    }
    if (input.wordmark && normalize(output.nome_lido) !== normalize(input.brandName)) {
      approved = false;
      problems.unshift(`O nome saiu como "${output.nome_lido}" em vez de "${input.brandName}".`);
    }

    const critique: Critique = {
      ...output,
      aprovado: approved,
      problemas: problems.slice(0, 6),
      fundo_transparente: precheck.hasAlpha && precheck.transparentFraction >= 0.05,
      variante: input.variant,
      precheck: { ...precheck, transparentFraction: Number(precheck.transparentFraction.toFixed(3)) },
    };
    await saveCritique(input.id, critique);
    return critique;
  } catch (error) {
    const failed: Critique = {
      erro: error instanceof Error ? error.message.slice(0, 160) : 'falha na crítica do logo',
      variante: input.variant,
      precheck: { ...precheck, transparentFraction: Number(precheck.transparentFraction.toFixed(3)) },
    };
    await saveCritique(input.id, failed);
    return failed;
  }
}
