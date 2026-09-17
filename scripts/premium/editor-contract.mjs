import { assertEditorContract } from '../../lib/premium/editor-contract.mjs';

const LABELS = {
  headline: 'Título principal',
  subtext: 'Texto de apoio',
  eyebrow: 'Chamada',
  title: 'Título',
  lead: 'Introdução',
  body: 'Texto',
  quote: 'Depoimento',
  author: 'Autor',
  role: 'Cargo',
  q: 'Pergunta',
  a: 'Resposta',
  tagline: 'Descrição',
  legal: 'Texto legal',
  caption: 'Legenda',
  imageCaption: 'Legenda da imagem',
  secondaryCaption: 'Legenda da segunda imagem',
  category: 'Categoria',
  note: 'Observação',
  price: 'Preço',
  name: 'Nome',
  label: 'Rótulo',
  value: 'Valor',
  result: 'Resultado',
  logoText: 'Nome da marca',
  submitLabel: 'Botão de envio',
  consentText: 'Consentimento',
  alt: 'Descrição da imagem',
  address: 'Endereço',
  facts: 'Fato',
  features: 'Característica',
  bullets: 'Destaque',
  logos: 'Marca',
  options: 'Opção',
};
const IMAGE_KEYS = new Set(['image', 'secondaryImage', 'src']);
const MULTILINE_KEYS = new Set(['body', 'a', 'legal', 'note', 'consentText']);

function indexLabel(path) {
  const indices = path
    .split('.')
    .filter((piece) => /^\d+$/.test(piece))
    .map((piece) => Number(piece) + 1);
  return indices.length ? ` ${indices.join('.')}` : '';
}

function textLimit(name) {
  if (['headline', 'title'].includes(name)) return 180;
  if (['eyebrow', 'label', 'value', 'price', 'name'].includes(name)) return 120;
  if (['body', 'a', 'legal', 'note', 'consentText'].includes(name))
    return 4_000;
  return 600;
}

function fieldsForBlock(page, block) {
  const fields = [];
  const walk = (value, path = '') => {
    if (typeof value === 'string') {
      const pieces = path.split('.');
      const name = pieces.at(-1);
      const parent = pieces.at(-2);
      const image =
        IMAGE_KEYS.has(name) ||
        (name === 'url' && ['images', 'slides', 'photos'].includes(parent));
      if (image && (value.startsWith('https://') || value.startsWith('/'))) {
        fields.push({
          key: `page:${page.slug || 'home'}:block:${block.id}:${path}`,
          label: `Imagem${indexLabel(path)}`,
          type: 'image',
          value,
          required: Boolean(value),
          target: { page: page.slug, block: block.id, path },
        });
        return;
      }
      const labelName = /^\d+$/.test(name) ? parent : name;
      if (!LABELS[labelName]) return;
      fields.push({
        key: `page:${page.slug || 'home'}:block:${block.id}:${path}`,
        label: `${LABELS[labelName]}${indexLabel(path)}`,
        type: MULTILINE_KEYS.has(labelName) ? 'textarea' : 'text',
        value,
        required: true,
        maxLength: textLimit(labelName),
        target: { page: page.slug, block: block.id, path },
      });
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}.${index}`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [name, child] of Object.entries(value)) {
      if (['presentation', 'textStyles'].includes(name)) continue;
      walk(child, path ? `${path}.${name}` : name);
    }
  };
  walk(block.props ?? {});
  return fields;
}

export function premiumEditorContract(snapshot) {
  const pages = snapshot.pages
    .map((page) => ({
      slug: page.slug,
      label: page.title || (page.slug ? `/${page.slug}` : 'Início'),
      sections: page.blocks
        .map((block, index) => ({
          id: block.id,
          label:
            (typeof block.props?.headline === 'string' &&
              block.props.headline) ||
            (typeof block.props?.title === 'string' && block.props.title) ||
            `${block.type} ${index + 1}`,
          fields: fieldsForBlock(page, block),
        }))
        .filter((section) => section.fields.length),
    }))
    .filter((page) => page.sections.length);
  const contract = { version: 1, pages };
  assertEditorContract(contract);
  return contract;
}

export { assertEditorContract };
