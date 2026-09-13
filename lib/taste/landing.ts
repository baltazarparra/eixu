import { contentBlocks, type SitePage } from './metrics';
import type { SiteFinding } from './site';
import type { BlockInstance, TenantImage } from '@/lib/types';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const anchorText = (value: unknown) =>
  typeof value === 'string' ? value : 'contato';
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];
const words = (value: unknown) =>
  typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
    : '';

/** Mesmo destino com /#contato ou #contato; atribuição não cria outra ação de WhatsApp. */
export function landingDestination(href: unknown): string | null {
  if (typeof href !== 'string' || !href.trim()) return null;
  try {
    const url = new URL(href, 'https://site.local/');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.origin === 'https://site.local') {
      if (url.pathname === '/go/wa') url.searchParams.delete('from');
      url.searchParams.sort();
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function landingForms(block: BlockInstance): Record<string, unknown>[] {
  if (block.type === 'form.lead') return [block.props];
  if (block.type === 'hero.landing' && block.props.layout === 'form')
    return [record(block.props.form)];
  return [];
}

export function landingFindings(
  pages: SitePage[],
  brief: Record<string, unknown>,
  images: TenantImage[],
): SiteFinding[] {
  const findings: SiteFinding[] = [];
  const add = (
    rule: string,
    message: string,
    level: 'error' | 'warn' = 'error',
    block?: BlockInstance,
  ) =>
    findings.push({
      page: '/',
      rule,
      message,
      level,
      ...(block ? { blockId: block.id } : {}),
    });
  const home = pages.find((page) => page.slug === '' && page.type === 'page');
  for (const page of pages) {
    if ((page.type === 'page' && page.slug !== '') || page.type === 'paid_lp')
      add(
        'landing-pagina-extra',
        `Landing Page não aceita a página /${page.slug}. Preserve o conteúdo e peça ao operador a remoção ou a mudança da forma do site.`,
      );
  }
  if (pages.filter((page) => page.type === 'thank_you').length !== 1)
    add(
      'landing-obrigado',
      'Landing Page exige uma página de obrigado (thank_you).',
    );
  if (!home) return findings;
  const content = contentBlocks(home.blocks);
  if (content.length < 6 || content.length > 11)
    add(
      'landing-secoes',
      `A home precisa de 6 a 11 seções de conteúdo; recebeu ${content.length}.`,
    );
  if (
    record(home.meta.inbound).stage !== 'conversion' ||
    !content.some((b) =>
      ['narrative.statement', 'feature.bento'].includes(b.type),
    ) ||
    !content.some((b) => ['faq.accordion', 'narrative.steps'].includes(b.type))
  )
    add(
      'inbound-jornada',
      'A home precisa de stage conversion, descoberta em statement/bento e consideração em FAQ/passos.',
    );

  const hero = content.find((b) => b.type === 'hero.landing');
  const primary = landingDestination(record(hero?.props.cta).href);
  const formAnchors = home.blocks.flatMap((block) =>
    block.type === 'form.lead'
      ? [anchorText(block.props.anchor)]
      : block.type === 'hero.landing' && block.props.layout === 'form'
        ? [anchorText(block.props.formAnchor)]
        : [],
  );
  if (
    !primary ||
    !(
      primary.startsWith('http') ||
      /^\/go\/wa(?:[?#]|$)/.test(primary) ||
      formAnchors.some((anchor) => primary === `/#${anchor}`)
    )
  )
    add(
      'landing-acao-unica',
      'A ação do hero deve apontar ao formulário desta home ou a um destino externo válido.',
      'error',
      hero,
    );
  const primaryBlocks = new Set<string>();
  const check = (href: unknown, block: BlockInstance) => {
    if (!primary || landingDestination(href) !== primary)
      add(
        'landing-acao-unica',
        'Todos os botões primários devem levar ao mesmo destino do hero.',
        'error',
        block,
      );
    else if (!block.type.startsWith('nav.')) primaryBlocks.add(block.id);
  };
  for (const block of home.blocks) {
    if (['hero.landing', 'cta.band', 'nav.bar'].includes(block.type)) {
      if (block.props.cta) check(record(block.props.cta).href, block);
      if (block.type === 'cta.band' && block.props.whatsapp === true)
        add(
          'landing-acao-unica',
          'Na landing, use o href explícito do hero também na faixa, sem o atalho whatsapp.',
          'error',
          block,
        );
    }
    for (const item of [...list(block.props.items), ...list(block.props.plans)])
      if (item.cta) check(record(item.cta).href, block);
    if (block.type === 'nav.bar') {
      for (const link of list(block.props.links)) {
        const href = landingDestination(link.href);
        if (href !== primary && !href?.startsWith('/#'))
          add(
            'landing-menu-ancoras',
            'O menu só aceita âncoras da home ou a ação principal.',
            'error',
            block,
          );
      }
    }
    for (const form of landingForms(block)) {
      const count = Array.isArray(form.fields) ? form.fields.length : 0;
      if (count < 2 || count > 4)
        add(
          'landing-formulario-curto',
          `Use 2 a 4 campos; este formulário tem ${count}.`,
          count > 6 || count < 2 ? 'error' : 'warn',
          block,
        );
      const target = landingDestination(form.redirectTo ?? '/obrigado');
      if (
        !target ||
        !pages.some((p) => p.type === 'thank_you' && target === `/${p.slug}`)
      )
        add(
          'landing-obrigado',
          'O redirectTo do formulário precisa apontar à página thank_you do projeto.',
          'error',
          block,
        );
      const anchor =
        block.type === 'form.lead'
          ? anchorText(block.props.anchor)
          : anchorText(block.props.formAnchor);
      if (primary === `/#${anchor}`) primaryBlocks.add(block.id);
      else
        add(
          'landing-acao-unica',
          'O formulário deve ser o destino primário da página.',
          'error',
          block,
        );
    }
  }
  const middle = content.slice(1, -1).some((b) => primaryBlocks.has(b.id));
  if (
    primaryBlocks.size < 3 ||
    !hero ||
    !primaryBlocks.has(hero.id) ||
    !middle ||
    !primaryBlocks.has(content.at(-1)?.id ?? '')
  )
    add(
      'landing-acao-repetida',
      'Repita a ação na abertura, em uma seção do meio e no fechamento.',
      'warn',
    );

  const evidence = (Array.isArray(brief.evidence) ? brief.evidence : []).filter(
    (v): v is string => typeof v === 'string',
  );
  const supports = (parts: unknown[], ref?: unknown) => {
    const candidates =
      ref === undefined ? evidence : evidence.filter((e) => e === ref);
    const claims = parts.map(words).filter(Boolean);
    return (
      claims.length > 0 &&
      candidates.some((source) =>
        claims.every((part) => {
          const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(
            `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
            'u',
          ).test(words(source));
        }),
      )
    );
  };
  const proofs = content.filter((b) =>
    [
      'proof.strip',
      'proof.testimonials',
      'proof.stats',
      'proof.logos',
      'proof.testimonial',
    ].includes(b.type),
  );
  if (!proofs.length)
    add(
      'landing-prova',
      'Falta prova confirmada em brief.evidence. Registre a lacuna; nunca invente número, marca ou depoimento.',
    );
  for (const block of proofs) {
    const p = block.props;
    let valid = true;
    if (block.type === 'proof.logos')
      valid =
        Array.isArray(p.logos) &&
        p.logos.length > 0 &&
        p.logos.every((logo) => supports([logo]));
    else if (block.type === 'proof.testimonial')
      valid = supports([p.quote, p.author, p.role]);
    else {
      const items = list(p.items);
      valid =
        items.length > 0 &&
        items.every((item) => {
          if (block.type === 'proof.testimonials') {
            if (
              item.image &&
              !images.some(
                (image) =>
                  image.url === item.image &&
                  image.kind === 'foto' &&
                  image.model === 'upload' &&
                  !image.blobPath.includes('/gerado/'),
              )
            )
              return false;
            return (
              typeof item.evidence === 'string' &&
              supports(
                [item.quote, item.author, item.role, item.result],
                item.evidence,
              )
            );
          }
          return (
            (block.type !== 'proof.strip' ||
              typeof item.evidence === 'string') &&
            supports([item.value, item.label], item.evidence)
          );
        });
    }
    if (!valid)
      add(
        'landing-prova',
        'Cada fato, nome e citação precisa estar na evidência do briefing. Use a redação confirmada; fotos de depoimentos precisam ser reais e enviadas.',
        'error',
        block,
      );
  }
  for (const badge of list(hero?.props.badges))
    if (!supports([badge.label], badge.evidence))
      add(
        'landing-prova',
        'O selo do hero não está sustentado pela evidência informada.',
        'error',
        hero,
      );
  for (const block of content.filter((b) => b.type === 'pricing.table'))
    if (
      !list(block.props.plans).every((plan) =>
        supports([plan.name, plan.price]),
      )
    )
      add(
        'landing-preco',
        'Nome e preço de cada plano devem constar juntos em brief.evidence.',
        'error',
        block,
      );
  return findings;
}
