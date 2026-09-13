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
  | { type: typeof EDIT_PROTOCOL; action: 'save' };
export type EditorField = TextField & { backgrounds: string[] };
export type InlineEditorProps = {
  page: string;
  revision: string;
  fields: EditorField[];
  palette: { label: string; color: string }[];
};
