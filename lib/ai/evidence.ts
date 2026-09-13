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
/** Mesmo limite do cadastro; não exige que o operador encurte um fato válido. */
export const MAX_EVIDENCE_LENGTH = 160;

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

/** Duas grafias do mesmo fato: acento, caixa e ponto final não separam. */
export function sameEvidence(a: string, b: string): boolean {
  return evidenceKey(a) === evidenceKey(b);
}

/**
 * O texto exibido aparece inteiro dentro da evidência, delimitado por
 * não-letra. É o predicado da regra de prova: um trecho contíguo, não um
 * conjunto de palavras soltas, para "3" não ser sustentado por "13 cocos".
 */
export function phraseSupported(source: string, part: string): boolean {
  const needle = evidenceKey(part);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
    'u',
  ).test(evidenceKey(source));
}

/** Fatos confirmados pelas duas origens: cadastro (intake) e chat. */
export function confirmedEvidence(brief: Record<string, unknown>): string[] {
  const intake = (brief.intake ?? {}) as Record<string, unknown>;
  const all = [
    ...(Array.isArray(brief.evidence) ? brief.evidence : []),
    ...(Array.isArray(intake.evidence) ? intake.evidence : []),
  ].filter((value): value is string => typeof value === 'string');
  const seen = new Set<string>();
  return all.filter((value) => {
    const key = evidenceKey(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
