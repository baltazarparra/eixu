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
 * andamento, orienta a acompanhar o painel sem prometer um despacho que
 * ainda pode falhar nem pedir que o operador interrompa a execução.
 */
export function savedProgressMessage(
  state: SiteState,
  running = false,
): string {
  const progress = state.generation;
  // A cobertura do plano de cenas só governa até a composição. Depois dela,
  // "3 de 6 cenas" num site montado e revisado soava como trabalho pela metade.
  const composing =
    progress.next === 'briefing' ||
    progress.next === 'cenas' ||
    progress.next === 'composicao';
  const saved = composing
    ? `Progresso salvo: ${progress.coveredScenes} de ${progress.targetScenes} cenas e ${state.pages.length} páginas.`
    : `Progresso salvo: ${state.pages.length} páginas e ${progress.photos} fotos na biblioteca.`;
  const next = {
    briefing: 'A direção visual ainda precisa ser concluída.',
    cenas: 'Ainda há cenas do plano para gerar.',
    composicao: 'A composição das páginas ainda está pendente.',
    revisao:
      'Site gerado. Confira a prévia e peça ajustes pelo chat antes de publicar.',
    pronto:
      'Site gerado. Confira a prévia e peça ajustes pelo chat antes de publicar.',
  }[progress.next];
  if (progress.next === 'pronto' || progress.next === 'revisao')
    return `${saved} ${next}`;
  return `${saved} ${next}${
    running
      ? ' Acompanhe pelo painel a continuação da geração.'
      : ' Use Continuar para retomar pelo progresso salvo.'
  }`;
}
