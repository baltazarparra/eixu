import type { ToolSet } from 'ai';
import type { BlockInstance, Page } from '@/lib/types';

export type EditPolicy = {
  kind: 'edit' | 'navigation-style';
  targets?: { page: string; block: string }[];
  paths?: string[];
  /** O pedido atual menciona tirar conteúdo. Sem isso, apagar texto é recusado. */
  removal?: boolean;
  /** Pedido visual em um bloco nomeado: preserva conteúdo, tipo e ordem. */
  visualOnly?: boolean;
};

function normalized(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Uma restrição como "apenas mova" ou "sem apagar" não autoriza remoção.
 * Tirar decoração também não dá permissão para apagar o conteúdo do bloco. */
export function asksRemoval(text: string): boolean {
  const verb =
    '(?:remov\\w*|retir\\w*|tir[ae]\\w*|apag\\w*|exclu\\w*|delet\\w*|ocult\\w*|escond\\w*|encurt\\w*|cort[ae]\\w*)';
  const request = normalized(text).replace(/["“][^"”]*["”]/g, '');
  return request.split(/[.;!?\n]/).some((clause) => {
    if (
      new RegExp(
        `\\b(?:nao|nunca|jamais|sem|evite)(?:\\s+\\w+){0,3}\\s+${verb}\\b`,
      ).test(clause)
    )
      return false;
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

function namedVisualScope(text: string, pages: Page[], pageSlug?: string) {
  const quoted = text.match(/\b(?:bloco|se[cç][aã]o)\s+["“]([^"”]+)["”]/i)?.[1];
  if (!quoted) return undefined;
  const request = normalized(text.replace(quoted, ''));
  if (
    !/\b(imagem|imagens|foto|bg|background|borda|border|padding|margin|margem|width|largura|espaco|espacamento|clean|moldura)\b/.test(
      request,
    )
  )
    return undefined;
  if (
    /\b(texto|titulo|copy|reescreva|conteudo|remova|apague|exclua|insira|adicione|reordene|substitua|troque|analise|revise|revisao|confira)\b/.test(
      request,
    )
  )
    return undefined;
  const scope = pages.filter(
    (page) => page.slug === (pageSlug ?? pages[0]?.slug),
  );
  const target = normalized(quoted).trim();
  const targets = scope.flatMap((page) =>
    page.blocks
      .filter((block) =>
        [block.id, block.props.title, block.props.eyebrow].some(
          (value) =>
            typeof value === 'string' && normalized(value).trim() === target,
        ),
      )
      .map((block) => ({ page: page.slug, block: block.id })),
  );
  return targets.length === 1 ? targets : [];
}

/** Política do turno atual: uma edição não herda autorização de reconstruções antigas. */
export function editPolicyFor(
  text: string,
  pages: Page[],
  pageSlug?: string,
): EditPolicy | undefined {
  if (!pages.length) return undefined;
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
  if (!header || other || (!position && !background)) {
    // Só o pedido atual, direto e sem negação abre reconstrução de um site existente.
    if (
      /^(?:(?:por favor|quero que voce)\s+)?(?:recrie|reconstrua|refaca|redesenhe)\s+(?:(?:todo|o|meu)\s+)*(?:site|projeto)\b/.test(
        request.trim(),
      ) &&
      !/\b(nao|apenas|somente|so)\b/.test(request)
    )
      return undefined;
    return { kind: 'edit', removal: asksRemoval(text) };
  }
  const homeOnly = /\b(home|pagina inicial|inicio)\b/.test(request);
  const selected = pages.filter((page) => !homeOnly || page.slug === '');
  return {
    kind: 'navigation-style',
    removal: asksRemoval(text),
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
            'presentation.foreground',
          ]
        : []),
    ],
  };
}

const REBUILD_TOOLS = new Set([
  'set_design',
  'build_site',
  'repair_site',
  'set_blocks',
]);
const NAVIGATION_TOOLS = new Set([
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
  'list_state',
  'get_page',
  'describe_block',
  'list_images',
  'edit_page',
  'lint_page',
  'lint_site',
]);

/** Remove capacidades do runtime, além do catálogo exposto ao modelo. */
export function editTools<T extends ToolSet>(tools: T, policy?: EditPolicy): T {
  if (!policy) return tools;
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) =>
      policy.visualOnly
        ? VISUAL_EDIT_TOOLS.has(name)
        : policy.kind === 'navigation-style'
          ? NAVIGATION_TOOLS.has(name)
          : !REBUILD_TOOLS.has(name) && !LEGACY_EDIT_TOOLS.has(name),
    ),
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
  if (policy?.visualOnly) {
    if (
      !policy.targets?.some(
        (target) => target.page === page && target.block === block.id,
      )
    )
      return 'Este pedido visual permite alterar somente o bloco nomeado. Preserve as outras seções.';
    if (type && type !== block.type)
      return 'Um ajuste visual não autoriza trocar o tipo do bloco. Use os controles do schema atual; se faltarem, explique o limite.';
    const outside = changedPaths(block.props, props).filter(
      (path) =>
        !/^presentation(?:\.|$)/.test(path) &&
        !/^(?:items\.\d+\.)?imagePresentation(?:\.|$)/.test(path) &&
        !/^(?:items\.\d+\.)?(?:image|imageAlt|imageFit|imagePosition|imageFocus)$/.test(
          path,
        ),
    );
    return outside.length
      ? `O pedido é visual. Estes campos mudariam conteúdo ou estrutura: ${outside.join(', ')}. Nenhuma alteração salva. Preserve layout, itens, textos e ações; ajuste a imagem e sua apresentação no bloco atual.`
      : null;
  }
  if (policy?.kind !== 'navigation-style') return null;
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

export function editScopeText(policy?: EditPolicy): string {
  if (policy?.visualOnly)
    return `Ajuste visual no bloco nomeado. Alvos: ${JSON.stringify(policy.targets)}. Preserve tipo, layout, ordem, itens, textos e ações. Use presentation e imagePresentation do schema, sem reconstruir a seção ou a página. Trocar a imagem não altera outros itens. Se o alvo não foi encontrado ou o schema não atende, explique o limite sem gravar.`;
  return policy?.kind === 'navigation-style'
    ? `Pedido restrito ao estilo do cabeçalho. Alvos: ${JSON.stringify(policy.targets)}. Campos permitidos: ${policy.paths?.join(', ')}. Preserve marca, textos, links, imagens, outros campos e todos os outros blocos. Achados da revisão fora desses alvos devem ser relatados, nunca corrigidos neste turno.`
    : 'Edição de site existente. Preserve a direção e os blocos fora do pedido atual. Reconstrução completa não está disponível neste turno; não tente contorná-la com várias edições pequenas. Uma revisão não autoriza corrigir achados fora do pedido.';
}
