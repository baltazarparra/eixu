/** Política única do produto e das avaliações. IDs confirmados no AI Gateway. */
export const DEFAULT_MODEL = 'google/gemini-3.8-flash';
export const HARNESS_VERSION = 'gemini-3.8-quality-v2-copy';
export const TURN_TIMEOUT_MS = 760_000;
export const CRITIC_TIMEOUT_MS = 150_000;

export function productModel(role: 'agent' | 'critic' = 'agent'): string {
  return (
    (role === 'critic' ? process.env.EIXU_CRITIC_MODEL : undefined)?.trim() ||
    process.env.EIXU_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

/** Inclui espaço para thinking. Limite de saída não é meta de verbosidade. */
export const OUTPUT_TOKENS = {
  briefing: 16_384,
  cenas: 8_192,
  composicao: 49_152,
  revisao: 24_576,
  livre: 24_576,
  critic: 16_384,
  avatar: 4_096,
} as const;

export function modelSettings(task: keyof typeof OUTPUT_TOKENS = 'livre') {
  return {
    reasoning: 'high' as const,
    maxOutputTokens: OUTPUT_TOKENS[task],
    // Gemini 3 é calibrado para a temperatura padrão do provedor.
  };
}
