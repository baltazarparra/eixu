import { tool } from 'ai';
import { z } from 'zod';
import {
  GENERATOR_MANUAL_PATH,
  GENERATOR_MANUAL_SECTION_IDS,
  readGeneratorManual,
} from '@/lib/ai/generator-manual';

export function generatorManualTool() {
  return tool({
    description:
      'Consulta o manual versionado do gerador EIXU. Use para responder sobre funcionalidades, fluxos, blocos, capacidades, limites e operação reais. Leia somente as seções necessárias; o manual descreve o produto atual e não autoriza nenhuma alteração.',
    inputSchema: z.object({
      sections: z
        .array(z.enum(GENERATOR_MANUAL_SECTION_IDS))
        .min(1)
        .max(6)
        .describe('Uma a seis seções do índice informado no prompt.'),
    }),
    execute: async ({ sections }) => ({
      source: GENERATOR_MANUAL_PATH,
      sections,
      content: readGeneratorManual(sections),
    }),
  });
}
