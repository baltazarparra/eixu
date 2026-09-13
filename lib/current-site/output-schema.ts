import { jsonSchema, type JSONSchema7 } from 'ai';
import { z } from 'zod';
import { currentSiteAnalysisSchema, type CurrentSiteAnalysis } from './schema';

/**
 * Gemini rejeita a combinação de listas aninhadas e limites do recibo (400).
 * O transporte descreve esses limites; a validação Zod abaixo continua exigindo
 * todos eles antes de qualquer uso do resultado. Sem dois schemas manuais.
 * https://ai.google.dev/gemini-api/docs/structured-output#limitations
 */
function modelShape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(modelShape);
  if (!value || typeof value !== 'object') return value;
  const node = value as Record<string, unknown>;
  const constraints = [
    'minLength',
    'maxLength',
    'minItems',
    'maxItems',
    'format',
  ];
  const hints = constraints
    .filter((key) => node[key] !== undefined)
    .map((key) => `${key}: ${String(node[key])}`);
  return {
    ...Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => !['default', ...constraints].includes(key))
        .map(([key, child]) => [key, modelShape(child)]),
    ),
    ...(hints.length
      ? { description: [node.description, ...hints].filter(Boolean).join('; ') }
      : {}),
  };
}

export const currentSiteOutputSchema = jsonSchema<CurrentSiteAnalysis>(
  modelShape(
    z.toJSONSchema(currentSiteAnalysisSchema, { io: 'output' }),
  ) as JSONSchema7,
  {
    validate(value) {
      const parsed = currentSiteAnalysisSchema.safeParse(value);
      return parsed.success
        ? { success: true, value: parsed.data }
        : { success: false, error: parsed.error };
    },
  },
);
