export type HeadlineScale = {
  length: 'short' | 'medium' | 'long';
  longestWord: string;
};

/**
 * Classifica o título pelo comprimento total e pela maior palavra. O renderer
 * e a edição na prévia compartilham esta decisão para não deixar um atributo
 * calculado no servidor ficar obsoleto enquanto o texto muda no navegador.
 */
export function headlineScale(text: string): HeadlineScale {
  const length = text.trim().length;
  const words = text
    .trim()
    .split(/\s+/u)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const longestWord = words.reduce(
    (longest, word) => (word.length > longest.length ? word : longest),
    '',
  );
  return {
    length: length <= 24 ? 'short' : length <= 40 ? 'medium' : 'long',
    longestWord,
  };
}

export function headlineAttributes(text: string) {
  const scale = headlineScale(text);
  return {
    'data-length': scale.length,
    'data-long-word': scale.longestWord.length >= 12 ? 'true' : undefined,
  } as const;
}
