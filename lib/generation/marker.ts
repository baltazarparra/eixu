import type { Phase } from '@/lib/taste/phases';

/**
 * Marcador de avanço gravado em `generation_runs.progress`. Ele responde a uma
 * pergunta só: o salto anterior produziu alguma coisa? Cenas comparam a
 * cobertura; a revisão compara leitura registrada e conteúdo do rascunho,
 * porque ela repete a mesma fase por desenho, observando, corrigindo e
 * conferindo. Sem esse detalhe, o segundo salto de revisão era lido como
 * etapa parada e encerrava a geração com progresso salvo.
 */

/** Rodadas de revisão por execução. Cada uma tem o próprio turno e leituras. */
export const REVIEW_ROUNDS = 3;

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
