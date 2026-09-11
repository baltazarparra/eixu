import type { SiteState } from '@/lib/admin/state';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[?!.,…]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Consultas curtas e inequívocas de andamento não iniciam um turno de edição. */
export function isProgressQuestion(text: string): boolean {
  const question = normalize(text);
  return (
    /^(?:(?:o site|a geracao|o agente|voce) )?(?:travou|parou|terminou|acabou|ainda esta trabalhando|ainda esta gerando|esta funcionando)$/.test(
      question,
    ) ||
    /^(?:qual (?:e )?o (?:status|andamento)|como esta (?:o site|a geracao|o andamento)|e o andamento|alguma novidade|status)$/.test(
      question,
    )
  );
}

/**
 * Retomar digitado. O operador leu "use Continuar", não achou o botão e
 * escreveu a palavra: o chat abria um turno livre de edição em vez de seguir
 * a geração em etapas, gastando passos e minutos no caminho errado.
 */
export function isResumeRequest(text: string): boolean {
  return /^(?:(?:pode|vamos|voce pode|por favor) )?(?:continuar|continua|continue|retomar|retome|retomar a geracao|prosseguir|prossiga|segue|seguir|segue o fluxo|continuar a geracao|continua a geracao|continuar geracao|terminar o site|termina o site)$/.test(
    normalize(text),
  );
}

/**
 * Relata somente o estado persistido; não infere aprovação. Com a execução em
 * andamento, não manda clicar em Continuar: a próxima etapa já vai começar, e
 * o convite fazia o operador interromper o que estava funcionando.
 */
export function savedProgressMessage(
  state: SiteState,
  running = false,
): string {
  const progress = state.generation;
  const saved = `Progresso salvo: ${progress.coveredScenes} de ${progress.targetScenes} cenas e ${state.pages.length} páginas.`;
  const next = {
    briefing: 'A direção visual ainda precisa ser concluída.',
    cenas: 'Ainda há cenas do plano para gerar.',
    composicao: 'A composição das páginas ainda está pendente.',
    revisao: 'A revisão visual do rascunho atual ainda está pendente.',
    pronto:
      'A revisão visual do rascunho atual foi concluída. Confira a prévia no painel.',
  }[progress.next];
  if (progress.next === 'pronto') return `${saved} ${next}`;
  return `${saved} ${next}${
    running
      ? ' A próxima etapa começa em seguida; acompanhe pelo painel.'
      : ' Use Continuar para retomar pelo progresso salvo.'
  }`;
}
