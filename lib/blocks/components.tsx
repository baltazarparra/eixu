/*
 * Os sites de clientes não embarcam JavaScript de cliente. Duas consequências
 * deliberadas nesta biblioteca:
 *
 * 1. Âncoras nativas em vez de `next/link`. O componente de link traz o roteador
 *    e o prefetch junto, e é justamente o bundle zerado que segura o Lighthouse.
 *    A navegação entre páginas do site é sempre um carregamento novo.
 * 2. `<img>` em vez de `next/image`. As imagens vêm de URLs informadas pelo
 *    operador, de hosts arbitrários. Liberar o otimizador para qualquer host
 *    abriria um proxy de imagem para a internet inteira. Todas as imagens levam
 *    largura e altura explícitas, então o deslocamento de layout fica em zero.
 *    Quando o upload por Vercel Blob entrar, isto passa para `next/image`.
 */
// oxlint-disable next/no-html-link-for-pages
// oxlint-disable next/no-img-element
import { z } from 'zod';
import { blockSchemas } from '@/lib/blocks/registry';
import type { RenderContext } from '@/lib/blocks/render';

type S<K extends keyof typeof blockSchemas> = z.infer<(typeof blockSchemas)[K]>;

export type NavBarProps = S<'nav.bar'>;
export type HeroSplitProps = S<'hero.split'>;
export type HeroStatementProps = S<'hero.statement'>;
export type ProofLogosProps = S<'proof.logos'>;
export type ProofStatsProps = S<'proof.stats'>;
export type ProofTestimonialProps = S<'proof.testimonial'>;
export type FeatureBentoProps = S<'feature.bento'>;
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

const shell = 'mx-auto w-full max-w-[76rem] px-6 md:px-10';

/** Mapa estático: Tailwind não gera classes montadas em tempo de execução. */
const statCols: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};
const section = 'py-20 md:py-28';
const eyebrowClass = 'text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[var(--muted)]';
const h2Class = 'text-balance text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.02em]';

function Eyebrow({ children }: { children?: string }) {
  if (!children) return null;
  return <p className={eyebrowClass}>{children}</p>;
}

/** Link de ação. Rota do WhatsApp passa pelo redirecionador rastreado. */
function Action({
  href,
  label,
  variant = 'solid',
}: {
  href: string;
  label: string;
  variant?: 'solid' | 'ghost';
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] px-6 py-3 text-[0.95rem] font-medium transition-colors';
  const styles =
    variant === 'solid'
      ? 'bg-[var(--accent)] text-[var(--accent-ink)] hover:opacity-90'
      : 'border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]';
  const external = href.startsWith('http') || href.startsWith('/go/');
  return (
    <a
      href={href}
      className={`${base} ${styles}`}
      {...(external ? { rel: 'noreferrer' } : {})}
      data-track={href.startsWith('/go/wa') ? 'whatsapp' : undefined}
    >
      {label}
    </a>
  );
}

export function NavBar({ logoText, links, cta }: NavBarProps) {
  return (
    <header className="border-b border-[var(--line)]">
      <div className={`${shell} flex h-20 items-center justify-between gap-6`}>
        <a href="/" className="text-[1.05rem] font-semibold tracking-[-0.01em]">
          {logoText}
        </a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
          {links.map((link) => (
            <a key={link.href + link.label} href={link.href} className="text-[0.92rem] text-[var(--muted)] hover:text-[var(--ink)]">
              {link.label}
            </a>
          ))}
        </nav>
        {cta ? (
          <a
            href={cta.href}
            className="rounded-[var(--radius)] bg-[var(--accent)] px-5 py-2.5 text-[0.9rem] font-medium text-[var(--accent-ink)]"
            data-track={cta.href.startsWith('/go/wa') ? 'whatsapp' : undefined}
          >
            {cta.label}
          </a>
        ) : null}
      </div>
    </header>
  );
}

export function HeroSplit({ eyebrow, headline, subtext, cta, secondary, image, imageAlt }: HeroSplitProps & { ctx: RenderContext }) {
  return (
    <section className="border-b border-[var(--line)] pt-16 pb-20 md:pt-24 md:pb-28">
      <div className={`${shell} grid items-center gap-12 md:grid-cols-12 md:gap-16`}>
        <div className="flex flex-col gap-6 md:col-span-7">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="text-balance text-[clamp(2.4rem,6vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            {headline}
          </h1>
          {subtext ? <p className="max-w-[46ch] text-[1.05rem] leading-relaxed text-[var(--muted)]">{subtext}</p> : null}
          <div className="flex flex-wrap gap-3 pt-2">
            <Action href={cta.href} label={cta.label} />
            {secondary ? <Action href={secondary.href} label={secondary.label} variant="ghost" /> : null}
          </div>
        </div>
        <div className="md:col-span-5">
          {image && /^https?:\/\//.test(image) ? (
            <img
              src={image}
              alt={imageAlt ?? ''}
              width={720}
              height={900}
              className="aspect-[4/5] w-full rounded-[var(--radius)] object-cover"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <div
              aria-hidden="true"
              className="aspect-[4/5] w-full rounded-[var(--radius)] border border-[var(--line)] bg-[linear-gradient(160deg,var(--line),transparent)]"
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function HeroStatement({ eyebrow, headline, subtext, cta }: HeroStatementProps & { ctx: RenderContext }) {
  return (
    <section className="border-b border-[var(--line)] pt-20 pb-24 md:pt-28 md:pb-32">
      <div className={`${shell} flex max-w-[60rem] flex-col gap-7`}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-balance text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[1.0] tracking-[-0.035em]">
          {headline}
        </h1>
        {subtext ? <p className="max-w-[48ch] text-[1.1rem] leading-relaxed text-[var(--muted)]">{subtext}</p> : null}
        <div className="pt-2">
          <Action href={cta.href} label={cta.label} />
        </div>
      </div>
    </section>
  );
}

export function ProofLogos({ title, logos }: ProofLogosProps) {
  return (
    <section className="border-b border-[var(--line)] py-12">
      <div className={shell}>
        {title ? <p className={`${eyebrowClass} mb-7`}>{title}</p> : null}
        <ul className="flex flex-wrap items-center gap-x-10 gap-y-5">
          {logos.map((logo) => (
            <li key={logo} className="text-[1.05rem] font-medium tracking-[-0.01em] text-[var(--muted)]">
              {logo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProofStats({ items }: ProofStatsProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} grid gap-10 sm:grid-cols-2 ${statCols[items.length] ?? 'lg:grid-cols-4'}`}>
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-2">
            <p className="text-[clamp(2.4rem,5vw,3.6rem)] font-semibold leading-none tracking-[-0.03em] text-[var(--accent)]">
              {item.value}
            </p>
            <p className="text-[0.95rem] leading-snug text-[var(--muted)]">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProofTestimonial({ quote, author, role }: ProofTestimonialProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <figure className={`${shell} max-w-[54rem]`}>
        <blockquote className="text-balance text-[clamp(1.4rem,3vw,2.1rem)] font-medium leading-[1.32] tracking-[-0.015em]">
          {quote}
        </blockquote>
        <figcaption className="mt-7 text-[0.95rem] text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">{author}</span>
          {role ? `, ${role}` : ''}
        </figcaption>
      </figure>
    </section>
  );
}

export function FeatureBento({ eyebrow, title, items }: FeatureBentoProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={shell}>
        <div className="flex flex-col gap-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={`${h2Class} max-w-[22ch]`}>{title}</h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-6">
          {items.map((item, index) => (
            <article
              key={item.title}
              className={`flex flex-col gap-3 bg-[var(--paper)] p-8 ${index % 3 === 0 ? 'lg:col-span-4' : 'lg:col-span-2'}`}
            >
              <h3 className="text-[1.15rem] font-semibold tracking-[-0.01em]">{item.title}</h3>
              <p className="text-[0.97rem] leading-relaxed text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function NarrativeSteps({ eyebrow, title, steps }: NarrativeStepsProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} grid gap-14 md:grid-cols-12`}>
        <div className="flex flex-col gap-4 md:col-span-4">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className={h2Class}>{title}</h2>
        </div>
        <ol className="flex flex-col md:col-span-8">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-6 border-t border-[var(--line)] py-7 first:border-t-0 first:pt-0">
              <span className="pt-1 font-mono text-[0.85rem] text-[var(--muted)]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-[1.15rem] font-semibold tracking-[-0.01em]">{step.title}</h3>
                <p className="max-w-[54ch] text-[0.97rem] leading-relaxed text-[var(--muted)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function FaqAccordion({ title, items }: FaqAccordionProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} grid gap-12 md:grid-cols-12`}>
        <h2 className={`${h2Class} md:col-span-4`}>{title}</h2>
        <div className="md:col-span-8">
          {items.map((item) => (
            <details key={item.q} className="group border-t border-[var(--line)] py-5 first:border-t-0 first:pt-0">
              <summary className="cursor-pointer list-none text-[1.05rem] font-medium marker:hidden">
                {item.q}
              </summary>
              <p className="mt-3 max-w-[62ch] text-[0.97rem] leading-relaxed text-[var(--muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CtaBand({ title, body, cta, whatsapp, ctx }: CtaBandProps & { ctx: RenderContext }) {
  const href = whatsapp && ctx.tenant.whatsapp ? `/go/wa?from=${encodeURIComponent(ctx.pagePath)}` : cta.href;
  return (
    <section className={`${section} border-b border-[var(--line)] bg-[var(--ink)] text-[var(--paper)]`}>
      <div className={`${shell} flex flex-col items-start gap-7 md:flex-row md:items-end md:justify-between`}>
        <div className="flex max-w-[34ch] flex-col gap-3">
          <h2 className={h2Class}>{title}</h2>
          {body ? <p className="text-[1.02rem] leading-relaxed opacity-75">{body}</p> : null}
        </div>
        <a
          href={href}
          className="inline-flex shrink-0 items-center rounded-[var(--radius)] bg-[var(--accent)] px-7 py-3.5 text-[0.98rem] font-medium text-[var(--accent-ink)]"
          data-track={whatsapp ? 'whatsapp' : undefined}
          {...(whatsapp ? { rel: 'noreferrer' } : {})}
        >
          {cta.label}
        </a>
      </div>
    </section>
  );
}

export function FormLead({
  title,
  body,
  fields,
  submitLabel,
  consentText,
  whatsappOptIn,
  redirectTo,
  ctx,
}: FormLeadProps & { ctx: RenderContext }) {
  const inputClass =
    'w-full rounded-[var(--radius)] border border-[var(--line)] bg-transparent px-4 py-3 text-[0.97rem] outline-none focus:border-[var(--accent)]';
  return (
    <section id="contato" className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} grid gap-12 md:grid-cols-12`}>
        <div className="flex flex-col gap-3 md:col-span-5">
          <h2 className={h2Class}>{title}</h2>
          {body ? <p className="max-w-[40ch] text-[1rem] leading-relaxed text-[var(--muted)]">{body}</p> : null}
        </div>
        {/* POST nativo: sem JavaScript de cliente, funciona com JS desligado. */}
        <form
          method="post"
          action={ctx.previewTenant ? `/api/form?__tenant=${ctx.previewTenant}` : '/api/form'}
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
              <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
            </label>
          </p>
          {fields.map((f) => (
            <label key={f.name} className="flex flex-col gap-2">
              <span className="text-[0.88rem] font-medium">
                {f.label}
                {f.required ? <span className="text-[var(--accent)]"> *</span> : null}
              </span>
              {f.type === 'textarea' ? (
                <textarea name={f.name} required={f.required} rows={4} className={inputClass} />
              ) : f.type === 'select' ? (
                <select name={f.name} required={f.required} className={inputClass}>
                  <option value="">Selecione</option>
                  {(f.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input type={f.type} name={f.name} required={f.required} className={inputClass} />
              )}
            </label>
          ))}
          <label className="flex items-start gap-3 text-[0.85rem] leading-relaxed text-[var(--muted)]">
            <input type="checkbox" name="consent" required className="mt-1 size-4 accent-[var(--accent)]" />
            <span>{consentText}</span>
          </label>
          {whatsappOptIn ? (
            <label className="flex items-start gap-3 text-[0.85rem] leading-relaxed text-[var(--muted)]">
              <input type="checkbox" name="whatsapp_optin" className="mt-1 size-4 accent-[var(--accent)]" />
              <span>Quero receber contato por WhatsApp.</span>
            </label>
          ) : null}
          <button
            type="submit"
            className="mt-1 self-start rounded-[var(--radius)] bg-[var(--accent)] px-7 py-3.5 text-[0.98rem] font-medium text-[var(--accent-ink)]"
          >
            {submitLabel}
          </button>
        </form>
      </div>
    </section>
  );
}

export function EditorialText({ title, body }: EditorialTextProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} max-w-[48rem]`}>
        {title ? <h2 className={`${h2Class} mb-7`}>{title}</h2> : null}
        <div className="flex flex-col gap-5">
          {body.split('\n\n').map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-[1.05rem] leading-[1.75] text-[var(--muted)]">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialPostList({ title, limit, ctx }: EditorialPostListProps & { ctx: RenderContext }) {
  const posts = (ctx.posts ?? []).slice(0, limit);
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={shell}>
        <h1 className={`${h2Class} mb-12`}>{title}</h1>
        {posts.length === 0 ? (
          <p className="text-[var(--muted)]">Nenhum conteúdo publicado ainda.</p>
        ) : (
          <ul className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-2">
            {posts.map((post) => (
              <li key={post.slug} className="bg-[var(--paper)]">
                <a href={`/${post.slug}`} className="flex h-full flex-col gap-3 p-8 hover:bg-[color-mix(in_oklab,var(--line)_40%,transparent)]">
                  {post.date ? (
                    <time className={eyebrowClass} dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </time>
                  ) : null}
                  <h2 className="text-[1.3rem] font-semibold leading-snug tracking-[-0.015em]">{post.title}</h2>
                  {post.excerpt ? <p className="text-[0.97rem] leading-relaxed text-[var(--muted)]">{post.excerpt}</p> : null}
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
  const nodes = body.split('\n\n').map((chunk) => chunk.trim()).filter(Boolean);
  return (
    <article className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} flex max-w-[44rem] flex-col gap-6`}>
        {nodes.map((node) => {
          const key = node.slice(0, 48);
          if (node.startsWith('## ')) {
            return (
              <h2 key={key} className="mt-6 text-[1.6rem] font-semibold tracking-[-0.02em]">
                {node.slice(3)}
              </h2>
            );
          }
          if (node.startsWith('### ')) {
            return (
              <h3 key={key} className="mt-4 text-[1.25rem] font-semibold tracking-[-0.015em]">
                {node.slice(4)}
              </h3>
            );
          }
          if (/^[-*] /m.test(node)) {
            return (
              <ul key={key} className="flex list-disc flex-col gap-2 pl-5">
                {node.split('\n').map((line) => (
                  <li key={line} className="text-[1.03rem] leading-[1.75] text-[var(--muted)]">
                    {line.replace(/^[-*] /, '')}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={key} className="text-[1.05rem] leading-[1.78] text-[var(--muted)]">
              {node}
            </p>
          );
        })}
      </div>
    </article>
  );
}

export function MediaGallery({ title, images }: MediaGalleryProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
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

export function MediaMap({ title, address, query }: MediaMapProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={`${shell} grid gap-10 md:grid-cols-12`}>
        <div className="flex flex-col gap-3 md:col-span-4">
          {title ? <h2 className={h2Class}>{title}</h2> : null}
          <address className="text-[1rem] not-italic leading-relaxed text-[var(--muted)]">{address}</address>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
            rel="noreferrer"
            className="text-[0.95rem] font-medium text-[var(--accent)] underline underline-offset-4"
          >
            Ver rota
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

export function PricingTable({ title, plans }: PricingTableProps) {
  return (
    <section className={`${section} border-b border-[var(--line)]`}>
      <div className={shell}>
        <h2 className={`${h2Class} mb-12 max-w-[20ch]`}>{title}</h2>
        <ul className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--line)] bg-[var(--line)] md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <li
              key={plan.name}
              className={`flex flex-col gap-6 p-8 ${plan.highlight ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--paper)]'}`}
            >
              <div className="flex flex-col gap-1">
                <h3 className="text-[1.1rem] font-semibold">{plan.name}</h3>
                <p className="text-[2rem] font-semibold tracking-[-0.03em]">{plan.price}</p>
                {plan.note ? <p className="text-[0.88rem] opacity-70">{plan.note}</p> : null}
              </div>
              <ul className="flex flex-col gap-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-[0.95rem] leading-snug opacity-80">
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={plan.cta.href}
                className={`mt-auto inline-flex items-center justify-center rounded-[var(--radius)] px-5 py-3 text-[0.95rem] font-medium ${
                  plan.highlight
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'border border-[var(--line)] text-[var(--ink)]'
                }`}
              >
                {plan.cta.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FooterCompact({ logoText, tagline, links, legal }: FooterCompactProps) {
  return (
    <footer className="py-14">
      <div className={`${shell} flex flex-col gap-8`}>
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-[1.05rem] font-semibold tracking-[-0.01em]">{logoText}</p>
            {tagline ? <p className="max-w-[36ch] text-[0.95rem] text-[var(--muted)]">{tagline}</p> : null}
          </div>
          {links.length ? (
            <nav className="flex flex-wrap gap-x-7 gap-y-3" aria-label="Rodapé">
              {links.map((link) => (
                <a key={link.href + link.label} href={link.href} className="text-[0.92rem] text-[var(--muted)] hover:text-[var(--ink)]">
                  {link.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
        {legal ? <p className="text-[0.82rem] text-[var(--muted)]">{legal}</p> : null}
      </div>
    </footer>
  );
}
