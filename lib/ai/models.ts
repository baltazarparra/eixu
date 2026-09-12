/** Política única do produto e das avaliações. IDs confirmados no AI Gateway. */
export const DEFAULT_MODEL = 'google/gemini-3.8-flash';
export const DEFAULT_LOGO_CRITIC_MODEL = 'anthropic/claude-sonnet-5';
export const HARNESS_VERSION = 'gemini-3.8-quality-v5-logo';
export const TURN_TIMEOUT_MS = 760_000;
export const CRITIC_TIMEOUT_MS = 150_000;
export const LOGO_READ_TIMEOUT_MS = 12_000;
export const LOGO_STUDIO_TIMEOUT_MS = 300_000;
export const LOGO_IMAGE_MODEL =
  process.env.EIXU_LOGO_IMAGE_MODEL?.trim() || 'openai/gpt-image-2';

export function productModel(
  role: 'agent' | 'critic' | 'logo-critic' = 'agent',
): string {
  return (
    (role === 'logo-critic'
      ? process.env.EIXU_LOGO_CRITIC_MODEL
      : undefined
    )?.trim() ||
    (role !== 'agent' ? process.env.EIXU_CRITIC_MODEL : undefined)?.trim() ||
    process.env.EIXU_MODEL?.trim() ||
    (role === 'logo-critic' ? DEFAULT_LOGO_CRITIC_MODEL : DEFAULT_MODEL)
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
  'logo-read': 2_048,
} as const;

export function modelSettings(task: keyof typeof OUTPUT_TOKENS = 'livre') {
  return {
    reasoning: 'high' as const,
    maxOutputTokens: OUTPUT_TOKENS[task],
    // Gemini 3 é calibrado para a temperatura padrão do provedor.
  };
}
