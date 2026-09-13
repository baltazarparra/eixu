const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Atalho apenas para ordens completas de publicação do site. Perguntas,
 * negações, citações e pedidos mistos continuam no agente. */
export function isDirectPublicationRequest(text: string): boolean {
  const request = normalized(text);
  if (/[?"“”\n]/.test(request)) return false;
  return /^(?:(?:por favor|eu autorizo|autorizo)[,\s]+)?(?:publique|publica|publicar|pode publicar|quero publicar)(?:\s+(?:(?:o|este|esse|meu)\s+)?(?:site|projeto)|\s+todas as paginas)?(?:\s+agora)?(?:[,\s]+(?:eu autorizo|autorizo|por favor))?[.!\s]*$/.test(
    request,
  );
}

/** A autorização de reparo vem do pedido atual, nunca da lista colada ou de
 * instruções contidas nos blocos. Não concede remoção livre ao edit_page. */
export function isPublicationRepairRequest(text: string): boolean {
  const full = normalized(text);
  const request = full.split('\n')[0];
  if (
    /[?"“”]/.test(request) ||
    /\b(?:nao|nunca|sem|evite)(?:\s+\w+){0,3}\s+(?:remov\w*|apag\w*|retir\w*|exclu\w*|cort\w*)\b/.test(
      full,
    ) ||
    /\b(?:preserv\w*|mantenh\w*)\s+(?:(?:todo|toda|todos|todas)\s+)?(?:o|a|os|as)\s+(?:conteudo|textos?|fotos?|imagens|secoes)\b/.test(
      full,
    )
  )
    return false;
  // Só um pedido geral abre o reparo da home. "Corrija a pendência da imagem
  // #8" ou "apenas /contato" precisam continuar nas ferramentas de edição.
  if (
    /\b(?:apenas|somente|so)\s+(?:a|o|as|os|esta|essa|este|esse|um|uma)\b/.test(
      full,
    )
  )
    return false;
  const command = request.replace(/^(?:por favor|quero que voce)\s+/, '');
  return (
    /^(?:resolva|resolver|corrija|corrigir|ajuste)\s+(?:(?:as|os|todas as|todos os|essas|esses)\s+)?(?:pendencias|bloqueios)(?:\s+(?:de publicacao|da publicacao|para publicar|do site|do projeto))?[.!]*$/.test(
      command,
    ) ||
    /^(?:resolva|resolver|corrija|corrigir|ajuste)\s*:\s*\d+\s+pendencias?\s+para publicar\b/.test(
      command,
    )
  );
}
