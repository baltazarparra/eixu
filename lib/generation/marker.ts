import type { Phase } from '@/lib/taste/phases';

/**
 * Marcador de avanço gravado em `generation_runs.progress`. Ele responde a uma
 * pergunta só: o salto anterior produziu alguma coisa? Cenas comparam a
 * cobertura. O formato da revisão mantém leitura e conteúdo do rascunho para
 * compatibilidade com execuções legadas; o runner atual não encadeia rodadas.
 */

/** Estado mínimo que o marcador observa. */
export type MarkerState = {
  coveredScenes: number;
  reviewRounds: number;
};

/** Rodada que o marcador representa; 0 quando ele não é de revisão. */
export function reviewRound(marker: string | null): number {
  if (!marker?.startsWith('revisao:')) return 0;
  const round = Number(marker.split(':')[1]);
  return Number.isSafeInteger(round) && round > 0 ? round : 0;
}

/**
 * O marcador da revisão soma rodada, leituras registradas e assinatura do
 * rascunho. A rodada avança sempre; as outras duas partes é que distinguem
 * trabalho real de repetição.
 */
export function progressMarker(
  phase: Phase,
  state: MarkerState,
  fingerprint: string,
  previous: string | null,
): string {
  if (phase === 'cenas') return `cenas:${state.coveredScenes}`;
  if (phase !== 'revisao') return phase;
  return `revisao:${reviewRound(previous) + 1}:${state.reviewRounds}:${fingerprint.slice(0, 16)}`;
}

/** Só a parte que precisa mudar para o salto ter valido a chamada paga. */
function evidence(marker: string): string {
  return marker.startsWith('revisao:')
    ? marker.split(':').slice(2).join(':')
    : marker;
}

/** Verdadeiro quando o salto anterior não deixou nada novo para trabalhar. */
export function stalled(previous: string | null, next: string): boolean {
  return previous !== null && evidence(previous) === evidence(next);
}
