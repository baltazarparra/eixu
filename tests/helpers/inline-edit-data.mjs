import { createJiti } from 'jiti';
const j = createJiti(import.meta.url, {
  alias: { '@': process.cwd() },
  fsCache: false,
});
const { z } = await import('zod');
const { blockSchemas } = await j.import('../../lib/blocks/registry.ts');

function sample(schema, path = '') {
  const key = path.split('.').at(-1);
  if (schema.default !== undefined && !['facts', 'links'].includes(key))
    return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'object')
    return Object.fromEntries(
      Object.entries(schema.properties ?? {})
        .filter(
          ([name]) =>
            ![
              'textStyles',
              'presentation',
              'anchor',
              'logoHeight',
              'position',
              'backgroundOpacity',
            ].includes(name),
        )
        .map(([name, child]) => [
          name,
          sample(child, path ? `${path}.${name}` : name),
        ]),
    );
  if (schema.type === 'array')
    return Array.from({ length: Math.max(schema.minItems ?? 1, 1) }, (_, i) =>
      sample(schema.items, `${path}.${i}`),
    );
  if (schema.type === 'boolean') return false;
  if (schema.type === 'integer' || schema.type === 'number')
    return schema.minimum ?? 1;
  if (schema.type === 'string') {
    if (/image|src|secondaryImage$/.test(key) && !/Alt|Caption/.test(key))
      return `https://assets.test/${path.replaceAll('.', '-')}.webp`;
    if (['href', 'redirectTo'].includes(key))
      return `/materiais-${path.replaceAll('.', '-')}`;
    if (key === 'name' && path.startsWith('fields')) return 'email';
    const text = `Conteúdo ${path.replaceAll('.', ' ')} para leitura clara no site. Mais detalhes para orientar a escolha.`;
    return text.slice(
      0,
      Math.min(schema.maxLength ?? 60, Math.max(schema.minLength ?? 4, 32)),
    );
  }
}
export function inlineBlocks() {
  return Object.entries(blockSchemas).map(([type, schema], index) => {
    const props = sample(z.toJSONSchema(schema));
    if (type === 'signature.composition')
      props.items.forEach((item, i) => {
        item.role = i === 0 ? 'focus' : 'support';
      });
    if (type === 'hero.split') props.layout = 'atelier';
    if (type === 'editorial.text')
      props.body += '\n\nOutro parágrafo com conteúdo diferente.';
    if (type === 'form.lead')
      props.fields = [
        {
          name: 'motivo',
          type: 'select',
          label: 'Motivo',
          options: ['Informações', 'Orçamento'],
        },
      ];
    const parsed = schema.safeParse(props);
    if (!parsed.success) throw new Error(`${type}: ${parsed.error.message}`);
    return { id: `block-${index}`, type, props: parsed.data };
  });
}
