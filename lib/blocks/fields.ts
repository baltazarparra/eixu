import { z } from 'zod';
import { blockSchemas, isBlockType } from './registry';
import type { BlockInstance, Brand } from '@/lib/types';
import type { TextStyle } from './text-style-schema';

export type TextField = {
  block: string;
  path: string;
  label: string;
  value: string;
  min: number;
  max: number | null;
  multiline: boolean;
  editable: boolean;
  stylable: boolean;
  minStep: -2 | -1;
  style?: TextStyle;
};
export type FieldError = { block: string; path: string; message: string };

const labels: Record<string, string> = {
  headline: 'Título principal',
  subtext: 'Texto de apoio',
  eyebrow: 'Chamada',
  title: 'Título',
  lead: 'Introdução',
  body: 'Parágrafo',
  quote: 'Depoimento',
  author: 'Autor',
  role: 'Cargo',
  q: 'Pergunta',
  a: 'Resposta',
  tagline: 'Descrição',
  legal: 'Texto legal',
  caption: 'Legenda',
  imageCaption: 'Legenda da foto',
  secondaryCaption: 'Legenda da segunda foto',
  category: 'Categoria',
  note: 'Observação',
  price: 'Preço',
  name: 'Nome',
  label: 'Rótulo',
  value: 'Valor',
  logoText: 'Nome da marca',
  submitLabel: 'Botão de envio',
  consentText: 'Consentimento',
  address: 'Endereço',
  facts: 'Fato',
  features: 'Característica',
  bullets: 'Destaque',
  logos: 'Marca',
  options: 'Opção',
};
const arrays = new Set(['facts', 'features', 'bullets', 'logos', 'options']);
const prose =
  /(?:^|\.)(body|a|legal|note|consentText|caption|imageCaption|secondaryCaption)$/;
const controls =
  /(?:^|\.)(cta|secondary|links|fields)(?:\.|$)|^(submitLabel|consentText|logoText|address)$/;
type Schema = {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, Schema>;
  items?: Schema;
  minLength?: number;
  maxLength?: number;
};

/** Inventário derivado das strings do schema; configuração, URLs e enums nunca viram texto. */
export function blockFields(block: BlockInstance, brand?: Brand): TextField[] {
  if (
    !isBlockType(block.type) ||
    ['editorial.postList', 'editorial.postBody'].includes(block.type)
  )
    return [];
  const parsed = blockSchemas[block.type].safeParse(block.props);
  if (!parsed.success) return [];
  const styles = parsed.data.textStyles ?? [];
  const walk = (value: unknown, schema: Schema, path: string): TextField[] => {
    if (typeof value === 'string' && schema.type === 'string' && !schema.enum) {
      const pieces = path.split('.');
      const key = pieces.at(-1)!;
      const name = /^\d+$/.test(key) ? pieces.at(-2)! : key;
      if (
        !labels[name] ||
        (name === 'name' && !/^plans\.\d+\.name$/.test(path)) ||
        (/^\d+$/.test(key) && !arrays.has(name)) ||
        (path === 'logoText' && brand?.logoUrl)
      )
        return [];
      if (
        path === 'imageCaption' &&
        !('image' in parsed.data && parsed.data.image)
      )
        return [];
      if (
        path === 'secondaryCaption' &&
        !('secondaryImage' in parsed.data && parsed.data.secondaryImage)
      )
        return [];
      const indices = pieces
        .filter((part) => /^\d+$/.test(part))
        .map((part) => Number(part) + 1);
      return [
        {
          block: block.id,
          path,
          label: `${labels[name]}${indices.length ? ` ${indices.join('.')}` : ''}`,
          value,
          min: Math.max(1, schema.minLength ?? 0),
          max: schema.maxLength ?? null,
          multiline: block.type === 'editorial.text' && path === 'body',
          editable: true,
          stylable:
            !controls.test(path) &&
            !(
              block.type === 'feature.explorer' &&
              /^items\.\d+\.title$/.test(path)
            ),
          minStep: prose.test(path) ? -1 : -2,
          style: styles.find((style) => style.field === path),
        },
      ];
    }
    if (Array.isArray(value) && schema.items)
      return value.flatMap((item, index) =>
        walk(item, schema.items!, `${path}.${index}`),
      );
    if (value && typeof value === 'object' && schema.properties)
      return Object.entries(schema.properties).flatMap(([key, child]) =>
        ['presentation', 'textStyles'].includes(key)
          ? []
          : walk(
              (value as Record<string, unknown>)[key],
              child,
              path ? `${path}.${key}` : key,
            ),
      );
    return [];
  };
  return walk(
    parsed.data,
    z.toJSONSchema(blockSchemas[block.type]) as Schema,
    '',
  );
}

export function fieldTextError(
  field: TextField,
  value: string,
): string | undefined {
  if (value.trim().length < field.min)
    return `Use pelo menos ${field.min} caracteres.`;
  if (field.max !== null && value.length > field.max)
    return `Use até ${field.max} caracteres.`;
  if (field.path === 'headline' && Math.ceil(value.trim().length / 28) > 2)
    return 'O título principal deve caber em até duas linhas (56 caracteres).';
  if (field.path === 'subtext' && value.trim().split(/\s+/).length > 20)
    return 'Use até 20 palavras no texto de apoio.';
  if (value.includes('—'))
    return 'Use pontuação simples no lugar do travessão.';
  return undefined;
}

export function normalizeFieldText(value: string, multiline = false): string {
  return multiline
    ? value
        .replace(/\r/g, '')
        .split(/\n\s*\n/)
        .map((part) => part.replace(/\s+/g, ' ').trim())
        .join('\n\n')
    : value.replace(/\s+/g, ' ').trim();
}
