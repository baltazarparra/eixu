import type { Page } from '@/lib/types';
import type { Finding } from '@/lib/taste/lint';

/** Campos de leitura, inclusive listas. Chaves, URLs e enums não são copy. */
const TEXT_FIELDS = new Set([
  'title',
  'headline',
  'subtext',
  'eyebrow',
  'lead',
  'body',
  'label',
  'submitLabel',
  'consentText',
  'tagline',
  'legal',
  'quote',
  'role',
  'q',
  'a',
  'alt',
  'imageAlt',
  'secondaryImageAlt',
  'caption',
  'imageCaption',
  'secondaryCaption',
  'category',
  'note',
  'features',
  'bullets',
  'facts',
  'value',
  'options',
  'name',
  'price',
]);

type CopyField = {
  path: string;
  text: string;
  blockId?: string;
  action?: boolean;
};
type CopyPage = Pick<Page, 'blocks' | 'title' | 'seo'> &
  Partial<Pick<Page, 'meta'>>;

export function pageCopy(page: CopyPage): CopyField[] {
  const fields: CopyField[] = [];
  for (const [path, text] of [
    ['title', page.title],
    ['seo.title', page.seo?.title],
    ['seo.description', page.seo?.description],
    ['meta.excerpt', page.meta?.excerpt],
  ])
    if (typeof text === 'string') fields.push({ path: path as string, text });

  for (const block of page.blocks ?? []) {
    const walk = (
      value: unknown,
      path: string,
      key: string,
      action = false,
    ) => {
      if (typeof value === 'string' && TEXT_FIELDS.has(key)) {
        // name identifica o campo enviado; o nome de um plano é texto visível.
        if (key === 'name' && path.startsWith('props.fields[')) return;
        fields.push({
          path,
          text: value,
          blockId: block.id,
          action: key === 'submitLabel' || action,
        });
      } else if (Array.isArray(value)) {
        value.forEach((child, index) => walk(child, `${path}[${index}]`, key));
      } else if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value))
          walk(
            child,
            `${path}.${childKey}`,
            childKey,
            childKey === 'label' &&
              'href' in value &&
              typeof value.href === 'string',
          );
      }
    };
    walk(block.props, 'props', '');
  }
  return fields;
}

/** Lista de sinais, não detector de idioma. O crítico decide pelo contexto. */
const VOCABULARY: [string, string][] = [
  ['download', 'baixar arquivo'],
  ['upload', 'enviar arquivo'],
  ['feedback', 'opinião ou resposta'],
  ['deadline', 'prazo'],
  ['budget', 'valor disponível'],
  ['dashboard', 'painel'],
  ['onboarding', 'primeiros passos'],
  ['workflow', 'etapas do trabalho'],
  ['follow-up', 'retomar a conversa'],
  ['landing page', 'página de apresentação'],
  ['call to action', 'botão ou convite para uma ação'],
  ['lead', 'pessoa interessada'],
  ['leads', 'pessoas interessadas'],
  ['insight', 'ideia ou descoberta'],
  ['insights', 'ideias ou descobertas'],
  ['expertise', 'experiência'],
  ['know-how', 'conhecimento'],
  ['performance', 'resultado ou desempenho'],
  ['briefing', 'informações do negócio'],
  ['disruptivo', 'explique a mudança concreta'],
  ['sinergia', 'trabalho em conjunto'],
  ['outrossim', 'também'],
  ['supracitado', 'citado acima'],
  ['operacionalização', 'funcionamento'],
  ['CRM', 'sistema para organizar clientes'],
  ['SaaS', 'sistema usado pela internet'],
  ['API', 'ligação entre sistemas'],
  ['SLA', 'prazo combinado de atendimento'],
];

const UNCLEAR_ACTIONS = new Set([
  'clique aqui',
  'click here',
  'saiba mais',
  'learn more',
  'read more',
  'get started',
  'start now',
  'submit',
  'contact us',
  'talk to sales',
  'vamos la',
  'descubra',
]);

function normalized(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** URLs não influenciam a leitura; rótulos de links Markdown continuam sendo lidos. */
function readable(text: string): string {
  return text.replace(
    /https?:\/\/\S+|\bwww\.\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
    ' ',
  );
}

export function lintCopy(page: CopyPage): Finding[] {
  const findings: Finding[] = [];
  for (const field of pageCopy(page)) {
    const text = readable(field.text);
    const lower = normalized(text);
    const add = (level: Finding['level'], rule: string, message: string) =>
      findings.push({
        level,
        rule,
        blockId: field.blockId,
        message: `${field.path}: ${message}`,
      });
    if (
      field.action &&
      UNCLEAR_ACTIONS.has(
        lower
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .replace(/\s+/g, ' ')
          .trim(),
      )
    )
      add(
        'error',
        'acao-pouco-clara',
        `O rótulo "${field.text}" não explica a ação em português simples. Diga a ação ou o destino, como "Ver serviços" ou "Enviar mensagem", conforme o link real.`,
      );

    const terms = VOCABULARY.filter(([term]) =>
      new RegExp(
        `(?<![\\p{L}\\p{N}])${normalized(term)}(?![\\p{L}\\p{N}])`,
        'u',
      ).test(lower),
    );
    if (terms.length)
      add(
        'warn',
        'linguagem-vocabulario',
        `Confira palavras pouco familiares: ${terms.map(([term, replacement]) => `"${term}" (${replacement})`).join('; ')}. Troque pelo termo simples ou, se indispensável, explique perto da primeira ocorrência. Preserve nomes oficiais e citações; a revisão deve julgar o contexto.`,
      );

    const longest = Math.max(
      0,
      ...text
        .split(/[.!?\n]+/u)
        .map((sentence) => sentence.match(/[\p{L}\p{N}]+/gu)?.length ?? 0),
    );
    if (longest > 30)
      add(
        'warn',
        'linguagem-frase-longa',
        `Há um trecho com cerca de ${longest} palavras sem pausa. Confira se cabe dividir em frases com uma ideia cada, preservando as informações. A contagem é uma pista, não uma medida de compreensão.`,
      );
  }
  return findings;
}
