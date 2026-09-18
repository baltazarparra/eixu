import { jsonSchema } from 'ai';
import { z } from 'zod';
import {
  studioArtifactInputSchema,
  studioArtDirectionArtifactSchema,
  studioContextArtifactSchema,
  studioValidationArtifactSchema,
  type StudioArtifactInput,
} from './artifact-contract';

// Gemini requires object parameters at the root. Keep the existing wire shape;
// the canonical discriminated union still binds each kind to its payload.
const modelInput = z
  .object({
    kind: z.enum(['context', 'art_direction', 'validation']),
    payload: z.union([
      studioContextArtifactSchema,
      studioArtDirectionArtifactSchema,
      studioValidationArtifactSchema,
    ]),
  })
  .strict();

export const studioArtifactToolSchema = jsonSchema<StudioArtifactInput>(
  () =>
    z.toJSONSchema(modelInput, {
      target: 'draft-7',
      io: 'input',
      reused: 'inline',
      override: ({ jsonSchema: schema }) => {
        // Nested bounded arrays make Gemini reject this tool with HTTP 400.
        // Only generation omits these maxima: Zod checks them again in the
        // executor, including after Workflow replaces this validator with Ajv.
        delete schema.maxItems;
        // Gemini's supported enum vocabulary also constrains discriminators;
        // `const` alone can be ignored when it generates nested tool inputs.
        if (schema.const !== undefined) {
          schema.enum = [schema.const];
          delete schema.const;
        }
      },
    }),
  {
    validate: (value) => {
      const result = studioArtifactInputSchema.safeParse(value);
      return result.success
        ? { success: true, value: result.data }
        : { success: false, error: result.error };
    },
  },
);
