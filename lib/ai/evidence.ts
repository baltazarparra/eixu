/** Normaliza grafia, preservando a ordem das palavras, números e negações. */
export function evidenceKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.;!]+$/, '')
    .trim();
}

/** A ferramenta copia uma frase inteira do operador. Uma seleção de palavras
 * soltas não comprova a relação entre um número e o atributo que ele descreve.
 * Anexos, respostas do modelo e perguntas não são confirmações de fatos. */
export function factWritten(fact: string, operatorText: string): boolean {
  const key = evidenceKey(fact);
  if (!key || key.includes('?')) return false;
  return operatorText
    .split(/\n+|(?<=[.!?;])\s+/u)
    .map((sentence) => evidenceKey(sentence.replace(/^\s*[-*]\s+/, '')))
    .some((sentence) => sentence === key);
}

export const MAX_EVIDENCE = 12;

/** Um lote não perde fatos silenciosamente, nem duplica os itens do próprio lote. */
export function evidenceAdditions(
  current: string[],
  intake: string[],
  facts: string[],
) {
  const known = new Set([...current, ...intake].map(evidenceKey));
  const added: string[] = [];
  for (const fact of facts) {
    const key = evidenceKey(fact);
    if (known.has(key)) continue;
    known.add(key);
    added.push(fact);
  }
  return added;
}
