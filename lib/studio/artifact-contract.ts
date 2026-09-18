import { z } from 'zod';

const conciseText = (maximum: number) => z.string().trim().min(1).max(maximum);

// `z.url()` emits JSON Schema's `format: uri`, but Workflow's bundled Ajv
// does not install that optional format. Keep the schema portable across the
// workflow boundary and parse it again with this source schema before writes.
const httpUrl = z
  .string()
  .trim()
  .min(1, 'URL inválida.')
  .max(2_048)
  .regex(/^https?:\/\/[^\s]+$/i, 'URL inválida.');

const operatorSourceSchema = z
  .object({
    kind: z.literal('operator'),
    location: z.literal('/dados'),
  })
  .strict();

const officialSourceSchema = z
  .object({
    kind: z.literal('official'),
    url: httpUrl,
  })
  .strict();

const contextFactSchema = z
  .object({
    statement: conciseText(1_200).describe(
      'Um fato atômico, sem misturar interpretação ou recomendação.',
    ),
    source: z
      .discriminatedUnion('kind', [operatorSourceSchema, officialSourceSchema])
      .describe('A procedência exata do fato.'),
    status: z
      .enum(['confirmed', 'observed'])
      .describe(
        'confirmed para /dados; observed para conteúdo visto no site oficial.',
      ),
  })
  .strict()
  .superRefine((fact, context) => {
    const expected = fact.source.kind === 'operator' ? 'confirmed' : 'observed';
    if (fact.status !== expected)
      context.addIssue({
        code: 'custom',
        path: ['status'],
        message: `A fonte ${fact.source.kind} exige status ${expected}.`,
      });
  });

const contextInferenceSchema = z
  .object({
    statement: conciseText(1_200),
    basis: conciseText(1_200).describe(
      'Fatos ou sinais observados que sustentam a inferência.',
    ),
  })
  .strict();

const contextGapSchema = z
  .object({
    topic: conciseText(240),
    impact: conciseText(800),
  })
  .strict();

const pagePlanSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^\/$|^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/)
      .max(160),
    purpose: conciseText(500),
    content: z.array(conciseText(300)).min(1).max(12),
  })
  .strict();

export const studioContextArtifactSchema = z
  .object({
    summary: conciseText(4_000).describe(
      'Síntese factual do cliente, da oferta e do objetivo do projeto.',
    ),
    tone: z
      .object({
        voice: conciseText(800),
        traits: z.array(conciseText(120)).min(1).max(8),
        avoid: z.array(conciseText(240)).max(12),
      })
      .strict(),
    facts: z.array(contextFactSchema).min(1).max(80),
    inferences: z.array(contextInferenceSchema).max(30),
    gaps: z.array(contextGapSchema).max(30),
    sitePlan: z.array(pagePlanSchema).min(1).max(20),
    constraints: z.array(conciseText(500)).max(30),
  })
  .strict();

const artPaletteSchema = z
  .object({
    role: conciseText(120),
    value: conciseText(120).describe(
      'Cor em uma notação CSS concreta, como #112233, oklch(...) ou rgb(...).',
    ),
    use: conciseText(400),
  })
  .strict();

export const studioArtDirectionArtifactSchema = z
  .object({
    concept: conciseText(2_000).describe(
      'Ideia visual própria do cliente, sem copiar conteúdo da referência.',
    ),
    reference: z
      .object({
        url: httpUrl,
        source: z.enum(['operator', 'direction']),
        observations: z.array(conciseText(600)).min(2).max(16),
      })
      .strict(),
    logo: z
      .object({
        observations: z.array(conciseText(500)).min(1).max(12),
        handling: conciseText(1_000),
      })
      .strict(),
    layout: conciseText(2_000),
    typography: conciseText(1_200),
    palette: z.array(artPaletteSchema).min(2).max(12),
    imagery: conciseText(1_200),
    rhythm: conciseText(1_200),
    motion: z
      .object({
        principles: z.array(conciseText(400)).min(1).max(12),
        reducedMotion: conciseText(600),
      })
      .strict(),
    mobile: conciseText(1_200),
    avoid: z.array(conciseText(400)).min(1).max(20),
  })
  .strict();

const validationCommandSchema = z.enum([
  'install',
  'typecheck',
  'lint',
  'test',
  'build',
]);

const validationCommandCheckSchema = z
  .object({
    kind: z.literal('command'),
    command: validationCommandSchema,
    status: z.enum(['passed', 'failed']),
    evidence: conciseText(1_000),
  })
  .strict();

const validationManualCheckSchema = z
  .object({
    kind: z.literal('manual'),
    name: conciseText(160),
    status: z.enum(['passed', 'failed', 'not_run']),
    evidence: conciseText(1_000),
  })
  .strict();

export const studioValidationArtifactSchema = z
  .object({
    summary: conciseText(2_000),
    checks: z
      .array(
        z.discriminatedUnion('kind', [
          validationCommandCheckSchema,
          validationManualCheckSchema,
        ]),
      )
      .min(2)
      .max(30),
    limitations: z.array(conciseText(600)).max(20),
    ready: z.boolean(),
  })
  .strict()
  .superRefine((artifact, context) => {
    for (const required of ['typecheck', 'build'] as const) {
      if (
        !artifact.checks.some(
          (check) => check.kind === 'command' && check.command === required,
        )
      )
        context.addIssue({
          code: 'custom',
          path: ['checks'],
          message: `A validação precisa incluir o comando ${required}.`,
        });
    }
    const expectedReady = artifact.checks.every(
      (check) => check.status === 'passed',
    );
    if (artifact.ready !== expectedReady)
      context.addIssue({
        code: 'custom',
        path: ['ready'],
        message: `ready deve ser ${expectedReady} para os checks informados.`,
      });
  });

export const studioArtifactInputSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('context'),
      payload: studioContextArtifactSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('art_direction'),
      payload: studioArtDirectionArtifactSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('validation'),
      payload: studioValidationArtifactSchema,
    })
    .strict(),
]);

export type StudioArtifactInput = z.infer<typeof studioArtifactInputSchema>;
export type StudioValidationArtifact = z.infer<
  typeof studioValidationArtifactSchema
>;
