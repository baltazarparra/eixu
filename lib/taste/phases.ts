/**
 * Geração em etapas. Um turno só fazia direção, imagens e quatro páginas em
 * 300 segundos, sem nunca olhar o resultado. Cada fase agora é uma requisição
 * própria, com as ferramentas e o contexto que ela precisa.
 */
export const PHASES = ['briefing', 'cenas', 'composicao', 'revisao'] as const;
export type Phase = (typeof PHASES)[number];

export function isPhase(value: unknown): value is Phase {
  return (
    typeof value === 'string' && (PHASES as readonly string[]).includes(value)
  );
}

/** Ferramentas liberadas por fase. Fora da geração, o chat mantém todas. */
export const PHASE_TOOLS: Record<Phase, string[]> = {
  briefing: [
    'read_reference',
    'list_state',
    'define_image_guide',
    'set_design',
  ],
  cenas: ['list_images', 'define_image_guide', 'prepare_site_images'],
  composicao: [
    'list_images',
    'list_state',
    'describe_block',
    'build_site',
    'repair_site',
  ],
  revisao: [
    'review_pages',
    'get_page',
    'update_block',
    'insert_block',
    'move_block',
    'remove_block',
    'set_blocks',
    'set_seo',
    'lint_page',
    'lint_site',
  ],
};

export const PHASE_STEPS: Record<Phase, number> = {
  briefing: 6,
  cenas: 4,
  composicao: 12,
  revisao: 10,
};

/** Objetivo e condição de parada. Entra no prompt no lugar do roteiro geral. */
export const PHASE_BRIEF: Record<Phase, string> = {
  briefing: `## Fase 1 de 4: briefing e direção
Objetivo: transformar o intake do operador em briefing verificado e direção de arte própria.
1. Leia cada referência informada com read_reference. Fonte inacessível vira lacuna declarada em brief.gaps, nunca conteúdo inventado.
2. Chame define_image_guide com estilo, luz, paleta da marca, ambientes, sujeitos e o que nunca pode aparecer, tudo derivado do negócio.
3. Chame set_design com o briefing, o conceito, o elemento-assinatura, a paleta com papéis e os oito eixos.
Pare depois de set_design aprovado. Não monte páginas nem gere imagens nesta fase.`,
  cenas: `## Fase 2 de 4: cenas
Objetivo: produzir o repertório visual que a composição vai usar.
Chame prepare_site_images uma vez com o plano de cenas completo: a abertura na composição escolhida, o detalhe que dá materialidade, as aplicações da seção protagonista e uma cena para cada página orgânica.
As candidatas entram no rascunho; a aprovação é do operador, no estúdio. Pare depois do lote.`,
  composicao: `## Fase 3 de 4: composição
Objetivo: montar o projeto completo com build_site, cumprindo o briefing de composição.
Use as fotos da biblioteca pelas URLs exatas, com a proporção que o layout exibe. Se build_site recusar, corrija com repair_site apenas os campos apontados.
Pare quando build_site voltar ok=true. Não publique.`,
  revisao: `## Fase 4 de 4: revisão
Objetivo: olhar o resultado e corrigir o que ficou pobre.
Chame review_pages uma vez. Trate cada ERRO e os avisos que empobrecem a página: seção sem foto, tom repetido, proporção incoerente, silhueta repetida, headline em três linhas.
Corrija com update_block ou set_blocks na página apontada, sem refazer o que está bom. Chame review_pages de novo no máximo uma vez para conferir.
Pare quando não restar erro. Não publique: aprovação de fotos e publicação são do operador.`,
};

/** Mensagem que o painel envia para abrir cada fase. */
export const PHASE_MESSAGE: Record<Phase, string> = {
  briefing:
    'Leia as referências do intake e defina o briefing, o guia de imagem e a direção de arte deste cliente.',
  cenas:
    'Gere as cenas que a composição vai usar, seguindo o plano de cenas da direção.',
  composicao:
    'Monte o projeto completo com as páginas orgânicas, usando as fotos da biblioteca.',
  revisao: 'Revise o resultado renderizado e corrija o que ficou pobre.',
};

export const PHASE_LABEL: Record<Phase, string> = {
  briefing: 'Briefing e direção',
  cenas: 'Cenas',
  composicao: 'Composição',
  revisao: 'Revisão',
};

export type GenerationState = {
  hasDesign: boolean;
  generatedPhotos: number;
  targetScenes: number;
  organicPages: number;
  blockingErrors: number;
  reviewRounds: number;
};

/**
 * Próxima fase pelo estado persistido, não pela conversa: recarregar o painel
 * ou retomar depois de uma falha não perde o progresso.
 */
export function nextPhase(state: GenerationState): Phase | 'pronto' {
  if (!state.hasDesign) return 'briefing';
  if (state.generatedPhotos < Math.min(3, state.targetScenes)) return 'cenas';
  if (state.organicPages < 3) return 'composicao';
  if (state.blockingErrors > 0 || state.reviewRounds < 1) return 'revisao';
  return 'pronto';
}
