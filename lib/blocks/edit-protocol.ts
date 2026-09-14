import type { TextField, FieldError } from './fields';
import type { TextStyle } from './text-style-schema';

export const EDIT_PROTOCOL = 'eixu-edit/1';
export type EditChanges = {
  page: string;
  revision: string;
  blocks: {
    id: string;
    text?: Record<string, string>;
    textStyles?: TextStyle[];
  }[];
};
/**
 * Alvo apontado pelo operador na prévia.
 *
 * O anexo dizia "esse aqui" e o modelo adivinhava qual bloco ou card era. O
 * texto visível do elemento é o que liga o pixel ao conteúdo salvo: o servidor
 * confere esse texto nas props antes de aceitar o índice do item.
 */
export type PointedAnchor = {
  blockId: string;
  blockType?: string;
  /** Texto visível do elemento apontado, para o servidor localizar o item. */
  text: string;
  /** Título curto do elemento, exibido ao operador no compositor. */
  label: string;
};

export type EditorMessage =
  | {
      type: typeof EDIT_PROTOCOL;
      action: 'ready';
      page: string;
      revision: string;
      fields: number;
    }
  | {
      type: typeof EDIT_PROTOCOL;
      action: 'state';
      changed: boolean;
      invalid: FieldError[];
    }
  | ({ type: typeof EDIT_PROTOCOL; action: 'changes' } & EditChanges)
  | { type: typeof EDIT_PROTOCOL; action: 'save' }
  | { type: typeof EDIT_PROTOCOL; action: 'point'; enabled: boolean }
  | { type: typeof EDIT_PROTOCOL; action: 'point-ready' }
  | {
      type: typeof EDIT_PROTOCOL;
      action: 'anchor';
      page: string;
      anchor: PointedAnchor;
    };
export type EditorField = TextField & { backgrounds: string[] };
export type InlineEditorProps = {
  page: string;
  revision: string;
  fields: EditorField[];
  palette: { label: string; color: string }[];
};
