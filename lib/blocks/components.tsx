/* HTML servido no servidor; ilhas de Framer Motion cuidam das interações.
 * Âncoras e formulários mantêm navegação nativa. Imagens do pipeline já saem
 * em WebP e carregam dimensões explícitas, sem proxy para hosts arbitrários. */
// oxlint-disable next/no-html-link-for-pages
// oxlint-disable next/no-img-element
import { z } from 'zod';
import { SiteIcon } from '@/lib/blocks/icon';
import { renderingVibeOf, type Vibe } from '@/lib/design/vibes';
import { logoFor } from '@/lib/blocks/theme';
import { MotionLink } from '@/lib/blocks/motion';
import { NavigationFrame } from '@/lib/blocks/navigation-frame';
import { SocialIcon } from '@/lib/blocks/social-icons';
import {
  contactsOf,
  formatPhone,
  phoneE164,
  socialLinks,
} from '@/lib/tenant-contacts';
import { blockSchemas } from '@/lib/blocks/registry';
import type { RenderContext } from '@/lib/blocks/render';
import { previewHref } from '@/lib/sites/preview';

type S<K extends keyof typeof blockSchemas> = z.infer<
  (typeof blockSchemas)[K]
> & { vibe?: Vibe };

export type NavBarProps = S<'nav.bar'>;
export type HeroSplitProps = S<'hero.split'>;
export type HeroStatementProps = S<'hero.statement'>;
export type ProofLogosProps = S<'proof.logos'>;
export type ProofStatsProps = S<'proof.stats'>;
export type ProofTestimonialProps = S<'proof.testimonial'>;
export type FeatureBentoProps = S<'feature.bento'>;
export type FeatureNumberedProps = S<'feature.numbered'>;
export type NarrativeSplitProps = S<'narrative.split'>;
export type EditorialFactsProps = S<'editorial.facts'>;
export type MediaImageProps = S<'media.image'>;
export type NarrativeStepsProps = S<'narrative.steps'>;
export type FaqAccordionProps = S<'faq.accordion'>;
export type CtaBandProps = S<'cta.band'>;
export type FormLeadProps = S<'form.lead'>;
export type EditorialTextProps = S<'editorial.text'>;
export type EditorialPostListProps = S<'editorial.postList'>;
export type EditorialPostBodyProps = S<'editorial.postBody'>;
export type MediaGalleryProps = S<'media.gallery'>;
export type MediaMapProps = S<'media.map'>;
export type PricingTableProps = S<'pricing.table'>;
export type FooterCompactProps = S<'footer.compact'>;
export type EditorialResourcesProps = S<'editorial.resources'>;
export type SignatureCompositionProps = S<'signature.composition'>;

const shell =
  'site-shell mx-auto w-full max-w-[var(--site-max,76rem)] px-6 md:px-10';

/** Mapa estático: Tailwind não gera classes montadas em tempo de execução. */
const statCols: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};
const section = 'site-section';
const eyebrowClass =
  'site-eyebrow text-[0.85rem] font-medium text-[var(--muted)]';
const h2Class =
  'site-h2 text-balance text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em]';

function Eyebrow({ children }: { children?: string }) {
  if (!children) return null;
  return <p className={eyebrowClass}>{children}</p>;
}

/** Link de ação. Rota do WhatsApp passa pelo redirecionador rastreado. */
function Action({
  href,
  label,
  variant = 'solid',
  vibe,
}: {
  href: string;
  label: string;
  variant?: 'solid' | 'ghost';
  vibe?: Vibe;
}) {
  const base =
    'site-action inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-6 py-3 text-[0.95rem] font-medium transition-colors';
  const styles =
    variant === 'solid'
      ? 'bg-[var(--highlight)] text-[var(--highlight-ink)] hover:opacity-90'
      : 'border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]';
  const external = href.startsWith('http') || href.startsWith('/go/');
  return (
    <MotionLink
      href={href}
      className={`${base} ${styles}`}
      data-variant={variant}
      {...(external ? { rel: 'noreferrer' } : {})}
      data-track={href.startsWith('/go/wa') ? 'whatsapp' : undefined}
    >
      {label}
      <SiteIcon name="arrow-up-right" vibe={vibe} size={18} />
    </MotionLink>
  );
}

/**
 * Escala do headline pelo comprimento. A display serifada da vibe artística
 * cresce até 8vw e uma frase de 48 caracteres virava uma palavra por linha.
 * O CSS lê `data-length` e reduz a escala para o título caber em três linhas.
 */
export function headlineScale(text: string): 'short' | 'medium' | 'long' {
  const length = text.trim().length;
  return length <= 24 ? 'short' : length <= 40 ? 'medium' : 'long';
}

export function NavBar({
  vibe = 'comercial',
  logoText,
  logoHeight,
  links,
  cta,
  layout,
  position,
  backgroundOpacity,
  presentation,
  ctx,
}: NavBarProps & { ctx: RenderContext }) {
  const resolvedLayout = layout ?? ctx.tenant.brand.design?.navigation ?? 'bar';
  const logo = logoFor(ctx.tenant.brand, presentation, resolvedLayout);
  return (
    <NavigationFrame position={position}>
      <header
        className={`site-nav site-nav-${resolvedLayout} border-b border-[var(--line)]`}
        style={
          backgroundOpacity === undefined
            ? undefined
            : {
                background: `color-mix(in oklab, var(--paper) ${backgroundOpacity}%, transparent)`,
                backdropFilter: 'blur(12px)',
              }
        }
      >
        <div
          className={`${shell} flex min-h-20 flex-wrap items-center justify-between gap-4 py-4`}
        >
          <a
            href="/"
            className="flex max-w-full shrink-0 items-center text-[1.05rem] font-semibold tracking-[-0.01em]"
            aria-label={`${logoText}, início`}
          >
            {logo ? (
              <img
                src={logo}
                alt={logoText}
                width={logoHeight === undefined ? 160 : undefined}
                height={logoHeight ?? 40}
                style={
                  logoHeight === undefined ? undefined : { height: logoHeight }
                }
                className={
                  logoHeight === undefined
                    ? 'h-12 w-auto max-w-[140px] object-contain'
                    : 'w-auto max-w-full object-contain object-left'
                }
                decoding="async"
              />
            ) : (
              logoText
            )}
          </a>
          <nav
            className="hidden items-center gap-6 lg:flex"
            aria-label="Navegação principal"
          >
            {links.map((link) => (
              <a
                key={link.href + link.label}
                href={link.href}
                aria-current={link.href === ctx.pagePath ? 'page' : undefined}
                className="site-nav-link text-[0.92rem] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          {cta ? (
            <a
              href={cta.href}
              className="site-nav-cta rounded-[var(--radius)] bg-[var(--highlight)] px-5 py-2.5 text-[0.9rem] font-medium text-[var(--highlight-ink)]"
              data-track={
                cta.href.startsWith('/go/wa') ? 'whatsapp' : undefined
              }
            >
              {cta.label}
              <SiteIcon name="arrow-up-right" vibe={vibe} size={18} />
            </a>
          ) : null}
          {links.length ? (
            <details className="site-mobile-nav w-full lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-medium">
                Menu
                <SiteIcon name="plus" vibe={vibe} />
              </summary>
              <nav aria-label="Navegação mobile" className="grid gap-1 pb-2">
                {links.map((link) => (
                  <a
                    key={link.href + link.label}
                    href={link.href}
                    className="py-3 text-sm"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </details>
          ) : null}
        </div>
      </header>
    </NavigationFrame>
  );
}

export function HeroSplit({
  vibe = 'comercial',
  eyebrow,
  headline,
  subtext,
  cta,
  secondary,
  bullets,
  image,
  imageAlt,
  layout,
  imagePosition = 'right',
  imageFit = 'cover',
  focalPoint = 'center',
  secondaryImage,
  secondaryImageAlt,
  imageCaption,
  secondaryCaption,
  ctx,
}: HeroSplitProps & { ctx: RenderContext }) {
  const hasImage = Boolean(image && /^https?:\/\//.test(image));
  const resolvedLayout =
    layout ?? ctx.tenant.brand.design?.heroComposition ?? 'split';
  return (
    <section
      className={`site-hero ${hasImage ? `site-hero-${resolvedLayout}` : 'site-hero-text'} site-image-${imagePosition}`}
    >
      <div className={`${shell} site-hero-grid`}>
        <div className="site-hero-copy flex flex-col items-start gap-6">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1
            className="site-headline text-balance"
            data-length={headlineScale(headline)}
          >
            {headline}
          </h1>
          {subtext ? (
            <p className="max-w-[44ch] text-[1.08rem] leading-relaxed text-[var(--muted)]">
              {subtext}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <Action vibe={vibe} href={cta.href} label={cta.label} />
            {secondary ? (
              <Action
                vibe={vibe}
                href={secondary.href}
                label={secondary.label}
                variant="ghost"
              />
            ) : null}
          </div>
          {bullets?.length ? (
            <ul className="site-hero-bullets flex flex-wrap gap-x-6 gap-y-3 pt-4 text-sm text-[var(--muted)]">
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="border-l-2 border-[var(--line)] pl-3"
                >
                  <SiteIcon name="check" vibe={vibe} size={16} />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {hasImage ? (
          <div className="site-hero-visual">
            <figure className="site-hero-media">
              <img
                src={image}
                alt={imageAlt ?? ''}
                width={960}
                height={1080}
                className={`h-full w-full ${imageFit === 'contain' ? 'object-contain' : 'object-cover'}`}
                data-focal={focalPoint}
                fetchPriority="high"
                decoding="async"
              />
              {imageCaption && (
                <figcaption className="site-hero-caption">
                  {imageCaption}
                </figcaption>
              )}
            </figure>
            {secondaryImage && (
              <figure className="site-hero-detail">
                <img
                  src={secondaryImage}
                  alt={secondaryImageAlt ?? ''}
                  width={480}
                  height={600}
                  decoding="async"
                />
                {secondaryCaption && (
                  <figcaption>{secondaryCaption}</figcaption>
                )}
              </figure>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function HeroStatement({
  vibe = 'comercial',
  eyebrow,
  headline,
  subtext,
  cta,
  layout = 'left',
}: HeroStatementProps & { ctx: RenderContext }) {
  return (
    <section className={`site-hero site-hero-text site-statement-${layout}`}>
      <div className={`${shell} site-hero-grid`}>
        <div className="site-hero-copy flex flex-col items-start gap-7">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1
            className="site-headline text-balance"
            data-length={headlineScale(headline)}
          >
            {headline}
          </h1>
          {subtext ? (
            <p className="max-w-[48ch] text-[1.1rem] leading-relaxed text-[var(--muted)]">
              {subtext}
            </p>
          ) : null}
          <Action vibe={vibe} href={cta.href} label={cta.label} />
        </div>
      </div>
    </section>
  );
}

type SignatureItem = SignatureCompositionProps['items'][number];

function SignatureMedia({ item }: { item: SignatureItem }) {
  if (!item.image) return null;
  return (
    <figure className="site-signature-media">
      <img
        src={item.image}
        alt={item.imageAlt ?? ''}
        width={960}
        height={720}
        loading="lazy"
        decoding="async"
      />
      {item.caption ? <figcaption>{item.caption}</figcaption> : null}
    </figure>
  );
}

function SignatureCopy({ item, vibe }: { item: SignatureItem; vibe: Vibe }) {
  return (
    <div className="site-signature-copy">
      {item.label ? <p className="site-signature-label">{item.label}</p> : null}
      {item.icon ? (
        <SiteIcon name={item.icon} vibe={vibe} size={24} badge />
      ) : null}
      <h3>{item.title}</h3>
      <p>{item.body}</p>
      {item.cta ? (
        <Action
          href={item.cta.href}
          label={item.cta.label}
          variant="ghost"
          vibe={vibe}
        />
      ) : null}
    </div>
  );
}

function SignaturePath({
  items,
  vibe,
}: {
  items: SignatureItem[];
  vibe: Vibe;
}) {
  return (
    <ol className="site-signature-path">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} data-role={item.role}>
          <span className="site-signature-step" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <SignatureMedia item={item} />
          <SignatureCopy item={item} vibe={vibe} />
        </li>
      ))}
    </ol>
  );
}

function SignatureLens({
  items,
  vibe,
}: {
  items: SignatureItem[];
  vibe: Vibe;
}) {
  return (
    <div className="site-signature-lens">
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`} data-role={item.role}>
          <SignatureMedia item={item} />
          <SignatureCopy item={item} vibe={vibe} />
        </article>
      ))}
    </div>
  );
}

function SignatureMap({ items, vibe }: { items: SignatureItem[]; vibe: Vibe }) {
  const focus = items.find((item) => item.role === 'focus') ?? items[0];
  const support = items.filter((item) => item !== focus);
  return (
    <div className="site-signature-map">
      <article className="site-signature-map-focus" data-role={focus.role}>
        <SignatureMedia item={focus} />
        <SignatureCopy item={focus} vibe={vibe} />
      </article>
      <ul className="site-signature-map-support">
        {support.map((item, index) => (
          <li key={`${item.title}-${index}`} data-role={item.role}>
            <SignatureMedia item={item} />
            <SignatureCopy item={item} vibe={vibe} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignatureEditorial({
  items,
  vibe,
}: {
  items: SignatureItem[];
  vibe: Vibe;
}) {
  return (
    <div className="site-signature-editorial">
      {items.map((item, index) => (
        <article
          key={`${item.title}-${index}`}
          data-role={item.role}
          data-index={index + 1}
        >
          <SignatureCopy item={item} vibe={vibe} />
          <SignatureMedia item={item} />
        </article>
      ))}
    </div>
  );
}

const PATH_SIGNATURES = new Set([
  'decision-path',
  'campaign-sequence',
  'story-orbit',
]);
const LENS_SIGNATURES = new Set([
  'service-lens',
  'detail-lens',
  'visual-selector',
]);
const MAP_SIGNATURES = new Set(['proof-route', 'system-map', 'material-table']);

/**
 * O layout vem da estrutura v5, mas o conteúdo e a combinação de papéis vêm
 * do briefing. Quatro árvores semânticas cobrem percurso, seleção, mapa e
 * ensaio editorial sem permitir HTML ou código arbitrário gerado por tenant.
 */
export function SignatureComposition({
  vibe = 'comercial',
  eyebrow,
  title,
  body,
  items,
  layout,
}: SignatureCompositionProps) {
  return (
    <section className={`${section} site-signature site-signature-${layout}`}>
      <div className={shell}>
        <header className="site-signature-header">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={h2Class}>{title}</h2>
          <p>{body}</p>
        </header>
        {PATH_SIGNATURES.has(layout) ? (
          <SignaturePath items={items} vibe={vibe} />
        ) : LENS_SIGNATURES.has(layout) ? (
          <SignatureLens items={items} vibe={vibe} />
        ) : MAP_SIGNATURES.has(layout) ? (
          <SignatureMap items={items} vibe={vibe} />
        ) : (
          <SignatureEditorial items={items} vibe={vibe} />
        )}
      </div>
    </section>
  );
}

export function ProofLogos({ title, logos, layout = 'rail' }: ProofLogosProps) {
  return (
    <section
      className={`site-proof-logos site-proof-logos-${layout} border-b border-[var(--line)] py-12`}
    >
      <div className={shell}>
        {title ? <p className={`${eyebrowClass} mb-7`}>{title}</p> : null}
        <ul className="flex flex-wrap items-center gap-x-10 gap-y-5">
          {logos.map((logo) => (
            <li
              key={logo}
              className="text-[1.05rem] font-medium tracking-[-0.01em] text-[var(--muted)]"
            >
              {logo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProofStats({ items, layout = 'strip' }: ProofStatsProps) {
  return (
    <section
      className={`${section} site-stats site-stats-${layout} border-b border-[var(--line)]`}
    >
      <div
        className={`${shell} grid gap-10 sm:grid-cols-2 ${statCols[items.length] ?? 'lg:grid-cols-4'}`}
      >
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-2">
            <p className="text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-none tracking-[-0.03em] text-[var(--highlight-text)]">
              {item.value}
            </p>
            <p className="text-[0.95rem] leading-snug text-[var(--muted)]">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProofTestimonial({
  vibe = 'comercial',
  quote,
  author,
  role,
  layout = 'quote',
}: ProofTestimonialProps) {
  return (
    <section
      className={`${section} site-testimonial site-testimonial-${layout} border-b border-[var(--line)]`}
    >
      <figure className={`${shell} max-w-[54rem]`}>
        <div>
          <SiteIcon
            name="quote"
            vibe={vibe}
            size={32}
            badge
            className="site-icon-feature"
          />
          <blockquote className="text-balance text-[clamp(1.4rem,3vw,2.1rem)] font-medium leading-[1.32] tracking-[-0.015em]">
            {quote}
          </blockquote>
        </div>
        <figcaption className="mt-7 text-[0.95rem] text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{author}</span>
          {role ? `, ${role}` : ''}
        </figcaption>
      </figure>
    </section>
  );
}

export function FeatureBento({
  vibe = 'comercial',
  eyebrow,
  title,
  items,
  layout = 'mosaic',
}: FeatureBentoProps) {
  return (
    <section className={section}>
      <div className={shell}>
        <div className="flex flex-col gap-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={`${h2Class} max-w-[22ch]`}>{title}</h2>
        </div>
        <div className={`site-bento site-bento-${layout} mt-12 grid gap-5`}>
          {items.map((item, index) => (
            <article
              key={item.title}
              className={`site-bento-item ${index === 0 ? 'site-bento-featured' : ''}`}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.imageAlt ?? ''}
                  width={960}
                  height={640}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[3/2] w-full object-cover"
                />
              ) : null}
              <div className="flex flex-col gap-3 p-7 md:p-9">
                <h3 className="site-item-heading text-[1.3rem] font-semibold leading-tight tracking-[-0.02em]">
                  {item.icon && !item.image ? (
                    <SiteIcon name={item.icon} vibe={vibe} />
                  ) : null}
                  <span>{item.title}</span>
                </h3>
                <p className="max-w-[52ch] text-base leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function NarrativeSteps({
  eyebrow,
  title,
  steps,
  layout = 'timeline',
}: NarrativeStepsProps) {
  return (
    <section
      className={`${section} site-steps site-steps-${layout} border-b border-[var(--line)]`}
    >
      <div className={`${shell} grid gap-14 md:grid-cols-12`}>
        <div className="flex flex-col gap-4 md:col-span-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={h2Class}>{title}</h2>
        </div>
        <ol className="flex flex-col md:col-span-8">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex gap-6 border-t border-[var(--line)] py-7 first:border-t-0 first:pt-0"
            >
              <span className="site-step-number shrink-0 whitespace-nowrap pt-1 text-[0.85rem] text-[var(--muted)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-[1.15rem] font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="max-w-[54ch] text-[0.97rem] leading-relaxed text-[var(--muted)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FaqAccordion({
  vibe = 'comercial',
  title,
  items,
  layout = 'split',
}: FaqAccordionProps) {
  return (
    <section
      className={`${section} site-faq site-faq-${layout} border-b border-[var(--line)]`}
    >
      <div className={`${shell} grid gap-12 md:grid-cols-12`}>
        <h2 className={`${h2Class} md:col-span-4`}>{title}</h2>
        <div className="md:col-span-8">
          {items.map((item) => (
            <details
              key={item.q}
              className="group border-t border-[var(--line)] py-5 first:border-t-0 first:pt-0"
            >
              <summary className="site-faq-summary flex cursor-pointer list-none items-center justify-between gap-5 text-[1.05rem] font-medium marker:hidden">
                {item.q}
                <SiteIcon name="plus" vibe={vibe} />
              </summary>
              <p className="mt-3 max-w-[62ch] text-[0.97rem] leading-relaxed text-[var(--muted)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({
  vibe = 'comercial',
  title,
  body,
  cta,
  whatsapp,
  layout = 'band',
  ctx,
}: CtaBandProps & { ctx: RenderContext }) {
  const href =
    whatsapp && ctx.tenant.whatsapp
      ? `/go/wa?from=${encodeURIComponent(ctx.pagePath)}`
      : cta.href;
  return (
    <section
      className={`${section} site-cta site-cta-${layout} bg-[var(--ink)] text-[var(--paper)]`}
    >
      <div
        className={`${shell} flex flex-col items-start gap-7 md:flex-row md:items-end md:justify-between`}
      >
        <div className="flex max-w-[34ch] flex-col gap-3">
          <h2 className={h2Class}>{title}</h2>
          {body ? (
            <p className="text-[1.02rem] leading-relaxed opacity-75">{body}</p>
          ) : null}
        </div>
        <MotionLink
          href={previewHref(href, ctx)}
          className="site-action inline-flex shrink-0 items-center rounded-[var(--radius)] bg-[var(--highlight)] px-7 py-3.5 text-[0.98rem] font-medium text-[var(--highlight-ink)]"
          data-track={whatsapp ? 'whatsapp' : undefined}
          {...(whatsapp ? { rel: 'noreferrer' } : {})}
        >
          {cta.label}
          <SiteIcon name="arrow-up-right" vibe={vibe} size={18} />
        </MotionLink>
      </div>
    </section>
  );
}

export function FormLead({
  vibe = 'comercial',
  title,
  body,
  fields,
  submitLabel,
  consentText,
  whatsappOptIn,
  redirectTo,
  layout = 'split',
  ctx,
}: FormLeadProps & { ctx: RenderContext }) {
  const inputClass =
    'w-full rounded-[var(--radius)] border border-[var(--line)] bg-transparent px-4 py-3 text-[0.97rem] outline-none focus:border-[var(--highlight)]';
  return (
    <section
      className={`${section} site-form site-form-${layout} border-b border-[var(--line)]`}
    >
      <div className={`${shell} grid gap-12 md:grid-cols-12`}>
        <div className="flex flex-col gap-3 md:col-span-5">
          <h2 className={h2Class}>{title}</h2>
          {body ? (
            <p className="max-w-[40ch] text-[1rem] leading-relaxed text-[var(--muted)]">
              {body}
            </p>
          ) : null}
        </div>
        {/* POST nativo: sem JavaScript de cliente, funciona com JS desligado. */}
        <form
          method="post"
          action={
            ctx.isPreview
              ? `/api/form?preview=1&__tenant=${ctx.tenant.slug}`
              : ctx.previewTenant
                ? `/api/form?__tenant=${ctx.previewTenant}`
                : '/api/form'
          }
          className="flex flex-col gap-5 md:col-span-7"
        >
          <input type="hidden" name="tenant" value={ctx.tenant.slug} />
          <input type="hidden" name="page" value={ctx.pagePath} />
          <input type="hidden" name="redirect" value={redirectTo} />
          {/* Sem `value`: um input controlado seria zerado na hidratação,
              apagando o que o script de atribuição escreveu. */}
          <input type="hidden" name="attribution" data-attribution="1" />
          <p className="hidden" aria-hidden="true">
            <label>
              Não preencha este campo
              <input
                type="text"
                name="company_website"
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </p>
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-2">
              <span className="text-[0.88rem] font-medium">
                {f.label}
                {f.required ? (
                  <span className="text-[var(--highlight-text)]"> *</span>
                ) : null}
              </span>
              {f.type === 'textarea' ? (
                <textarea
                  name={f.name}
                  required={f.required}
                  rows={4}
                  className={inputClass}
                />
              ) : f.type === 'select' ? (
                <select
                  name={f.name}
                  required={f.required}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {(f.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  name={f.name}
                  required={f.required}
                  className={inputClass}
                />
              )}
            </label>
          ))}
          <label className="flex items-start gap-3 text-[0.85rem] leading-relaxed text-[var(--muted)]">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-1 size-4 accent-[var(--highlight)]"
            />
            <span>{consentText}</span>
          </label>
          {whatsappOptIn ? (
            <label className="flex items-start gap-3 text-[0.85rem] leading-relaxed text-[var(--muted)]">
              <input
                type="checkbox"
                name="whatsapp_optin"
                className="mt-1 size-4 accent-[var(--highlight)]"
              />
              <span>Quero receber contato por WhatsApp.</span>
            </label>
          ) : null}
          <button
            type="submit"
            disabled={ctx.isPreview}
            className="site-submit inline-flex items-center gap-3 mt-1 self-start rounded-[var(--radius)] bg-[var(--highlight)] px-7 py-3.5 text-[0.98rem] font-medium text-[var(--highlight-ink)]"
          >
            {submitLabel}
            <SiteIcon name="arrow-right" vibe={vibe} />
          </button>
          {ctx.isPreview ? (
            <p className="text-sm text-[var(--muted)]">
              Envios desativados na prévia.
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}

export function EditorialText({
  title,
  body,
  layout = 'narrow',
}: EditorialTextProps) {
  return (
    <section
      className={`${section} site-text site-text-${layout} border-b border-[var(--line)]`}
    >
      <div className={`${shell} max-w-[48rem]`}>
        {title ? <h2 className={`${h2Class} mb-7`}>{title}</h2> : null}
        <div className="flex flex-col gap-5">
          {body.split('\n\n').map((paragraph) => (
            <p
              key={paragraph.slice(0, 40)}
              className="text-[1.05rem] leading-[1.75] text-[var(--muted)]"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialResources({
  vibe = 'comercial',
  title,
  body,
  items,
  layout,
}: EditorialResourcesProps) {
  return (
    <section className={`${section} site-resources site-resources-${layout}`}>
      <div className={shell}>
        <div className="site-resources-heading">
          <h2 className={h2Class}>{title}</h2>
          {body && <p>{body}</p>}
        </div>
        <div className="site-resources-grid">
          {items.map((item) => (
            <article key={item.href} className="site-resource">
              <a href={item.href} className="site-resource-link">
                {item.image ? (
                  <div className="site-resource-photo">
                    <img
                      src={item.image}
                      alt={item.imageAlt ?? ''}
                      width={760}
                      height={520}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : item.icon ? (
                  <div className="site-resource-symbol" aria-hidden="true">
                    <SiteIcon name={item.icon} vibe={vibe} size={56} badge />
                  </div>
                ) : null}
                <div className="site-resource-copy">
                  <span className="site-resource-category">
                    {item.category}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  <span className="site-resource-read">
                    Explorar
                    <SiteIcon name="arrow-up-right" vibe={vibe} />
                  </span>
                </div>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialPostList({
  vibe = 'comercial',
  title,
  limit,
  layout = 'grid',
  ctx,
}: EditorialPostListProps & { ctx: RenderContext }) {
  const posts = (ctx.posts ?? []).slice(0, limit);
  return (
    <section
      className={`${section} site-post-list site-post-list-${layout} border-b border-[var(--line)]`}
    >
      <div className={shell}>
        <h1 className={`${h2Class} mb-12`}>{title}</h1>
        {posts.length === 0 ? (
          <p className="text-[var(--muted)]">
            Nenhum conteúdo publicado ainda.
          </p>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
            {posts.map((post) => (
              <li key={post.slug} className="bg-[var(--paper)]">
                <a
                  href={`/${post.slug}`}
                  className="flex h-full flex-col gap-3 p-8 hover:bg-[color-mix(in_oklab,var(--line)_40%,transparent)]"
                >
                  {post.date ? (
                    <time className={eyebrowClass} dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </time>
                  ) : null}
                  <h2 className="text-[1.3rem] font-semibold leading-snug tracking-[-0.015em]">
                    {post.title} <SiteIcon name="arrow-up-right" vibe={vibe} />
                  </h2>
                  {post.excerpt ? (
                    <p className="text-[0.97rem] leading-relaxed text-[var(--muted)]">
                      {post.excerpt}
                    </p>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function EditorialPostBody({ body }: EditorialPostBodyProps) {
  const nodes = body
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return (
    <article
      className={`${section} site-post-body border-b border-[var(--line)]`}
    >
      <div className={`${shell} flex max-w-[44rem] flex-col gap-6`}>
        {nodes.map((node) => {
          const key = node.slice(0, 48);
          if (node.startsWith('## ')) {
            return (
              <h2
                key={key}
                className="mt-6 text-[1.6rem] font-semibold tracking-[-0.02em]"
              >
                {node.slice(3)}
              </h2>
            );
          }
          if (node.startsWith('### ')) {
            return (
              <h3
                key={key}
                className="mt-4 text-[1.25rem] font-semibold tracking-[-0.015em]"
              >
                {node.slice(4)}
              </h3>
            );
          }
          if (/^[-*] /m.test(node)) {
            return (
              <ul key={key} className="flex list-disc flex-col gap-2 pl-5">
                {node.split('\n').map((line) => (
                  <li
                    key={line}
                    className="text-[1.03rem] leading-[1.75] text-[var(--muted)]"
                  >
                    {line.replace(/^[-*] /, '')}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p
              key={key}
              className="text-[1.05rem] leading-[1.78] text-[var(--muted)]"
            >
              {node}
            </p>
          );
        })}
      </div>
    </article>
  );
}

export function MediaGallery({
  title,
  images,
  layout = 'grid',
}: MediaGalleryProps) {
  return (
    <section
      className={`${section} site-gallery site-gallery-${layout} border-b border-[var(--line)]`}
    >
      <div className={shell}>
        {title ? <h2 className={`${h2Class} mb-10`}>{title}</h2> : null}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <li key={image.src}>
              <img
                src={image.src}
                alt={image.alt}
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full rounded-[var(--radius)] object-cover"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function MediaMap({
  vibe = 'comercial',
  title,
  address,
  query,
  layout = 'split',
}: MediaMapProps) {
  return (
    <section
      className={`${section} site-map site-map-${layout} border-b border-[var(--line)]`}
    >
      <div className={`${shell} grid gap-10 md:grid-cols-12`}>
        <div className="flex flex-col gap-3 md:col-span-4">
          {title ? <h2 className={h2Class}>{title}</h2> : null}
          <address className="text-[1rem] not-italic leading-relaxed text-[var(--muted)]">
            {address}
          </address>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
            rel="noreferrer"
            className="text-[0.95rem] font-medium text-[var(--highlight-text)] underline underline-offset-4"
          >
            Ver rota <SiteIcon name="route" vibe={vibe} size={18} />
          </a>
        </div>
        <div className="md:col-span-8">
          <iframe
            title={`Mapa de ${address}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[16/10] w-full rounded-[var(--radius)] border border-[var(--line)]"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`}
          />
        </div>
      </div>
    </section>
  );
}

export function PricingTable({
  vibe = 'comercial',
  title,
  plans,
  layout = 'cards',
}: PricingTableProps) {
  return (
    <section
      className={`${section} site-pricing site-pricing-${layout} border-b border-[var(--line)]`}
    >
      <div className={shell}>
        <h2 className={`${h2Class} mb-12 max-w-[20ch]`}>{title}</h2>
        <ul className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.name}
              className={`flex flex-col gap-6 p-8 ${plan.highlight ? 'site-plan-featured bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--paper)]'}`}
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-[1.1rem] font-semibold">{plan.name}</h3>
                <p className="text-[2rem] font-semibold tracking-[-0.03em]">
                  {plan.price}
                </p>
                {plan.note ? (
                  <p className="text-[0.88rem] opacity-70">{plan.note}</p>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="site-plan-feature text-[0.95rem] leading-snug opacity-80"
                  >
                    <SiteIcon name="check" vibe={vibe} size={17} />
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={plan.cta.href}
                className={`site-plan-cta mt-auto inline-flex items-center justify-center rounded-[var(--radius)] px-5 py-3 text-[0.95rem] font-medium ${
                  plan.highlight
                    ? 'bg-[var(--highlight)] text-[var(--highlight-ink)]'
                    : 'border border-[var(--line)] text-[var(--ink)]'
                }`}
              >
                {plan.cta.label}
                <SiteIcon name="arrow-up-right" vibe={vibe} size={18} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Contatos do cadastro no rodapé. São dado do operador, não composição do
 * agente: aparecem em todos os layouts, inclusive no minimal, e o bloco
 * continua sem campo de telefone, e-mail ou rede para o modelo preencher.
 */
function FooterContacts({ ctx }: { ctx: RenderContext }) {
  const vibe = renderingVibeOf(ctx.tenant.brand);
  const contacts = contactsOf(ctx.tenant.contacts, ctx.tenant.whatsapp);
  const email = ctx.tenant.contactEmail;
  const social = socialLinks(contacts);
  // Post e obrigado não recebem a seção de localização: nessas páginas o
  // atalho apontaria para uma âncora que não existe.
  const hasLocation =
    contacts.addresses.length > 0 &&
    ctx.pageType !== 'post' &&
    ctx.pageType !== 'thank_you';
  if (
    !contacts.phones.length &&
    !email &&
    !social.length &&
    !contacts.addresses.length
  )
    return null;
  const link =
    'flex items-center gap-2 text-[0.92rem] text-[var(--muted)] hover:text-[var(--ink)]';
  // O índice de cada WhatsApp vira ?n= no redirecionador; contar antes evita
  // mutar variável durante a renderização.
  const phones = contacts.phones.map((phone, index) => ({
    ...phone,
    waIndex: contacts.phones
      .slice(0, index)
      .filter((previous) => previous.whatsapp).length,
  }));
  return (
    <div className="site-footer-contacts flex flex-col gap-2.5">
      <p className="site-eyebrow text-[0.8rem] font-medium text-[var(--ink)]">
        Contato
      </p>
      {phones.map((phone) => {
        if (!phone.whatsapp)
          return (
            <a
              key={phone.number}
              href={`tel:${phoneE164(phone.number)}`}
              className={link}
            >
              <SiteIcon name="phone" vibe={vibe} size={18} />
              {formatPhone(phone.number)}
            </a>
          );
        return (
          <a
            key={phone.number}
            href={previewHref(
              `/go/wa?n=${phone.waIndex}&from=${encodeURIComponent(ctx.pagePath)}`,
              ctx,
            )}
            rel="noreferrer"
            data-track="whatsapp"
            className={link}
          >
            <SiteIcon name="chat" vibe={vibe} size={18} />
            {formatPhone(phone.number)}
            <span className="text-[0.78rem] opacity-70">WhatsApp</span>
          </a>
        );
      })}
      {email ? (
        <a href={`mailto:${email}`} className={link}>
          <SiteIcon name="mail" vibe={vibe} size={18} />
          {email}
        </a>
      ) : null}
      {hasLocation ? (
        <a href="#onde-estamos" className={link}>
          <SiteIcon name="pin" vibe={vibe} size={18} />
          Onde estamos
        </a>
      ) : null}
      {social.length ? (
        <ul className="site-footer-social mt-1 flex flex-wrap gap-3">
          {social.map((item) => (
            <li key={item.url}>
              <a
                href={item.url}
                rel="noreferrer"
                aria-label={item.label}
                title={item.label}
                className="flex size-9 items-center justify-center rounded-[var(--radius)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <SocialIcon network={item.key} vibe={vibe} />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FooterCompact({
  logoText,
  logoHeight,
  tagline,
  links,
  legal,
  layout = 'split',
  presentation,
  ctx,
}: FooterCompactProps & { ctx: RenderContext }) {
  const logo = logoFor(ctx.tenant.brand, presentation);
  return (
    <footer className={`site-footer site-footer-${layout} py-14`}>
      <div className={`${shell} flex flex-col gap-8`}>
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex max-w-full flex-col gap-2">
            {logo ? (
              <img
                src={logo}
                alt={logoText}
                width={logoHeight === undefined ? 140 : undefined}
                height={logoHeight ?? 36}
                style={
                  logoHeight === undefined ? undefined : { height: logoHeight }
                }
                className={
                  logoHeight === undefined
                    ? 'h-8 w-auto max-w-[160px] object-contain'
                    : 'w-auto max-w-full self-start object-contain object-left'
                }
                loading="lazy"
                decoding="async"
              />
            ) : (
              <p className="text-[1.05rem] font-semibold tracking-[-0.01em]">
                {logoText}
              </p>
            )}
            {tagline ? (
              <p className="max-w-[36ch] text-[0.95rem] text-[var(--muted)]">
                {tagline}
              </p>
            ) : null}
          </div>
          {links.length ? (
            <nav
              className="site-footer-nav flex flex-wrap gap-x-7 gap-y-3"
              aria-label="Rodapé"
            >
              {links.map((link) => (
                <a
                  key={link.href + link.label}
                  href={link.href}
                  className="text-[0.92rem] text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          ) : null}
          <FooterContacts ctx={ctx} />
        </div>
        {legal ? (
          <p className="text-[0.82rem] text-[var(--muted)]">{legal}</p>
        ) : null}
      </div>
    </footer>
  );
}

export function FeatureNumbered({
  vibe = 'comercial',
  eyebrow,
  title,
  lead,
  items,
  layout = 'ledger',
}: FeatureNumberedProps) {
  return (
    <section className={`${section} site-services site-services-${layout}`}>
      <div className={`${shell} site-services-grid grid gap-12`}>
        <div className="flex max-w-[40rem] flex-col items-start gap-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={h2Class}>{title}</h2>
          {lead ? (
            <p className="text-[1.02rem] leading-relaxed text-[var(--muted)]">
              {lead}
            </p>
          ) : null}
        </div>
        <ul className="grid gap-x-8 md:grid-cols-2">
          {items.map((item) => {
            const inner = (
              <>
                <h3 className="site-item-heading text-[1.15rem] font-semibold tracking-[-0.01em]">
                  {item.icon ? <SiteIcon name={item.icon} vibe={vibe} /> : null}
                  <span>{item.title}</span>
                </h3>
                <p className="mt-3 text-[0.97rem] leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>
              </>
            );
            return (
              <li
                key={item.title}
                className="border-t border-[var(--line)] py-7"
              >
                {item.href ? (
                  <a
                    href={item.href}
                    className="block underline-offset-4 hover:underline"
                  >
                    {inner}
                  </a>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function NarrativeSplit({
  vibe = 'comercial',
  eyebrow,
  title,
  items,
  image,
  imageAlt,
  layout = 'split',
}: NarrativeSplitProps) {
  const hasImage = Boolean(image && /^https?:\/\//.test(image));
  return (
    <section
      className={`${section} site-narrative-split site-narrative-${layout}`}
    >
      <div
        className={`${shell} grid items-start gap-12 ${hasImage ? 'md:grid-cols-2' : ''}`}
      >
        {hasImage ? (
          <figure className="overflow-hidden rounded-[var(--panel-radius)]">
            <img
              src={image}
              alt={imageAlt ?? ''}
              width={720}
              height={860}
              loading="lazy"
              decoding="async"
              className="aspect-[5/6] w-full object-cover"
            />
          </figure>
        ) : null}
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={`${h2Class} mt-4 mb-8 max-w-[24ch]`}>{title}</h2>
          <ul className={`grid gap-x-10 ${hasImage ? '' : 'md:grid-cols-2'}`}>
            {items.map((item) => (
              <li
                key={item.title}
                className="border-t border-[var(--line)] py-6"
              >
                <h3 className="site-item-heading text-lg font-semibold tracking-[-0.01em]">
                  {item.icon ? <SiteIcon name={item.icon} vibe={vibe} /> : null}
                  {item.href ? (
                    <a
                      href={item.href}
                      className="underline-offset-4 hover:underline"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span>{item.title}</span>
                  )}
                </h3>
                <p className="mt-2 max-w-[52ch] text-base leading-relaxed text-[var(--muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function EditorialFacts({
  eyebrow,
  title,
  body,
  facts,
  dark,
  layout = 'split',
}: EditorialFactsProps) {
  return (
    <section
      className={`${section} site-facts site-facts-${layout} border-b border-[var(--line)] ${dark ? 'site-facts-dark bg-[var(--ink)] text-[var(--paper)]' : ''}`}
    >
      <div className={`${shell} grid gap-12 md:grid-cols-12`}>
        <div className="flex flex-col gap-4 md:col-span-7">
          {eyebrow ? (
            <p
              className={`${eyebrowClass} ${dark ? 'text-[var(--paper)] opacity-60' : ''}`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2 className={h2Class}>{title}</h2>
          {body ? (
            <p
              className={`max-w-[56ch] text-[1.02rem] leading-relaxed ${dark ? 'opacity-75' : 'text-[var(--muted)]'}`}
            >
              {body}
            </p>
          ) : null}
        </div>
        <dl className="flex flex-col md:col-span-5">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className={`flex justify-between gap-6 border-t py-4 first:border-t-0 first:pt-0 ${dark ? 'border-[color-mix(in_oklab,var(--paper)_20%,transparent)]' : 'border-[var(--line)]'}`}
            >
              <dt
                className={`text-[0.9rem] ${dark ? 'opacity-60' : 'text-[var(--muted)]'}`}
              >
                {fact.label}
              </dt>
              <dd className="text-right text-[0.98rem] font-medium">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function MediaImage({
  src,
  alt,
  caption,
  layout = 'wide',
}: MediaImageProps) {
  return (
    <section
      className={`${section} site-media-image site-media-${layout} border-b border-[var(--line)]`}
    >
      <figure className={shell}>
        <img
          src={src}
          alt={alt}
          width={1400}
          height={800}
          loading="lazy"
          decoding="async"
          className="aspect-[16/9] w-full rounded-[var(--radius)] object-cover"
        />
        {caption ? (
          <figcaption className="mt-3 text-[0.88rem] text-[var(--muted)]">
            {caption}
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}

/** Botão flutuante de WhatsApp. Sai em todo site que tem número, fora do fluxo de blocos. */
export function FloatingWhatsapp({ ctx }: { ctx: RenderContext }) {
  if (!ctx.tenant.whatsapp) return null;
  return (
    <a
      href={previewHref(`/go/wa?from=${encodeURIComponent(ctx.pagePath)}`, ctx)}
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      data-track="whatsapp"
      className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.45)]"
    >
      <span
        className="site-icon"
        data-icon-vibe={renderingVibeOf(ctx.tenant.brand)}
        aria-hidden="true"
      >
        <svg
          className="site-icon-svg"
          viewBox="0 0 24 24"
          width="28"
          height="28"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.1.6 2.8.5a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.2-.2-.2-.5-.4Z" />
        </svg>
      </span>
    </a>
  );
}
