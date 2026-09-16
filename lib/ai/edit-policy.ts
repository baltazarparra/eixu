import type { ToolSet } from 'ai';
import type { BlockInstance, Page } from '@/lib/types';

export type EditPolicy = {
  kind: 'edit' | 'navigation-style';
  targets?: { page: string; block: string }[];
  paths?: string[];
  /** O pedido atual menciona tirar conteúdo. Sem isso, apagar texto é recusado. */
  removal?: boolean;
  /**
   * Até onde vai a autorização de remover: `item` tira um elemento de uma
   * lista, `block` tira a seção inteira. Indefinido significa que o pedido
   * menciona remoção sem dizer o tamanho, e a operação destrutiva precisa de
   * confirmação. "remove esse bloco em anexo" apagou uma seção com quatro
   * cards porque a autorização era um único bit para o turno inteiro.
   */
  removalScope?: 'item' | 'block';
  /** Pedido visual em um bloco nomeado: preserva conteúdo, tipo e ordem. */
  visualOnly?: boolean;
  /** Famílias nomeadas pelo operador, aplicadas nas páginas selecionadas. */
  visualFamilies?: string[];
};

function normalized(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function containsExactText(value: unknown, target: string): boolean {
  if (typeof value === 'string') return normalized(value).trim() === target;
  if (Array.isArray(value))
    return value.some((item) => containsExactText(item, target));
  if (value && typeof value === 'object')
    return Object.entries(value).some(
      ([key, child]) =>
        !['href', 'image', 'url'].includes(key) &&
        containsExactText(child, target),
    );
  return false;
}

const NON_CONTENT_KEYS = new Set([
  'anchor',
  'presentation',
  'textStyles',
  'imagePresentation',
  'carousel',
  'layout',
  'href',
  'image',
  'url',
  'src',
  'evidence',
  'icon',
  'role',
  'type',
  'name',
  'position',
  'focalPoint',
  'imageFit',
  'imagePosition',
  'bulletsPlacement',
  'badgesPlacement',
  'redirectTo',
]);

function textualValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textualValues);
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, child]) =>
      NON_CONTENT_KEYS.has(key) ? [] : textualValues(child),
    );
  return [];
}

function containsTextSequence(value: unknown, target: string): boolean {
  const joined = normalized(textualValues(value).join(' ')).replace(
    /\s+/g,
    ' ',
  );
  return joined.includes(target.replace(/\s+/g, ' '));
}

/** Uma restrição como "apenas mova" ou "sem apagar" não autoriza remoção.
 * Tirar decoração também não dá permissão para apagar o conteúdo do bloco. */
const REMOVAL_VERB =
  '(?:remov\\w*|retir\\w*|tir[ae]\\w*|apag\\w*|exclu\\w*|delet\\w*|ocult\\w*|escond\\w*|encurt\\w*|cort[ae]\\w*)';

/** A autorização e seu tamanho usam os mesmos trechos, sem citações ou negações. */
function removalRequest(text: string): string {
  return normalized(text)
    .replace(/["“][^"”]*["”]|'[^']*'|‘[^’]*’/g, '')
    .split(/[.;!?\n]/)
    .filter(
      (clause) =>
        !new RegExp(
          `\\b(?:nao|nunca|jamais|sem|evite)(?:\\s+\\w+){0,3}\\s+${REMOVAL_VERB}\\b`,
        ).test(clause),
    )
    .join('. ');
}

export function asksRemoval(text: string): boolean {
  const verb = REMOVAL_VERB;
  return removalRequest(text)
    .split(/[.;!?\n]/)
    .some((clause) => {
      const contentRequest = clause
        .replace(
          new RegExp(
            `\\b${verb}\\s+(?:(?:o|a|os|as|esse|essa|esses|essas|este|esta|estes|estas)\\s+)?(?:bg|background|fundo|bordas?|molduras?|padding|margin|margens?|espacamento|espaco|sombra)\\b`,
            'g',
          ),
          '',
        )
        .replace(
          // "Remover esse container e deixar apenas a imagem" tira decoração;
          // não é permissão para apagar o texto ou substituir a abertura.
          new RegExp(
            `\\b${verb}\\s+(?:(?:o|a|esse|essa|este|esta)\\s+)?(?:container|conteiner|contêiner|box|caixa)\\b(?=\\s+e\\s+(?:deixar|deixe|manter|mantenha)\\s+(?:so|apenas|somente)\\s+(?:a\\s+)?(?:imagem|foto)\\b)`,
            'g',
          ),
          '',
        );
      return (
        new RegExp(`\\b${verb}\\b`).test(contentRequest) ||
        /\bsem\s+(?:o|a|os|as)\s+(?:selos?|etiquetas?|textos?|blocos?|secoes?|imagens?|fotos?|botoes?|links?)\b/.test(
          contentRequest,
        ) ||
        /\bdeix[ae]\s+(?:so|apenas|somente)\s+(?:\d+|um|uma|dois|duas|tres)\s+(?:selos?|etiquetas?|itens|blocos?|secoes?)\b/.test(
          contentRequest,
        )
      );
    });
}

/**
 * Até onde o pedido atual autoriza remover.
 *
 * O padrão é o dano menor: quando o operador aponta o alvo por imagem, ou não
 * diz o tamanho, o resultado é indefinido e a remoção de uma seção inteira
 * passa a exigir confirmação. Nomear um card, uma foto ou uma parte autoriza
 * só o item, mesmo que a frase cite o bloco onde ele está.
 */
export function removalScope(text: string): 'item' | 'block' | undefined {
  if (!asksRemoval(text)) return undefined;
  const request = removalRequest(text);
  const section =
    '(?:secao|secoes|sessao|sessoes|blocos?|faixas?|banner|galeria|rodape|footer|cabecalho|header|menu|navbar|formulario|hero|abertura)';
  const item =
    /\b(cards?|cartao|cartoes|item|itens|parte|partes|pedaco|trecho|fotos?|imagens?|icones?|botoes?|botao|links?|selos?|etiquetas?|depoimentos?|perguntas?|colunas?|linhas?|opcoes|opcao)\b/.test(
      request,
    );
  const block = new RegExp(`\\b${section}\\b`).test(request);
  const explicitWholeBlock =
    new RegExp(`\\b${section}\\s+(?:inteir\\w*|complet\\w*)\\b`).test(
      request,
    ) ||
    new RegExp(
      `\\b(?:toda|todo|todas|todos)\\s+(?:a\\s+|o\\s+|as\\s+|os\\s+)?${section}\\b`,
    ).test(request);
  // Alvo apontado por imagem: o texto não diz o que é, e o modelo adivinha.
  const pointed =
    /\b(anex\w*|referencia|print|captura|screenshot|imagem acima|acima|marcad\w*|circulad\w*)\b/.test(
      request,
    );
  // O objeto do verbo decide o tamanho: em "remova a seção com a foto", a
  // foto identifica a seção; em "remova a foto da seção", ela é o alvo.
  const directBlockTarget = new RegExp(
    `\\b(?:remov\\w*|retir\\w*|tir[ae]\\w*|apag\\w*|exclu\\w*|delet\\w*)\\s+(?:(?:a|o|as|os|essa|esse|esta|este|aquela|aquele|toda|todo)\\s+){0,2}${section}\\b`,
  ).test(request);
  const anaphoricBlockTarget = new RegExp(
    `^(?:tem|ha|existe)\\s+(?:uma?|alguma)\\s+${section}\\b[\\s\\S]{0,180}\\b(?:remov\\w*|retir\\w*|tir[ae]\\w*|apag\\w*|exclu\\w*|delet\\w*)-[ao]\\b`,
  ).test(request);
  // O alvo menor prevalece. Palavras de preservação como “todos os outros”
  // não podem transformar “remova esse card da seção” em autorização para
  // apagar a seção inteira.
  if (block && explicitWholeBlock && (!item || directBlockTarget))
    return 'block';
  if ((directBlockTarget || anaphoricBlockTarget) && !pointed) return 'block';
  if (item) return 'item';
  if (block) return pointed ? undefined : 'block';
  return undefined;
}

function namedVisualScope(text: string, pages: Page[], pageSlug?: string) {
  const quoted = text.match(/\b(?:bloco|se[cç][aã]o)\s+["“]([^"”]+)["”]/i)?.[1];
  if (!quoted) return undefined;
  const request = normalized(text.replace(quoted, ''));
  if (
    !/\b(imagem|imagens|foto|fotos|carrossel|carousel|slider|slides?|autoplay|bg|background|borda|border|padding|margin|margem|width|largura|altura|gap|espaco|espacamento|clean|moldura|raio|radius|sombra|shadow|opacidade|alinh\w*|text[ -]?align|direita|esquerda|centraliz\w*|centro)\b/.test(
      request,
    )
  )
    return undefined;
  if (
    /\b(reescreva|remova|apague|exclua|insira|adicione|reordene|mov\w*|reposicion\w*|disposi[cç][aã]o|substitua|troque|analise|revise|revisao|confira)\b/.test(
      request,
    )
  )
    return undefined;
  const target = normalized(quoted).trim();
  const matches = (scope: Page[]) =>
    scope.flatMap((page) =>
      page.blocks
        .filter(
          (block) =>
            normalized(block.id).trim() === target ||
            containsExactText(block.props, target) ||
            containsTextSequence(block.props, target),
        )
        .map((block) => ({ page: page.slug, block: block.id })),
    );
  const focused = matches(
    pages.filter((page) => page.slug === (pageSlug ?? pages[0]?.slug)),
  );
  if (focused.length === 1) return focused;
  const targets = matches(pages);
  return targets.length === 1 ? targets : [];
}

const VISUAL_FAMILIES = [
  { family: 'footer', pattern: /\b(?:rodape|footer)\b/ },
  { family: 'nav', pattern: /\b(?:cabecalho|header|navbar|menu)\b/ },
  { family: 'hero', pattern: /\b(?:abertura|banner|hero)\b/ },
] as const;

function explicitPageScope(text: string, pages: Page[], pageSlug?: string) {
  const request = normalized(text);
  if (/\b(?:nesta|nessa|esta|essa)\s+pagina\b|\bpagina\s+atual\b/.test(request))
    return pages.filter((page) => page.slug === (pageSlug ?? ''));
  if (/\b(?:home|pagina\s+(?:inicial|["“]?inicio["”]?))\b/.test(request))
    return pages.filter((page) => page.slug === '');
  const named = pages.filter((page) => {
    if (!page.slug) return false;
    const slug = normalized(page.slug);
    const title = normalized(page.title ?? '');
    return (
      request.includes(`/${slug}`) ||
      new RegExp(
        `\\bpagina\\s+(?:de\\s+)?${slug.replaceAll('-', '[ -]')}\\b`,
      ).test(request) ||
      (title.length >= 4 &&
        new RegExp(
          `\\bpagina\\s+(?:de\\s+)?${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
        ).test(request))
    );
  });
  return named.length ? named : pages;
}

function familyVisualScope(text: string, pages: Page[], pageSlug?: string) {
  const request = normalized(text);
  if (
    !/\b(?:bg|background|fundo|cor(?:es)?|cinza|gray|preto|branco|clar\w*|escur\w*|degrade|gradiente|lavagem|liso|solido|transparen\w*|alinh\w*|text[ -]?align|direita|esquerda|centraliz\w*|centro)\b/.test(
      request,
    )
  )
    return undefined;
  if (
    /\b(?:reescrev\w*|renome\w*|substitu\w*|troc\w*)\s+(?:(?:o|a)\s+)?(?:texto|titulo|copy|conteudo|link)\b/.test(
      request,
    )
  )
    return undefined;
  const families = VISUAL_FAMILIES.filter(({ pattern }) =>
    pattern.test(request),
  ).map(({ family }) => family);
  if (!families.length) return undefined;
  const familySet = new Set<string>(families);
  const scope = explicitPageScope(text, pages, pageSlug);
  return {
    families,
    targets: scope.flatMap((page) =>
      page.blocks
        .filter((block) => familySet.has(block.type.split('.')[0]))
        .map((block) => ({ page: page.slug, block: block.id })),
    ),
  };
}

/** Página nomeada ou identificada pelo conteúdo vence a aba aberta em qualquer edição. */
export function requestedEditingPage(
  text: string,
  pages: Page[],
  focused?: Page,
): Page | undefined {
  const request = normalized(text);
  const explicit =
    /\b(?:home|pagina\s+(?:inicial|["“]?inicio["”]?))\b/.test(request) ||
    pages.some((page) => {
      if (!page.slug) return false;
      const slug = normalized(page.slug).replaceAll('-', '[ -]');
      const title = normalized(page.title ?? '').replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      return (
        new RegExp(`(?:/${slug}|\\bpagina\\s+(?:de\\s+)?${slug}\\b)`).test(
          request,
        ) ||
        (title.length >= 4 &&
          new RegExp(`\\bpagina\\s+(?:de\\s+)?${title}\\b`).test(request))
      );
    });
  if (explicit) {
    const scoped = explicitPageScope(text, pages, focused?.slug);
    if (scoped.length === 1) return scoped[0];
  }
  const quotes = [...text.matchAll(/["“]([^"”\n]{4,})["”]/g)].map((match) =>
    normalized(match[1]).trim(),
  );
  for (const quote of quotes) {
    const matches = pages.filter((page) =>
      page.blocks.some(
        (block) =>
          containsExactText(block.props, quote) ||
          containsTextSequence(block.props, quote),
      ),
    );
    if (matches.length) return matches.length === 1 ? matches[0] : focused;
  }
  return focused;
}

/** Política do turno atual: uma edição não herda autorização de reconstruções antigas. */
export function editPolicyFor(
  text: string,
  pages: Page[],
  pageSlug?: string,
  options: {
    /** O turno anterior perguntou, em recibo verificável, se podia remover a
     * seção inteira, e o operador respondeu que sim. */
    confirmedBlockRemoval?: boolean;
  } = {},
): EditPolicy | undefined {
  if (!pages.length) return undefined;
  const scope = options.confirmedBlockRemoval
    ? ('block' as const)
    : removalScope(text);
  const visualTargets = namedVisualScope(text, pages, pageSlug);
  if (visualTargets)
    return {
      kind: 'edit',
      visualOnly: true,
      targets: visualTargets,
      removal: false,
    };
  const request = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const header = /\b(header|nav|navbar|cabecalho|menu)\b/.test(request);
  const other =
    /\b(hero|rodape|footer|galeria|gallery|texto|titulo|logo|links?|cta|botao|fonte|tamanho)\b/.test(
      request,
    );
  const position = /\b(fix\w*|rolagem|scroll|grudad\w*)\b/.test(request);
  const background =
    /\b(bg|fundo|background|dark\w*|escur\w*|transparen\w*|opaci\w*|solid\w*)\b/.test(
      request,
    );
  if (header && !other && (position || background)) {
    const selected = explicitPageScope(text, pages, pageSlug);
    return {
      kind: 'navigation-style',
      visualOnly: true,
      visualFamilies: ['nav'],
      removal: asksRemoval(text) || options.confirmedBlockRemoval === true,
      removalScope: scope,
      targets: selected.flatMap((page) =>
        page.blocks
          .filter((block) => block.type === 'nav.bar')
          .map((block) => ({ page: page.slug, block: block.id })),
      ),
      paths: [
        ...(position ? ['position'] : []),
        ...(background
          ? [
              'backgroundOpacity',
              'presentation.tone',
              'presentation.background',
              'presentation.backgroundEnd',
              'presentation.gradient',
              'presentation.decoration',
              'presentation.foreground',
            ]
          : []),
      ],
    };
  }
  const familyVisual = familyVisualScope(text, pages, pageSlug);
  if (familyVisual)
    return {
      kind: 'edit',
      visualOnly: true,
      visualFamilies: familyVisual.families,
      targets: familyVisual.targets,
      removal: false,
    };
  if (!header || other || (!position && !background)) {
    // Só o pedido atual, direto e sem negação abre reconstrução de um site existente.
    if (
      /^(?:(?:por favor|quero que voce)\s+)?(?:recrie|reconstrua|refaca|redesenhe)\s+(?:(?:todo|o|meu)\s+)*(?:site|projeto)\b/.test(
        request.trim(),
      ) &&
      !/\b(nao|apenas|somente|so)\b/.test(request)
    )
      return undefined;
    return {
      kind: 'edit',
      removal: asksRemoval(text) || options.confirmedBlockRemoval === true,
      removalScope: scope,
    };
  }
  return {
    kind: 'edit',
    removal: asksRemoval(text) || options.confirmedBlockRemoval === true,
    removalScope: scope,
  };
}

const REBUILD_TOOLS = new Set([
  'set_design',
  'build_site',
  'repair_site',
  'set_blocks',
]);
const NAVIGATION_TOOLS = new Set([
  'read_generator_manual',
  'list_state',
  'get_page',
  'describe_block',
  'update_block',
  'edit_page',
  'lint_page',
  'lint_site',
  'review_pages',
]);
const LEGACY_EDIT_TOOLS = new Set([
  'update_block',
  'insert_block',
  'move_block',
  'remove_block',
]);
const VISUAL_EDIT_TOOLS = new Set([
  'read_generator_manual',
  'undo_page_edit',
  'list_state',
  'get_page',
  'describe_block',
  'list_images',
  'edit_page',
  'lint_page',
  'lint_site',
]);

/** Remove capacidades do runtime, além do catálogo exposto ao modelo. */
export function editTools<T extends ToolSet>(
  tools: T,
  policy?: EditPolicy,
  repairPublication = false,
): T {
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => {
      if (name === 'repair_publication' && !repairPublication) return false;
      if (!policy) return true;
      return policy.kind === 'navigation-style'
        ? NAVIGATION_TOOLS.has(name)
        : policy.visualOnly
          ? VISUAL_EDIT_TOOLS.has(name)
          : !REBUILD_TOOLS.has(name) && !LEGACY_EDIT_TOOLS.has(name);
    }),
  ) as T;
}

function changedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const object = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object';
  if (object(after) && (before === undefined || object(before))) {
    return [
      ...new Set([...Object.keys(before ?? {}), ...Object.keys(after)]),
    ].flatMap((key) =>
      changedPaths(
        before?.[key],
        after[key],
        prefix ? `${prefix}.${key}` : key,
      ),
    );
  }
  return [prefix];
}

/** Verifica os campos efetivamente alterados antes da escrita, inclusive após uma crítica. */
export function scopedUpdateError(
  policy: EditPolicy | undefined,
  page: string,
  block: BlockInstance,
  props: Record<string, unknown>,
  type?: string,
): string | null {
  if (policy?.kind === 'navigation-style') {
    if (
      block.type !== 'nav.bar' ||
      (type && type !== block.type) ||
      !policy.targets?.some(
        (target) => target.page === page && target.block === block.id,
      )
    )
      return 'Este pedido permite alterar somente os cabeçalhos identificados. Preserve os demais blocos e relate pendências externas ao pedido.';
    const outside = changedPaths(block.props, props).filter(
      (path) => !policy.paths?.includes(path),
    );
    return outside.length
      ? `Campos fora do pedido: ${outside.join(', ')}. Altere somente ${policy.paths?.join(', ')}.`
      : null;
  }
  if (policy?.visualOnly) {
    if (
      !policy.targets?.some(
        (target) => target.page === page && target.block === block.id,
      )
    )
      return 'Este pedido visual permite alterar somente os blocos identificados. Preserve as outras seções.';
    if (type && type !== block.type)
      return 'Um ajuste visual não autoriza trocar o tipo do bloco. Use os controles do schema atual; se faltarem, explique o limite.';
    const outside = changedPaths(block.props, props).filter(
      (path) =>
        !/^presentation(?:\.|$)/.test(path) &&
        !/^textStyles(?:\.|$)/.test(path) &&
        !(
          block.type === 'nav.bar' &&
          /^(?:position|backgroundOpacity)$/.test(path)
        ) &&
        !/^(?:items\.\d+\.)?imagePresentation(?:\.|$)/.test(path) &&
        !/^slides(?:\.|$)/.test(path) &&
        !/^carousel(?:\.|$)/.test(path) &&
        !/^(?:items\.\d+\.)?(?:image|imageAlt|imageFit|imagePosition|imageFocus)$/.test(
          path,
        ),
    );
    return outside.length
      ? `O pedido é visual. Estes campos mudariam conteúdo ou estrutura: ${outside.join(', ')}. Nenhuma alteração salva. Preserve layout, itens, textos e ações; ajuste a imagem e sua apresentação no bloco atual.`
      : null;
  }
  return null;
}

export function editScopeText(policy?: EditPolicy): string {
  if (policy?.kind === 'navigation-style')
    return `Pedido visual restrito aos cabeçalhos. Alvos: ${JSON.stringify(policy.targets)}. Campos permitidos: ${policy.paths?.join(', ')}. Preserve marca, textos, links, imagens, outros campos e todos os outros blocos. Achados da revisão fora desses alvos devem ser relatados, nunca corrigidos neste turno.`;
  if (policy?.visualOnly)
    return `Ajuste visual ${policy.visualFamilies?.length ? `nas famílias ${policy.visualFamilies.join(', ')}` : 'no bloco nomeado'}. Alvos: ${JSON.stringify(policy.targets)}. Preserve tipo, ordem, itens, textos e ações. Use primeiro o campo dedicado; para partes internas use presentation.elements no alvo atual. Para um campo isolado, use textStyles; para todo o texto, presentation.textAlign; para o grupo e controles, presentation.contentAlign. Não reconstrua a seção ou a página e não substitua o efeito pedido por outra composição.`;
  return 'Edição de site existente. Preserve a direção e os blocos fora do pedido atual. Reconstrução completa não está disponível neste turno; não tente contorná-la com várias edições pequenas. Uma revisão não autoriza corrigir achados fora do pedido.';
}
