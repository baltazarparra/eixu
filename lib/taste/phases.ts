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
  // A cobertura do plano já entra no prompt desta fase: list_images só
  // gastaria um passo para repetir o que o contexto traz.
  cenas: ['define_image_guide', 'prepare_site_images'],
  composicao: ['list_images', 'build_site', 'repair_site', 'lint_site'],
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
  // Uma cena por requisição: chamar a ferramenta e encerrar o turno.
  cenas: 2,
  composicao: 12,
  revisao: 10,
};

/** Objetivo e condição de parada. Entra no prompt no lugar do roteiro geral. */
export const PHASE_BRIEF: Record<Phase, string> = {
  briefing: `## Fase 1 de 4: briefing e direção
Objetivo: transformar o intake do operador em briefing verificado e direção de arte própria.
1. Leia cada referência informada com read_reference. O perfil de rede social do intake também é lido por ela; fonte inacessível ou perfil bloqueado vira lacuna declarada em brief.gaps, nunca conteúdo inventado.
2. Chame define_image_guide com estilo, luz, paleta da marca, ambientes, sujeitos e o que nunca pode aparecer, tudo derivado do negócio.
3. Chame set_design com o briefing, o conceito, o elemento-assinatura, a paleta com papéis e os oito eixos, respeitando a faixa da vibe escolhida no cadastro.
Pare depois de set_design aprovado. Não monte páginas nem gere imagens nesta fase.`,
  cenas: `## Fase 2 de 4: cenas
Objetivo: produzir a próxima cena do repertório visual, uma por vez.
Chame prepare_site_images uma única vez, com exatamente uma cena: a indicada em "Próxima cena", no targetBlock e na proporção que ela pede. Escreva o request como cena concreta do negócio, sem adjetivo publicitário.
Encerre o turno depois da chamada. A imagem fica disponível com número e URL; o painel segue automaticamente para a próxima cena, sem aprovação. Não monte páginas nesta fase.`,
  composicao: `## Fase 3 de 4: composição
Objetivo: montar o projeto completo em uma única chamada de build_site, cumprindo o briefing de composição.
O catálogo abaixo já traz as props e os limites de cada bloco. Escreva o projeto inteiro de uma vez, com as fotos da biblioteca pelas URLs exatas e na proporção que o layout exibe.
Uma página com props inválidas recusa o lote inteiro sem gravar: corrija com repair_site apenas os campos apontados. Uma pendência de projeto não impede a gravação; ela aparece em "pendencias" e você a corrige antes de encerrar.
Pare quando build_site voltar ok=true sem pendências. Não publique.`,
  revisao: `## Fase 4 de 4: revisão
Objetivo: olhar o resultado e corrigir o que ficou pobre.
Chame review_pages uma vez. Trate cada ERRO e os avisos que empobrecem a página: seção sem foto, tom repetido, proporção incoerente, silhueta repetida, headline em três linhas.
Corrija com update_block ou set_blocks na página apontada, sem refazer o que está bom. Chame review_pages de novo no máximo uma vez para conferir.
Pare quando não restar erro. Não publique: a publicação depende do pedido do operador.`,
};

/** Mensagem que o painel envia para abrir cada fase. */
export const PHASE_MESSAGE: Record<Phase, string> = {
  briefing:
    'Leia as referências do intake e defina o briefing, o guia de imagem e a direção de arte deste cliente.',
  cenas: 'Gere a próxima cena do plano.',
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
  /** Vagas do plano preenchidas por foto disponível, inclusive candidatas legadas. */
  coveredScenes: number;
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
  // A cobertura do plano governa só antes da composição: o repertório existe
  // para a montagem ter o que usar. Depois que as páginas existem, foto que
  // falte vira erro de pre-flight e quem resolve é a revisão. Sem esse
  // recorte, um cliente já publicado com biblioteca menor que o plano voltaria
  // para a etapa de cenas e gastaria geração que ninguém pediu.
  if (state.organicPages < 3)
    return state.coveredScenes < state.targetScenes ? 'cenas' : 'composicao';
  if (state.blockingErrors > 0 || state.reviewRounds < 1) return 'revisao';
  return 'pronto';
}
