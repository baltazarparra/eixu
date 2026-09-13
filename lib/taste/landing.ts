import { contentBlocks, type SitePage } from './metrics';
import type { SiteFinding } from './site';
import {
  confirmedEvidence,
  phraseSupported,
  sameEvidence,
} from '@/lib/ai/evidence';
import type { BlockInstance, TenantImage } from '@/lib/types';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const anchorText = (value: unknown) =>
  typeof value === 'string' ? value : 'contato';
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];
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

  // O operador confirma um fato no cadastro (intake) ou pelo chat, que grava em
  // brief.evidence. As duas origens valem; do contrário a prova fica travada
  // até uma nova geração.
  const evidence = confirmedEvidence(brief);
  const claims = landingClaims(home, images);
  const failing = (block: BlockInstance, rule: LandingClaim['rule']) =>
    claims.filter(
      (claim) =>
        claim.rule === rule &&
        claim.block.id === block.id &&
        !claimSupported(claim, evidence),
    );
  const proofs = content.filter((b) => PROOF_TYPES.includes(b.type));
  if (!proofs.length)
    add(
      'landing-prova',
      'O site não tem uma seção de prova confirmada. Use apenas fatos disponíveis do cliente; sem evidência, mantenha a oferta sem inventar números, marcas ou depoimentos.',
    );
  for (const block of proofs) {
    const own = claims.filter(
      (claim) => claim.rule === 'landing-prova' && claim.block.id === block.id,
    );
    if (!own.length || own.some((claim) => !claimSupported(claim, evidence)))
      add(
        'landing-prova',
        'Há alegações que não correspondem às evidências do cliente. O reparo pode ajustar ou retirar a prova sem confirmação. Fotos de depoimentos precisam ser enviadas pelo cliente.',
        'error',
        block,
      );
  }
  if (hero)
    for (const _claim of failing(hero, 'landing-prova'))
      add(
        'landing-prova',
        'O selo da abertura não corresponde às evidências cadastradas. O reparo pode ajustar ou retirar o selo.',
        'error',
        hero,
      );
  for (const block of content.filter((b) => b.type === 'pricing.table'))
    if (failing(block, 'landing-preco').length)
      add(
        'landing-preco',
        'Nome e preço de cada plano precisam corresponder às informações confirmadas do cliente.',
        'error',
        block,
      );
  return findings;
}

const PROOF_TYPES = [
  'proof.strip',
  'proof.testimonials',
  'proof.stats',
  'proof.logos',
  'proof.testimonial',
];

/** Uma alegação exibida na página e a evidência que ela diz copiar. */
export type LandingClaim = {
  rule: 'landing-prova' | 'landing-preco';
  block: BlockInstance;
  /** Caminho do item no bloco: badges.0, items.2, plans.1, logos.0. */
  path: string;
  /** Textos exibidos que precisam aparecer na evidência. */
  parts: string[];
  /** Valor atual do campo evidence, quando o item tem um. */
  ref?: unknown;
  /** Caminho gravável desse campo, para uma correção por edit_page. */
  refPath?: string;
  /** O schema exige a referência; sem ela a alegação não passa. */
  refRequired: boolean;
  /** Depoimento com foto que não é upload real do cliente. */
  photoInvalid?: boolean;
};

const texts = (values: unknown[]): string[] =>
  values.filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );

/** Todas as alegações da home, na ordem da página. A regra e o plano de
 * pendências leem a mesma lista: o que bloqueia e o que corrige não divergem. */
export function landingClaims(
  home: SitePage,
  images: TenantImage[],
): LandingClaim[] {
  const claims: LandingClaim[] = [];
  const content = contentBlocks(home.blocks);
  const hero = content.find((block) => block.type === 'hero.landing');
  if (hero)
    list(hero.props.badges).forEach((badge, index) =>
      claims.push({
        rule: 'landing-prova',
        block: hero,
        path: `badges.${index}`,
        parts: texts([badge.label]),
        ref: badge.evidence,
        refPath: `badges.${index}.evidence`,
        refRequired: false,
      }),
    );
  for (const block of content) {
    const props = block.props;
    if (block.type === 'proof.logos')
      (Array.isArray(props.logos) ? props.logos : []).forEach((logo, index) =>
        claims.push({
          rule: 'landing-prova',
          block,
          path: `logos.${index}`,
          parts: texts([logo]),
          refRequired: false,
        }),
      );
    else if (block.type === 'proof.testimonial')
      claims.push({
        rule: 'landing-prova',
        block,
        path: '',
        parts: texts([props.quote, props.author, props.role]),
        refRequired: false,
      });
    else if (block.type === 'proof.testimonials')
      list(props.items).forEach((item, index) =>
        claims.push({
          rule: 'landing-prova',
          block,
          path: `items.${index}`,
          parts: texts([item.quote, item.author, item.role, item.result]),
          ref: item.evidence,
          refPath: `items.${index}.evidence`,
          refRequired: true,
          photoInvalid:
            Boolean(item.image) &&
            !images.some(
              (image) =>
                image.url === item.image &&
                image.kind === 'foto' &&
                image.model === 'upload' &&
                !image.blobPath.includes('/gerado/'),
            ),
        }),
      );
    else if (block.type === 'proof.strip' || block.type === 'proof.stats')
      list(props.items).forEach((item, index) =>
        claims.push({
          rule: 'landing-prova',
          block,
          path: `items.${index}`,
          parts: texts([item.value, item.label]),
          ref: item.evidence,
          refPath: `items.${index}.evidence`,
          refRequired: block.type === 'proof.strip',
        }),
      );
    else if (block.type === 'pricing.table')
      list(props.plans).forEach((plan, index) =>
        claims.push({
          rule: 'landing-preco',
          block,
          path: `plans.${index}`,
          parts: texts([plan.name, plan.price]),
          refRequired: false,
        }),
      );
  }
  return claims;
}

/** A evidência sustenta a alegação: a referência é a mesma frase confirmada e
 * cada texto exibido aparece inteiro dentro dela. */
export function claimSupported(
  claim: LandingClaim,
  evidence: string[],
): boolean {
  if (claim.photoInvalid) return false;
  if (claim.refRequired && typeof claim.ref !== 'string') return false;
  const candidates =
    claim.ref === undefined
      ? evidence
      : typeof claim.ref === 'string'
        ? evidence.filter((entry) => sameEvidence(entry, claim.ref as string))
        : [];
  return (
    claim.parts.length > 0 &&
    candidates.some((source) =>
      claim.parts.every((part) => phraseSupported(source, part)),
    )
  );
}
