export const STUDIO_MODEL_POLICY_VERSION = 'studio-gemini-3.8-flash-v2';

export const STUDIO_MODELS = {
  gemini: 'google/gemini-3.8-flash',
} as const;

export type StudioModelFamily = keyof typeof STUDIO_MODELS;
export type StudioReasoning = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export type StudioModelRole =
  | 'assistant'
  | 'batch'
  | 'context'
  | 'art_direction'
  | 'build'
  | 'edit'
  | 'refine'
  | 'critic'
  | 'diagnostic';

export type StudioModelPolicy = {
  family: StudioModelFamily;
  model: (typeof STUDIO_MODELS)[StudioModelFamily];
  reasoning: StudioReasoning;
  maxOutputTokens: number;
  maxSteps: number;
};

const POLICY: Record<StudioModelRole, StudioModelPolicy> = {
  assistant: policy('gemini', 'high', 16_384, 12),
  batch: policy('gemini', 'high', 4_096, 4),
  context: policy('gemini', 'high', 16_384, 12),
  art_direction: policy('gemini', 'high', 24_576, 16),
  build: policy('gemini', 'high', 49_152, 32),
  edit: policy('gemini', 'high', 49_152, 48),
  refine: policy('gemini', 'high', 32_768, 24),
  critic: policy('gemini', 'high', 16_384, 12),
  diagnostic: policy('gemini', 'high', 24_576, 20),
};

function policy(
  family: StudioModelFamily,
  reasoning: StudioReasoning,
  maxOutputTokens: number,
  maxSteps: number,
): StudioModelPolicy {
  return {
    family,
    model: STUDIO_MODELS[family],
    reasoning,
    maxOutputTokens,
    maxSteps,
  };
}

/**
 * Roteamento explícito e auditável. O operador nunca escolhe modelo ou effort;
 * o papel do trabalho determina a chamada e fica registrado no run.
 */
export function studioModelPolicy(role: StudioModelRole): StudioModelPolicy {
  return POLICY[role];
}

/** Trabalho puramente determinístico não deve consumir uma inferência. */
export function roleUsesModel(role: StudioModelRole | 'cms' | 'publish') {
  return role !== 'cms' && role !== 'publish';
}
