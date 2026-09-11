import type { SiteState } from '@/lib/admin/state';

/** Consultas curtas e inequívocas de andamento não iniciam um turno de edição. */
export function isProgressQuestion(text: string): boolean {
  const question = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[?!.,…]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return (
    /^(?:(?:o site|a geracao|o agente|voce) )?(?:travou|parou|terminou|acabou|ainda esta trabalhando|ainda esta gerando|esta funcionando)$/.test(
      question,
    ) ||
    /^(?:qual (?:e )?o (?:status|andamento)|como esta (?:o site|a geracao|o andamento)|e o andamento|alguma novidade|status)$/.test(
      question,
    )
  );
}

/** Relata somente o estado persistido; não infere execução ativa nem aprovação. */
export function savedProgressMessage(state: SiteState): string {
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
  return `${saved} ${next}${progress.next === 'pronto' ? '' : ' Use Continuar para retomar pelo progresso salvo.'}`;
}
