import type { BlockInstance, Page } from '../types';
import type { DesignProfile } from '../design/profile';
import { lintCopy } from '../copy/lint';
import {
  blockMeta,
  blockSchemas,
  familyOf,
  isBlockType,
} from '../blocks/registry';

export type Finding = {
  level: 'error' | 'warn';
  rule: string;
  message: string;
  blockId?: string;
};

/**
 * Termos que denunciam texto gerado sem contexto real. Vindos da seção 9
 * do Taste Skill, adaptados ao português.
 */
const FILLER = [
  'eleve',
  'eleve o seu',
  'transforme sua jornada',
  'solução completa',
  'soluções inovadoras',
  'excelência',
  'sinergia',
  'disruptivo',
  'inovador e moderno',
  'unleash',
  'seamless',
  'elevate',
  'empower',
  'revolucione',
  'a melhor experiência do mercado',
];

const PLACEHOLDERS = [
  'acme',
  'lorem ipsum',
  'john doe',
  'fulano de tal',
  'sua empresa aqui',
  'nome da empresa',
  'exemplo.com',
  '99,99%',
  '99.99%',
  'seu texto aqui',
];

/** Lê uma prop como string, ignorando valores de outro tipo. */
function propText(props: Record<string, unknown>, key: string): string {
  const value = props[key];
  return typeof value === 'string' ? value : '';
}

/** Percorre todas as strings das props de um bloco. */
function strings(block: BlockInstance): string[] {
  const out: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object')
      Object.values(value).forEach(walk);
  };
  walk(block.props);
  return out;
}

/** Estimativa de linhas do headline no desktop, ~28 caracteres por linha. */
export function headlineLines(text: string): number {
  return Math.ceil(text.length / 28);
}

export function lintPage(
  page: Pick<Page, 'blocks' | 'type' | 'title' | 'seo'> &
    Partial<Pick<Page, 'meta'>>,
  design?: DesignProfile,
): Finding[] {
  const findings: Finding[] = lintCopy(page);
  const blocks = page.blocks ?? [];
  const push = (
    level: Finding['level'],
    rule: string,
    message: string,
    blockId?: string,
  ) => findings.push({ level, rule, message, blockId });
  const contentIcons = new Map<string, string[]>();

  // 1. Tipos válidos e props conformes ao schema.
  for (const block of blocks) {
    if (!isBlockType(block.type)) {
      push(
        'error',
        'bloco-desconhecido',
        `Bloco "${block.type}" não existe na biblioteca.`,
        block.id,
      );
      continue;
    }
    // Estrito: prop que o bloco não conhece é erro, senão o agente acha que aplicou algo que sumiu.
    const parsed = blockSchemas[block.type].strict().safeParse(block.props);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      push(
        'error',
        'props-invalidas',
        `${block.type}: ${issue.path.join('.') || 'props'} ${issue.message}`,
        block.id,
      );
    } else if ('items' in parsed.data && Array.isArray(parsed.data.items)) {
      for (const item of parsed.data.items) {
        if (!('icon' in item) || typeof item.icon !== 'string') continue;
        // Fotos ocupam o lugar do símbolo nestes dois componentes.
        if (
          ['feature.bento', 'editorial.resources'].includes(block.type) &&
          'image' in item &&
          item.image
        )
          continue;
        const occurrences = contentIcons.get(item.icon) ?? [];
        occurrences.push(block.id);
        contentIcons.set(item.icon, occurrences);
      }
    }
  }

  for (const [name, occurrences] of contentIcons) {
    if (occurrences.length < 2) continue;
    push(
      'warn',
      'icones-repetidos',
      `O símbolo "${name}" aparece em ${occurrences.length} itens da página. Remova os ícones dispensáveis; escolha outro só quando representar melhor o assunto. Ícones de ações e controles não entram nesta contagem.`,
      occurrences[1],
    );
  }

  // Âncoras precisam de um destino único, inclusive o formulário legado.
  const anchors = new Set<string>();
  for (const block of blocks.flatMap((block) =>
    block.type === 'hero.landing' && block.props.layout === 'form'
      ? [
          block,
          {
            ...block,
            props: {
              ...block.props,
              anchor: block.props.formAnchor ?? 'contato',
            },
          },
        ]
      : [block],
  )) {
    const anchor =
      propText(block.props, 'anchor') ||
      (block.type === 'form.lead' ? 'contato' : '');
    if (!anchor) continue;
    // A seção de localização sai do cadastro e já ocupa esta âncora.
    if (anchor === 'onde-estamos') {
      push(
        'error',
        'anchor-reservada',
        'A âncora "onde-estamos" pertence à seção de localização montada a partir do cadastro. Escolha outro nome.',
        block.id,
      );
    }
    if (anchors.has(anchor))
      push(
        'error',
        'anchor-duplicada',
        `Âncora "${anchor}" repetida.`,
        block.id,
      );
    anchors.add(anchor);
  }

  const known = blocks.filter((b) => isBlockType(b.type));

  // 2. Singletons: nav, hero, rodapé e corpo de post aparecem no máximo uma vez.
  const counts = new Map<string, number>();
  for (const block of known)
    counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
  for (const [type, count] of counts) {
    if (count > 1 && blockMeta[type as keyof typeof blockMeta].singleton) {
      push(
        'error',
        'singleton',
        `"${type}" aparece ${count} vezes. Deve aparecer uma só vez.`,
      );
    }
  }

  const heroes = known.filter((b) => familyOf(b.type) === 'hero');
  if (heroes.length > 1)
    push('error', 'hero-unico', 'Mais de um hero na mesma página.');

  // 3. Diversidade de layout: 8+ seções exigem 4+ famílias.
  const content = known.filter(
    (b) => !['nav', 'footer'].includes(familyOf(b.type) ?? ''),
  );
  const families = new Set(content.map((b) => familyOf(b.type)));
  if (content.length >= 8 && families.size < 4) {
    push(
      'error',
      'familias-de-layout',
      `Página com ${content.length} seções usa só ${families.size} famílias de layout. O mínimo é 4.`,
    );
  }

  // 3b. O perfil versionado só é rico quando chega aos blocos. Sem escolhas locais,
  // a página volta a ser a mesma sequência genérica pintada com outra paleta.
  if (
    design &&
    [2, 3, 4, 5, 6].includes(design.version) &&
    page.type !== 'thank_you' &&
    page.type !== 'post'
  ) {
    const layoutDecisions = content.filter(
      (block) => typeof block.props.layout === 'string',
    ).length;
    const presentationDecisions = content.filter(
      (block) =>
        block.props.presentation &&
        typeof block.props.presentation === 'object' &&
        Object.keys(block.props.presentation).some((key) => key !== 'motion'),
    ).length;
    // O teto antigo (3 e 2) deixava uma página de 8 seções passar com cinco
    // blocos no default. A exigência acompanha o tamanho da página.
    const requiredLayouts = Math.min(5, Math.ceil(content.length * 0.5));
    const requiredPresentations = Math.min(4, Math.ceil(content.length * 0.4));
    if (layoutDecisions < requiredLayouts) {
      push(
        'error',
        'composicao-generica',
        `Direção v${design.version} exige decisões de layout em pelo menos ${requiredLayouts} seções; há ${layoutDecisions}.`,
      );
    }
    if (presentationDecisions < requiredPresentations) {
      push(
        'error',
        'ritmo-generico',
        `Direção v${design.version} exige apresentação intencional em pelo menos ${requiredPresentations} seções; há ${presentationDecisions}.`,
      );
    }
  }

  // 4. Orçamento de eyebrow: no máximo 1 a cada 3 seções.
  const eyebrows = content.filter(
    (b) => typeof b.props.eyebrow === 'string' && b.props.eyebrow.trim(),
  );
  const allowed = Math.max(1, Math.floor(content.length / 3));
  if (eyebrows.length > allowed) {
    push(
      'warn',
      'eyebrow-budget',
      `${eyebrows.length} eyebrows para ${content.length} seções. O limite é ${allowed}.`,
    );
  }

  // 5. Disciplina do hero.
  for (const hero of heroes) {
    const headline = propText(hero.props, 'headline');
    if (
      hero.type === 'hero.landing'
        ? headline.length > 60
        : headlineLines(headline) > 2
    ) {
      push(
        'error',
        'hero-headline',
        hero.type === 'hero.landing'
          ? 'Headline da landing deve ter até 60 caracteres.'
          : `Headline ocupa cerca de ${headlineLines(headline)} linhas. O limite é 2.`,
        hero.id,
      );
    }
    const subtext = propText(hero.props, 'subtext');
    const words = subtext.trim() ? subtext.trim().split(/\s+/).length : 0;
    if (words > 20) {
      push(
        'error',
        'hero-subtexto',
        `Subtexto do hero tem ${words} palavras. O limite é 20.`,
        hero.id,
      );
    }
  }

  // 6. Sinais de texto gerado sem contexto.
  for (const block of known) {
    for (const text of strings(block)) {
      const lower = text.toLowerCase();
      if (text.includes('—')) {
        push(
          'error',
          'travessao',
          'Travessão é proibido no copy. Use ponto ou vírgula.',
          block.id,
        );
      }
      const filler = FILLER.find((term) => lower.includes(term));
      if (filler)
        push(
          'error',
          'copy-generico',
          `Expressão genérica: "${filler}".`,
          block.id,
        );
      const placeholder = PLACEHOLDERS.find((term) => lower.includes(term));
      if (placeholder)
        push(
          'error',
          'placeholder',
          `Texto de exemplo não substituído: "${placeholder}".`,
          block.id,
        );
    }
  }

  // 7. Estrutura mínima da página.
  if (page.type !== 'thank_you') {
    if (!known.some((b) => familyOf(b.type) === 'nav'))
      push('warn', 'sem-nav', 'Página sem barra de navegação.');
    if (!known.some((b) => familyOf(b.type) === 'footer'))
      push('warn', 'sem-rodape', 'Página sem rodapé.');
  }
  if (
    page.type !== 'post' &&
    page.type !== 'thank_you' &&
    heroes.length === 0
  ) {
    push(
      'warn',
      'sem-hero',
      'Página sem hero. Toda página de entrada precisa de uma abertura.',
    );
  }

  // 8. Conversão: toda página precisa de um caminho de ação.
  const hasAction = known.some((b) =>
    ['cta', 'form'].includes(familyOf(b.type) ?? ''),
  );
  if (!hasAction && page.type !== 'thank_you' && page.type !== 'post') {
    push(
      'error',
      'sem-conversao',
      'Nenhum CTA ou formulário. A página não tem para onde levar o visitante.',
    );
  }

  // 9. SEO.
  const seoTitle = page.seo?.title || page.title;
  if (!seoTitle) push('error', 'seo-titulo', 'Página sem título.');
  else if (seoTitle.length > 60)
    push(
      'warn',
      'seo-titulo',
      `Título com ${seoTitle.length} caracteres. O ideal é até 60.`,
    );
  const description = page.seo?.description ?? '';
  if (!description)
    push('warn', 'seo-descricao', 'Página sem meta description.');
  else if (description.length > 160) {
    push(
      'warn',
      'seo-descricao',
      `Meta description com ${description.length} caracteres. O limite é 160.`,
    );
  }

  // 10. Página paga precisa de destino de conversão e não pode ser indexada.
  if (page.type === 'paid_lp' && !page.seo?.noindex) {
    push(
      'warn',
      'lp-indexavel',
      'Landing page paga sem noindex. Ela pode competir com as páginas orgânicas.',
    );
  }

  return findings;
}

export function hasBlockingErrors(findings: Finding[]): boolean {
  return findings.some((f) => f.level === 'error');
}

export function formatFindings(findings: Finding[]): string {
  if (!findings.length) return 'Pre-flight aprovado, sem apontamentos.';
  return findings
    .map(
      (f) =>
        `${f.level === 'error' ? 'ERRO' : 'aviso'} [${f.rule}] ${f.message}`,
    )
    .join('\n');
}
