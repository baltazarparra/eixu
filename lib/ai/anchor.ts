import type { PointedAnchor } from '@/lib/blocks/edit-protocol';
import { blockSchemas, isBlockType } from '@/lib/blocks/registry';
import type { BlockInstance, Page } from '@/lib/types';

export type ResolvedAnchor = {
  page: string;
  blockId: string;
  blockType: string;
  /** Lista e índice do item apontado, quando o texto visível bate com as props. */
  path?: string;
  index?: number;
  label: string;
};

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function itemStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(itemStrings);
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(itemStrings);
  return [];
}

/**
 * Liga o elemento apontado na prévia ao conteúdo salvo.
 *
 * O índice só é aceito quando um texto do item aparece no que o operador
 * apontou: um índice de DOM sozinho pode não corresponder à ordem das props, e
 * um alvo errado aqui viraria a remoção do elemento errado.
 */
export function resolveAnchor(
  page: Page | undefined,
  anchor: PointedAnchor | undefined,
): ResolvedAnchor | undefined {
  if (!page || !anchor) return undefined;
  const block = page.blocks.find((item) => item.id === anchor.blockId);
  if (!block) return undefined;
  const pointed = normalize(anchor.text);
  const resolved: ResolvedAnchor = {
    page: `/${page.slug}`,
    blockId: block.id,
    blockType: block.type,
    label: anchor.label.slice(0, 80),
  };
  if (!pointed) return resolved;
  const props = parsedProps(block);
  for (const [key, value] of Object.entries(props)) {
    if (!Array.isArray(value) || value.length < 2) continue;
    const matches = value.flatMap((item, index) => {
      const texts = itemStrings(item)
        .map(normalize)
        .filter((text) => text.length >= 8);
      return texts.some((text) => pointed.includes(text)) ? [index] : [];
    });
    if (matches.length === 1) return { ...resolved, path: key, index: matches[0] };
  }
  return resolved;
}

function parsedProps(block: BlockInstance): Record<string, unknown> {
  if (!isBlockType(block.type)) return block.props;
  const parsed = blockSchemas[block.type].safeParse(block.props);
  return parsed.success
    ? (parsed.data as Record<string, unknown>)
    : block.props;
}

/** O que o agente lê sobre o alvo apontado. Dado do cliente, nunca instrução. */
export function anchorContext(anchor?: ResolvedAnchor): string | undefined {
  if (!anchor) return undefined;
  const target =
    anchor.index === undefined
      ? `o bloco ${anchor.blockType}#${anchor.blockId} inteiro`
      : `o item ${anchor.path}.${anchor.index} do bloco ${anchor.blockType}#${anchor.blockId}`;
  return `O operador apontou na prévia de ${anchor.page}: ${target} ("${anchor.label}"). Use este alvo em vez de deduzir pelo anexo. ${
    anchor.index === undefined
      ? 'Ele apontou a seção, não um item dela; confirme antes de qualquer remoção grande.'
      : `Para tirar esse elemento, use remove_item com path "${anchor.path}" e index ${anchor.index}; não apague o bloco.`
  }`;
}
