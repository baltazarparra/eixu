import type { ToolSet } from 'ai';
import type { BlockInstance, Page } from '@/lib/types';

export type EditPolicy = {
  kind: 'edit' | 'navigation-style';
  targets?: { page: string; block: string }[];
  paths?: string[];
};

/** Política do turno atual: uma edição não herda autorização de reconstruções antigas. */
export function editPolicyFor(
  text: string,
  pages: Page[],
): EditPolicy | undefined {
  if (!pages.length) return undefined;
  const request = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const header = /\b(header|nav|navbar|cabecalho|menu)\b/.test(request);
  const other = /\b(hero|rodape|footer|galeria|gallery)\b/.test(request);
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
    return { kind: 'edit' };
  }
  const homeOnly = /\b(home|pagina inicial|inicio)\b/.test(request);
  const selected = pages.filter((page) => !homeOnly || page.slug === '');
  return {
    kind: 'navigation-style',
    targets: selected.flatMap((page) =>
      page.blocks
        .filter((block) => block.type === 'nav.bar')
        .map((block) => ({ page: page.slug, block: block.id })),
    ),
    paths: [
      ...(position ? ['position'] : []),
      ...(background ? ['backgroundOpacity', 'presentation.tone'] : []),
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
  'lint_page',
  'lint_site',
  'review_pages',
]);

/** Remove capacidades do runtime, além do catálogo exposto ao modelo. */
export function editTools<T extends ToolSet>(tools: T, policy?: EditPolicy): T {
  if (!policy) return tools;
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) =>
      policy.kind === 'navigation-style'
        ? NAVIGATION_TOOLS.has(name)
        : !REBUILD_TOOLS.has(name),
    ),
  ) as T;
}

function changedPaths(before: unknown, after: unknown, prefix = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const object = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
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
  return policy?.kind === 'navigation-style'
    ? `Pedido restrito ao estilo do cabeçalho. Alvos: ${JSON.stringify(policy.targets)}. Campos permitidos: ${policy.paths?.join(', ')}. Preserve marca, textos, links, imagens, outros campos e todos os outros blocos. Achados da revisão fora desses alvos devem ser relatados, nunca corrigidos neste turno.`
    : 'Edição de site existente. Preserve a direção e os blocos fora do pedido atual. Reconstrução completa não está disponível neste turno; não tente contorná-la com várias edições pequenas. Uma revisão não autoriza corrigir achados fora do pedido.';
}
