import {
  LANDING_COMPOSITION,
  LANDING_DESIGN,
} from '@/lib/taste/landing-prompt';
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
    'read_current_site',
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

/** Uma leitura inicial e, quando houve reparo, uma conferência focal. */
export const REVIEW_CALLS_PER_TURN = 2;

/** Lote salvo sem erro encerra a composição; a revisão seguinte é humana. */
export function compositionReadyToFinish(
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

/**
 * Avaliação obrigatória no primeiro passo e conferência reservada no último.
 * Forçar a chamada depois de esgotar
 * as leituras do turno só produziria uma recusa e queimaria o passo reservado.
 */
export function reviewConferenceDue(
  steps: { toolResults: { toolName: string }[] }[],
  stepNumber: number,
): boolean {
  if (stepNumber === 0) return true;
  if (stepNumber !== PHASE_STEPS.revisao - 1) return false;
  const reads = steps
    .flatMap((step) => step.toolResults)
    .filter((result) => result.toolName === 'review_pages').length;
  return reads < REVIEW_CALLS_PER_TURN;
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
  // Sugestão estética permanece no relatório e não abre outro ciclo sozinha.
  // Se houve reparo, o último resultado só será atual quando a página afetada
  // já tiver sido recapturada pelo recibo incremental.
  return true;
}

/** Uma falha visual encerra a tentativa; a segunda leitura encerra o reparo. */
export function reviewTurnFinished(
  steps: { toolResults: { toolName: string; output: unknown }[] }[],
): boolean {
  if (reviewReadyToFinish(steps)) return true;
  const reads = steps
    .flatMap((step) => step.toolResults)
    .filter((result) => result.toolName === 'review_pages');
  const last = reads.at(-1);
  if (!last) return false;
  const output = last.output as {
    error?: string;
    visual?: string;
    preflightOnly?: boolean;
  } | null;
  return (
    reads.length >= REVIEW_CALLS_PER_TURN ||
    Boolean(output?.error) ||
    (output?.preflightOnly !== true &&
      ['unavailable', 'disabled'].includes(output?.visual ?? ''))
  );
}

/** Objetivo e condição de parada. Entra no prompt no lugar do roteiro geral. */
export const PHASE_BRIEF: Record<Phase, string> = {
  briefing: `## Preparar: briefing, plano e direção
Objetivo: transformar o intake do operador em briefing verificado e direção de arte própria.
1. Quando o intake trouxer Site atual, chame read_current_site antes de consolidar o briefing. A ferramenta navega no domínio, sintetiza fatos e importa imagens úteis; falha ou contradição vira lacuna, nunca conteúdo inventado. A história e as confirmações do operador prevalecem sobre conteúdo antigo.
2. Leia cada referência visual informada com read_reference. O perfil de rede social do intake também é lido por ela; fonte inacessível ou perfil bloqueado vira lacuna declarada em brief.gaps, nunca conteúdo inventado. O Site atual não dá autoridade visual e não substitui essa leitura.
3. Chame define_image_guide com estilo, luz, paleta da marca, ambientes, sujeitos e o que nunca pode aparecer. Derive a linguagem da referência visualmente lida, adaptada ao negócio; sem leitura visual, use a vibe e declare a lacuna. Imagens importadas do Site atual podem compor as cenas quando forem factualmente adequadas.
4. Com referência visual verificada, compare as doze estruturas e escolha a mais próxima da fonte; sem referência, compare as três estruturas da vibe. Grave a escolha em structure, justifique em structureRationale e faça heroComposition corresponder à abertura. Com referência, preencha referenceDirection com aplicações concretas em layout, typography, imagery, rhythm, surface e mobile; ela comanda a direção visual e a vibe fica como voz e fallback. Chame set_design com briefing, conceito, elemento-assinatura, paleta e eixos. Inclua brief.pagePlan: slug, etapa de inbound, intenção, conteúdo útil e evidências de cada página. Inclua também brief.imageScenes, preenchendo exatamente as vagas da composição com pedido concreto e página associada. A seção signature.composition será a protagonista autoral da home; as duas cenas dela precisam nascer do assunto deste cliente. Cada página responde a uma pergunta diferente, sem inventar oferta para preencher o mínimo.
Pare depois de set_design validado. Não monte páginas nem gere imagens nesta fase.`,
  cenas: `## Criar: imagens
Objetivo: produzir o repertório visual que falta para o plano deste cliente.
Chame prepare_site_images uma única vez, com todas as vagas listadas em "Cenas que faltam", cada uma no targetBlock e na proporção que ela pede. Escreva cada request como cena concreta do negócio, sem adjetivo publicitário, e diferente das outras: o lote precisa render fotos distintas, não variações do mesmo enquadramento.
Encerre o turno depois da chamada. As imagens ficam disponíveis com número e URL, sem aprovação. Uma cena recusada pode ser corrigida em uma segunda chamada só com as vagas que faltaram. Não monte páginas nesta fase.`,
  composicao: `## Criar: páginas
Objetivo: montar o projeto completo em uma única chamada de build_site, cumprindo o briefing de composição, a voz da vibe em linguagem simples e, quando presente, as aplicações de referenceDirection em toda a jornada.
O catálogo abaixo traz os schemas JSON completos, incluindo campos obrigatórios e limites. Use-os diretamente, sem consultar de novo o mesmo schema. Siga o pagePlan persistido e verifique factualidade, percurso, SEO distinto, ritmo e recortes antes de escrever. Escreva o projeto inteiro com URLs exatas e proporções coerentes com o layout. Use describe_block somente se ainda faltar informação para compor; não adivinhe props.
Uma página com props inválidas recusa o lote inteiro sem gravar: corrija com repair_site apenas os campos apontados. Uma pendência de projeto não impede a gravação; erros em "pendencias" precisam ser corrigidos antes de encerrar.
Pare quando build_site voltar ok=true sem erros. O site está gerado e a revisão é humana pela prévia. Informe os avisos sem criar etapa de conferência, pedir Continuar ou prometer revisão automática. Não reenvie o projeto já gravado só para zerar avisos. Não publique.`,
  revisao: `## Conferir: revisão
Objetivo: olhar o resultado completo e corrigir o que ficou pobre, inclusive desvios materiais das referências registradas em referenceDirection. Avalie unidade entre páginas; não volte à receita da vibe quando a referência dirige o projeto.
Chame review_pages e trate erros estruturais, editoriais e visuais observados: oferta sem evidência, linguagem difícil, inglês desnecessário, ação pouco clara, voz incoerente com a vibe, jornada repetida, seção sem foto, recorte ruim, tom repetido, headline ilegível, overflow, imagem quebrada ou referência visual descaracterizada. A crítica lê as capturas como imagens quando a captura está habilitada.
Corrija com as ferramentas da página apontada, preservando o que está bom. Chame review_pages novamente depois da última correção, informando as páginas afetadas. Há até ${REVIEW_CALLS_PER_TURN} leituras por turno: uma avaliação e uma conferência focal. Uma primeira avaliação já completa e sem erro material encerra; avisos opcionais ficam no relatório. Falha de captura/crítica ou limite esgotado é pendência explícita, nunca aceite.
Agrupe as correções da mesma página no mesmo passo; use set_blocks quando forem muitas. O último dos ${PHASE_STEPS.revisao} passos é reservado à conferência quando ainda houver leitura disponível. Uma conferência completa e sem erros após o refinamento encerra esta fase; sugestões restantes continuam no relatório, sem iniciar outra reconstrução.
Esta análise só ocorre por pedido explícito do operador, fora da geração. Se a captura ou a crítica estiver indisponível, encerre imediatamente, sem repetir a leitura nem editar o conteúdo por esse motivo. Informe que a análise solicitada não completou, sem reabrir a geração nem afirmar aprovação visual. Se o limite de passos ou de leituras chegar antes da conferência limpa, encerre com um resumo curto do que falta; não prometa outra rodada automática.
Avisos são pistas para julgamento: confira o defeito nos pixels e no briefing antes de alterar. Uma diferença nominal de proporção com o assunto íntegro não exige reconstruir a página; texto cortado, ilegível ou conteúdo sem evidência exige correção.
Pare quando a revisão do rascunho atual estiver completa e sem erros materiais, ou encerre com a pendência explícita nos casos acima. Não publique: a publicação depende do pedido do operador.`,
};

/** Mensagem que o painel envia para abrir cada fase. */
export const PHASE_MESSAGE: Record<Phase, string> = {
  briefing:
    'Leia as fontes configuradas no intake e defina o briefing, o guia de imagem e a direção de arte deste cliente.',
  cenas: 'Gere as cenas que faltam no plano.',
  composicao:
    'Monte o projeto completo com as páginas orgânicas, usando as fotos da biblioteca.',
  revisao: 'Revise o resultado renderizado e corrija o que ficou pobre.',
};

export const PHASE_LABEL: Record<Phase, string> = {
  briefing: 'Preparar · plano e direção',
  cenas: 'Criar · imagens',
  composicao: 'Criar · páginas',
  revisao: 'Conferir',
};

export type GenerationState = {
  shape?: 'multi' | 'landing';
  hasDesign: boolean;
  /** Vagas do plano preenchidas por foto disponível, inclusive candidatas legadas. */
  coveredScenes: number;
  targetScenes: number;
  organicPages: number;
  blockingErrors: number;
  reviewRounds: number;
  reviewComplete: boolean;
  /** A composição já foi entregue; edições posteriores não reabrem a geração. */
  delivered?: boolean;
};

/**
 * Próxima fase pelo estado persistido, não pela conversa: recarregar o painel
 * ou retomar depois de uma falha não perde o progresso.
 */
export function nextPhase(state: GenerationState): Phase | 'pronto' {
  // Páginas já montadas encerram a geração, inclusive em clientes legados
  // sem recibo visual. Pre-flight continua decidindo a publicação separadamente.
  if (
    state.delivered ||
    state.organicPages >= (state.shape === 'landing' ? 1 : 3)
  )
    return 'pronto';
  if (!state.hasDesign) return 'briefing';
  return state.coveredScenes < state.targetScenes ? 'cenas' : 'composicao';
}

export function phaseBrief(
  phase: Phase,
  shape: 'multi' | 'landing' = 'multi',
): string {
  if (shape !== 'landing') return PHASE_BRIEF[phase];
  if (phase === 'briefing')
    return `## Preparar: Landing Page
Leia as referências e fontes do intake com read_reference. Fonte inacessível vira lacuna; não invente evidência. Defina o guia de imagens com define_image_guide e conclua com set_design. Não gere fotos nem componha páginas nesta fase.
${LANDING_DESIGN}`;
  if (phase === 'composicao')
    return `${PHASE_BRIEF.composicao}
${LANDING_COMPOSITION}`;
  return PHASE_BRIEF[phase];
}
