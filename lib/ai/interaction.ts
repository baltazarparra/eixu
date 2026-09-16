import type { ToolSet } from 'ai';

export type InteractionMode = 'conversation' | 'action';

function normalized(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const ACTION_VERB = String.raw`(?:adicion\w*|ajust\w*|alinh\w*|alter\w*|ampli\w*|analis\w*|anim\w*|apli\w*|apag\w*|arredond\w*|atualiz\w*|aument\w*|bot[ae]\w*|centraliz\w*|colo\w*|configur\w*|consert\w*|constru\w*|convert\w*|corri\w*|cri\w*|defin\w*|deix\w*|delet\w*|desabilit\w*|desfa\w*|destac\w*|diminu\w*|duplic\w*|edit\w*|encurt\w*|escond\w*|escrev\w*|escurec\w*|exclu\w*|execut\w*|expand\w*|fac\w*|faz\w*|ger\w*|habilit\w*|implement\w*|import\w*|inclu\w*|insir\w*|invert\w*|melhor\w*|moderniz\w*|mont\w*|mov\w*|mud\w*|ocult\w*|otimiz\w*|personaliz\w*|posicion\w*|publi\w*|recort\w*|reconstru\w*|redimension\w*|reduz\w*|reescrev\w*|refa\w*|refin\w*|reformul\w*|remov\w*|renome\w*|reorganiz\w*|repar\w*|resolv\w*|restaur\w*|retir\w*|revis\w*|salv\w*|simplific\w*|substitu\w*|transform\w*|tro\w*|us\w*)`;

const DIRECT_ACTION = new RegExp(
  String.raw`^(?:(?:por favor|eixu|agora|entao|tambem)\s*[,.:;-]?\s*)*(?:${ACTION_VERB}|(?:pode|consegue|da para)\s+(?:voce\s+)?${ACTION_VERB})\b`,
);

const DESIRED_RESULT = new RegExp(
  String.raw`\b(?:eu\s+)?(?:quero|queria|preciso|gostaria)(?:\s+de)?\s+(?!(?:saber|entender|conhecer|uma?\s+(?:ideia|opiniao|explicacao|avaliacao|sugestao)|ideias|opinioes|sugestoes)\b)(?:que\s+(?:voce\s+)?${ACTION_VERB}\b|${ACTION_VERB}\b|(?:um|uma|o|a|meu|minha|esse|essa|este|esta|mais|menos|novo|nova|outr[oa])\b)`,
);

const DESIRED_STATE = new RegExp(
  String.raw`\b(?:eu\s+)?(?:quero|queria|preciso|gostaria)(?:\s+de)?\s+que\s+(?:(?:o|a|os|as|meu|minha|este|esta|esse|essa)\s+)?(?:site|home|pagina|header|cabecalho|menu|hero|abertura|footer|rodape|bloco|secao)(?:\s+[a-z0-9/-]+){0,5}\s+(?:fiqu\w*|ganh\w*|tenh\w*|us\w*|seja|parec\w*)\b`,
);

const COLLABORATIVE_ACTION = new RegExp(
  String.raw`^(?:vamos|bora)\s+(?:${ACTION_VERB})\b`,
);

const SCOPED_ACTION = new RegExp(
  String.raw`^(?:na|no|nas|nos|em|para)\s+(?:home|pagina|site|header|cabecalho|menu|hero|abertura|footer|rodape|bloco|secao)(?:\s+[\w/-]+){0,5}\s*[,.:;-]?\s*(?:${ACTION_VERB}|(?:eu\s+)?quero)\b`,
);

const HYPOTHETICAL = new RegExp(
  String.raw`\b(?:seria|ficaria|faria sentido|valeria|acha que|voce acha)\b`,
);

const TERSE_SITE_EDIT =
  /^(?:(?:o|a|os|as)\s+)?(?:header|cabecalho|menu|hero|abertura|footer|rodape|logo|foto|imagem|card|bloco|secao|pagina|site|texto|titulo|cta|botao|formulario)\b.{0,100}\b(?:#[0-9a-f]{6}|dark\s*mode|escuro|claro|maior|menor|novo|nova|fixo|transparente|sem\s+\w+|com\s+\w+)/;

const CLEAR_DISCUSSION =
  /^(?:oi|ola|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|perfeito|entendi|hmm|o que|oque|qual|quais|como|por que|porque|quando|onde|quem|me explica|explique|me conte|me da (?:uma )?(?:ideia|opiniao|sugestao)|o que voce acha|voce acha|acha que|seria|ficaria|faz sentido|na sua opiniao|tenho uma duvida)\b/;

const EXPLICIT_NO_ACTION =
  /\b(?:nao (?:mude|altere|edite|aplique|salve|execute|publique|faca) nada|sem (?:mudar|alterar|editar|aplicar|salvar|executar|publicar|fazer) nada|so (?:quero )?(?:conversar|entender|saber|uma ideia|sua opiniao))\b/;

// “Tem uma seção entre X e Y. Apague-a.” continua sendo uma ordem, embora o
// verbo não esteja no começo da mensagem. Exigimos um alvo de seção para não
// transformar uma menção casual a uma foto ou a um card em edição.
const DIRECT_SECTION_REMOVAL =
  /\b(?:secao|sessao|bloco|faixa|banner|galeria|formulario|hero|abertura|rodape|footer|cabecalho|header|menu)\b[\s\S]{0,180}\b(?:remov\w*|retir\w*|tir[ae]\w*|apag\w*|exclu\w*|delet\w*)(?:-[ao]s?)?\b|\b(?:remov\w*|retir\w*|tir[ae]\w*|apag\w*|exclu\w*|delet\w*)(?:-[ao]s?)?\b[\s\S]{0,180}\b(?:secao|sessao|bloco|faixa|banner|galeria|formulario|hero|abertura|rodape|footer|cabecalho|header|menu)\b/;

/**
 * Libera escrita somente quando o operador formula uma ação reconhecível.
 * Perguntas, hipóteses, contexto solto e anexos sem instrução ficam em modo de
 * conversa; o modelo pode orientar e consultar o estado, mas não alterar nada.
 */
export function interactionModeFor(
  text: string,
  previousAssistantText = '',
): InteractionMode {
  const request = normalized(text);
  if (!request || EXPLICIT_NO_ACTION.test(request)) return 'conversation';

  const affirmative =
    /^(?:sim|pode|pode sim|isso|isso mesmo|exato|exatamente|vai|manda|faz|faca|aplica|aplique|confirmo|autorizo)[.! ]*$/.test(
      request,
    );
  const previous = normalized(previousAssistantText);
  if (
    affirmative &&
    previous.includes('?') &&
    new RegExp(
      String.raw`\b(?:quer que eu|posso|devo)\b.{0,100}\b${ACTION_VERB}\b`,
    ).test(previous)
  )
    return 'action';
  // Confirmação de exclusão é retomada pela pendência registrada no servidor.
  // Sem ela, um texto anterior do assistente não concede escrita.
  if (/^(?:confirmo|confirmado|autorizo)\b/.test(request))
    return 'conversation';

  // “Pode trocar o hero?” é um pedido. “O que você pode trocar?” é capacidade.
  const asksDirectAction = new RegExp(
    String.raw`^(?:(?:por favor|eixu)\s*[,.:;-]?\s*)*(?:voce\s+)?(?:pode|consegue|da para)\s+(?:voce\s+)?${ACTION_VERB}\b`,
  ).test(request);
  if (asksDirectAction) return 'action';
  if (CLEAR_DISCUSSION.test(request)) return 'conversation';
  if (HYPOTHETICAL.test(request)) return 'conversation';

  if (DIRECT_SECTION_REMOVAL.test(request)) return 'action';

  if (
    DIRECT_ACTION.test(request) ||
    DESIRED_RESULT.test(request) ||
    DESIRED_STATE.test(request) ||
    COLLABORATIVE_ACTION.test(request) ||
    SCOPED_ACTION.test(request) ||
    TERSE_SITE_EDIT.test(request)
  )
    return 'action';

  return 'conversation';
}

const CONVERSATION_TOOLS = new Set([
  'read_generator_manual',
  'list_state',
  'get_page',
  'describe_block',
  'list_images',
  'lint_page',
  'lint_site',
]);

/** Defesa em profundidade: conversa não recebe nenhum executor de escrita. */
export function conversationTools<T extends ToolSet>(tools: T): T {
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => CONVERSATION_TOOLS.has(name)),
  ) as T;
}
