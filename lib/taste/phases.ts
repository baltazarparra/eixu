/**
 * Geração em etapas. Um turno só fazia direção, imagens e quatro páginas em
 * um turno curto, sem nunca olhar o resultado. Cada fase agora é uma requisição
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
  composicao: [
    'list_images',
    'describe_block',
    'build_site',
    'repair_site',
    'lint_site',
  ],
  revisao: [
    'review_pages',
    'describe_block',
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
  briefing: 12,
  // O plano inteiro em uma chamada, com espaço para corrigir uma recusa.
  cenas: 4,
  composicao: 24,
  revisao: 32,
};

/** Lote salvo sem erro segue para a etapa que observa pixels e edita páginas. */
export function compositionReadyForReview(
  results: { toolName: string; output: unknown }[],
): boolean {
  const result = results.findLast((item) =>
    ['build_site', 'repair_site'].includes(item.toolName),
  );
  if (!result?.output || typeof result.output !== 'object') return false;
  const output = result.output as Record<string, unknown>;
  if (
    output.ok !== true ||
    !Array.isArray(output.pages) ||
    !output.pages.length
  )
    return false;
  const findings = [output.pendencias, output.publicationPending]
    .filter(Array.isArray)
    .flat() as { level?: string }[];
  return !findings.some((finding) => finding.level === 'error');
}

/** Encerra a conferência bem-sucedida antes de outra rodada de alterações. */
export function reviewReadyToFinish(
  steps: { toolResults: { toolName: string; output: unknown }[] }[],
): boolean {
  const last = steps.at(-1)?.toolResults.at(-1);
  if (last?.toolName !== 'review_pages') return false;
  const output = last.output as
    | {
        complete?: boolean;
        visual?: string;
        review?: { complete?: boolean; errors?: number; findings?: unknown[] };
      }
    | undefined;
  if (
    output?.complete !== true ||
    output.visual !== 'complete' ||
    output.review?.complete !== true ||
    output.review.errors !== 0 ||
    !Array.isArray(output.review.findings)
  )
    return false;
  const reviews = steps
    .flatMap((step) => step.toolResults)
    .filter((result) => result.toolName === 'review_pages').length;
  // A primeira leitura com avisos ainda permite o ciclo de refinamento.
  return reviews > 1 || output.review.findings.length === 0;
}

/** Objetivo e condição de parada. Entra no prompt no lugar do roteiro geral. */
export const PHASE_BRIEF: Record<Phase, string> = {
  briefing: `## Fase 1 de 4: briefing e direção
Objetivo: transformar o intake do operador em briefing verificado e direção de arte própria.
1. Leia cada referência informada com read_reference. O perfil de rede social do intake também é lido por ela; fonte inacessível ou perfil bloqueado vira lacuna declarada em brief.gaps, nunca conteúdo inventado.
2. Chame define_image_guide com estilo, luz, paleta da marca, ambientes, sujeitos e o que nunca pode aparecer, tudo derivado do negócio.
3. Compare alternativas adequadas à vibe e ao negócio. Escolha pela clareza, identidade e viabilidade no catálogo. Chame set_design com o briefing, o conceito, o elemento-assinatura, a paleta com papéis e os oito eixos, respeitando a faixa da vibe. Inclua brief.pagePlan: slug, etapa de inbound, intenção, conteúdo útil e evidências de cada página. Cada página responde a uma pergunta diferente, sem inventar oferta para preencher o mínimo.
Pare depois de set_design validado. Não monte páginas nem gere imagens nesta fase.`,
  cenas: `## Fase 2 de 4: cenas
Objetivo: produzir o repertório visual que falta para o plano deste cliente.
Chame prepare_site_images uma única vez, com todas as vagas listadas em "Cenas que faltam", cada uma no targetBlock e na proporção que ela pede. Escreva cada request como cena concreta do negócio, sem adjetivo publicitário, e diferente das outras: o lote precisa render fotos distintas, não variações do mesmo enquadramento.
Encerre o turno depois da chamada. As imagens ficam disponíveis com número e URL, sem aprovação. Uma cena recusada pode ser corrigida em uma segunda chamada só com as vagas que faltaram. Não monte páginas nesta fase.`,
  composicao: `## Fase 3 de 4: composição
Objetivo: montar o projeto completo em uma única chamada de build_site, cumprindo o briefing de composição.
O catálogo abaixo traz os schemas JSON completos, incluindo campos obrigatórios e limites. Use-os diretamente, sem consultar de novo o mesmo schema. Siga o pagePlan persistido e verifique factualidade, percurso, SEO distinto, ritmo e recortes antes de escrever. Escreva o projeto inteiro com URLs exatas e proporções coerentes com o layout. Use describe_block somente se ainda faltar informação para compor; não adivinhe props.
Uma página com props inválidas recusa o lote inteiro sem gravar: corrija com repair_site apenas os campos apontados. Uma pendência de projeto não impede a gravação; erros em "pendencias" precisam ser corrigidos antes de encerrar.
Pare quando build_site voltar ok=true sem erros. Leve os avisos para a revisão visual da próxima fase: ela tem os pixels e as ferramentas de edição para decidir e corrigir recortes. Não reenvie o projeto já gravado só para zerar avisos. Não publique.`,
  revisao: `## Fase 4 de 4: revisão
Objetivo: olhar o resultado e corrigir o que ficou pobre.
Chame review_pages e trate erros estruturais, editoriais e visuais observados: oferta sem evidência, jornada repetida, seção sem foto, recorte ruim, tom repetido, headline ilegível, overflow ou imagem quebrada. A crítica lê as capturas como imagens quando a captura está habilitada.
Corrija com as ferramentas da página apontada, preservando o que está bom. Chame review_pages novamente depois da última correção. Há até três revisões por turno para observar, corrigir e confirmar. Falha de captura/crítica ou limite esgotado é pendência explícita, nunca aceite.
Agrupe as correções observadas antes de conferir novamente. O último dos 32 passos é reservado à conferência. Uma conferência completa e sem erros após o refinamento encerra esta fase; sugestões restantes continuam no relatório, sem iniciar outra reconstrução.
Avisos são pistas para julgamento: confira o defeito nos pixels e no briefing antes de alterar. Uma diferença nominal de proporção com o assunto íntegro não exige reconstruir a página; texto cortado, ilegível ou conteúdo sem evidência exige correção.
Pare quando a revisão do rascunho atual estiver completa e sem erros materiais. Não publique: a publicação depende do pedido do operador.`,
};

/** Mensagem que o painel envia para abrir cada fase. */
export const PHASE_MESSAGE: Record<Phase, string> = {
  briefing:
    'Leia as referências do intake e defina o briefing, o guia de imagem e a direção de arte deste cliente.',
  cenas: 'Gere as cenas que faltam no plano.',
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
  reviewComplete: boolean;
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
  if (
    state.blockingErrors > 0 ||
    state.reviewRounds < 1 ||
    !state.reviewComplete
  )
    return 'revisao';
  return 'pronto';
}
