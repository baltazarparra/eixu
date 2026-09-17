// oxlint-disable next/no-img-element -- As fotos vêm do Blob, que não gera
// variantes por tamanho: `next/image` não teria de onde montar um srcset e só
// acrescentaria um salto de otimização. O enquadramento é feito em CSS, a
// abertura carrega com prioridade e o resto é lazy.
import { mapsDirectionsUrl, mapsEmbedUrl } from '@/lib/tenant-contacts';
import { Facet } from './nav';
import { SiteLink } from './site-link';
import { link, links, list, ordinal, str, strings, type Link } from './props';

type Props = Record<string, unknown>;

function Action({ to, kind }: { to: Link; kind: 'solid' | 'ghost' }) {
  return (
    <SiteLink className="sa-action" data-kind={kind} href={to.href}>
      {to.label}
    </SiteLink>
  );
}

/**
 * Abertura da home. A foto é o campo inteiro — a mesma pedra escura das
 * fotos do cliente — e a tipografia é a luz que corre na faceta.
 */
export function Hero({ props }: { props: Props }) {
  const image = str(props, 'image');
  const cta = link(props, 'cta');
  const secondary = link(props, 'secondary');
  const bullets = strings(props, 'bullets');
  return (
    <section className="sa-hero">
      {image ? (
        <div className="sa-hero-media">
          <img
            src={image}
            alt={str(props, 'imageAlt')}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      ) : null}
      <div className="sa-hero-veil" aria-hidden="true" />
      <div className="sa-shell sa-hero-inner">
        <p className="sa-eyebrow">{str(props, 'eyebrow')}</p>
        <h1 className="sa-display sa-hero-title" data-facet>
          {str(props, 'headline')}
        </h1>
        <p className="sa-lede">{str(props, 'subtext')}</p>
        <div className="sa-hero-actions">
          {cta ? <Action to={cta} kind="solid" /> : null}
          {secondary ? <Action to={secondary} kind="ghost" /> : null}
        </div>
      </div>
      {bullets.length ? (
        <div className="sa-shell">
          <ul className="sa-spec">
            {bullets.map((item) => (
              <li key={item}>
                <b aria-hidden="true">
                  <Facet size={11} />
                </b>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Abertura das páginas internas: só tipografia, para não repetir a home. */
export function Opening({ props }: { props: Props }) {
  const cta = link(props, 'cta');
  return (
    <section className="sa-opening">
      <div className="sa-shell">
        <p className="sa-eyebrow">{str(props, 'eyebrow')}</p>
        <h1 className="sa-display sa-opening-title">
          {str(props, 'headline')}
        </h1>
        <p className="sa-lede">{str(props, 'subtext')}</p>
        {cta ? (
          <div className="sa-hero-actions">
            <Action to={cta} kind="solid" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * A vitrine. Duas peças em escalas e alturas diferentes: uma bandeja de
 * joalheria não alinha tudo na mesma fileira.
 */
export function Vitrine({ props }: { props: Props }) {
  const images = list(props, 'images');
  const [first, second] = images;
  return (
    <section className="sa-section" data-tight>
      <div className="sa-shell sa-vitrine">
        {/* Sem rótulo inventado: o título já nomeia a seção. */}
        <div className="sa-vitrine-head">
          <h2 className="sa-h2">{str(props, 'title')}</h2>
        </div>
        {first ? (
          <figure className="sa-figure sa-vitrine-a">
            <span className="sa-plate">
              <img
                src={str(first, 'src')}
                alt={str(first, 'alt')}
                loading="lazy"
                decoding="async"
              />
            </span>
          </figure>
        ) : null}
        {second ? (
          <figure className="sa-figure sa-vitrine-b">
            <span className="sa-plate">
              <img
                src={str(second, 'src')}
                alt={str(second, 'alt')}
                loading="lazy"
                decoding="async"
              />
            </span>
          </figure>
        ) : null}
      </div>
    </section>
  );
}

/** Foto larga com legenda, nas páginas internas. */
export function WidePhoto({ props }: { props: Props }) {
  const caption = str(props, 'caption');
  return (
    <section className="sa-section" data-tight>
      <div className="sa-shell sa-wide">
        <figure className="sa-figure">
          <span className="sa-plate">
            <img
              src={str(props, 'src')}
              alt={str(props, 'alt')}
              loading="lazy"
              decoding="async"
            />
          </span>
          {caption ? (
            <figcaption className="sa-caption">{caption}</figcaption>
          ) : null}
        </figure>
      </div>
    </section>
  );
}

/**
 * A ficha de rigor. Serve tanto para os materiais quanto para as categorias:
 * ambos são listas de quatro itens que pedem numeração, não ícones de
 * biblioteca — a numeração é o vocabulário de quem cataloga pedra.
 */
export function Ledger({ props }: { props: Props }) {
  const items = list(props, 'items');
  const lead = str(props, 'lead');
  return (
    <section className="sa-section">
      <div className="sa-shell">
        <div className="sa-ledger-head" data-split={lead ? '' : undefined}>
          <div>
            {str(props, 'eyebrow') ? (
              <p className="sa-eyebrow">{str(props, 'eyebrow')}</p>
            ) : null}
            <h2 className="sa-h2">{str(props, 'title')}</h2>
          </div>
          {lead ? <p className="sa-body">{lead}</p> : null}
        </div>
        <div className="sa-ledger">
          {items.map((item, index) => (
            <article className="sa-ledger-item" key={str(item, 'title')}>
              <span className="sa-ledger-n" aria-hidden="true">
                {ordinal(index)}
              </span>
              <div>
                <h3 className="sa-h3">{str(item, 'title')}</h3>
                <p>{str(item, 'body')}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * A sala de recepção: a única superfície clara do site. Ela aparece onde o
 * texto convida a entrar na loja, então o contraste tem função, não é uma
 * alternância decorativa de faixas.
 */
export function Room({ props }: { props: Props }) {
  const facts = list(props, 'facts');
  return (
    <section className="sa-section sa-light">
      <div className="sa-shell sa-room">
        <div>
          <p className="sa-eyebrow">{str(props, 'eyebrow')}</p>
          <h2 className="sa-h2">{str(props, 'title')}</h2>
          <p className="sa-body" style={{ marginTop: '1.5rem' }}>
            {str(props, 'body')}
          </p>
        </div>
        <dl className="sa-facts">
          {facts.map((fact) => (
            <div key={str(fact, 'label')}>
              <dt>{str(fact, 'label')}</dt>
              <dd>{str(fact, 'value')}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** O percurso do atendimento, na ordem em que ele acontece. */
export function Steps({ props }: { props: Props }) {
  const steps = list(props, 'steps');
  return (
    <section className="sa-section">
      <div className="sa-shell">
        <div className="sa-ledger-head">
          <div>
            <p className="sa-eyebrow">{str(props, 'eyebrow')}</p>
            <h2 className="sa-h2">{str(props, 'title')}</h2>
          </div>
        </div>
        <ol className="sa-steps">
          {steps.map((step, index) => (
            <li className="sa-step" key={str(step, 'title')}>
              <span className="sa-step-n" aria-hidden="true">
                {ordinal(index)}
              </span>
              <div>
                <h3 className="sa-h3">{str(step, 'title')}</h3>
                <p>{str(step, 'body')}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** FAQ em `<details>`: abre sem JavaScript e responde a teclado por padrão. */
export function Faq({ props }: { props: Props }) {
  const items = list(props, 'items');
  return (
    <section className="sa-section">
      <div className="sa-shell sa-faq-grid">
        <div>
          <h2 className="sa-h2">{str(props, 'title')}</h2>
        </div>
        <div className="sa-faq">
          {items.map((item) => (
            <details key={str(item, 'q')}>
              <summary>
                {str(item, 'q')}
                <span aria-hidden="true" />
              </summary>
              <p>{str(item, 'a')}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Onde estamos: endereço do cadastro, mapa e rota. */
export function Where({ address }: { address: string }) {
  return (
    <section className="sa-section" id="onde-estamos" data-tight>
      <div className="sa-shell sa-where">
        <div>
          <h2 className="sa-h2">Onde estamos</h2>
          <address className="sa-address">{address}</address>
          <a
            className="sa-route"
            href={mapsDirectionsUrl(address)}
            target="_blank"
            rel="noreferrer"
          >
            Como chegar
            <Facet size={13} />
          </a>
        </div>
        <div className="sa-map">
          <iframe
            title={`Mapa de ${address}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={mapsEmbedUrl(address)}
          />
        </div>
      </div>
    </section>
  );
}

/** Fechamento: a gema acesa ao fundo e uma única ação. */
export function Close({ props }: { props: Props }) {
  const cta = link(props, 'cta');
  return (
    <section className="sa-section sa-close">
      <div className="sa-shell sa-close-inner">
        <h2 className="sa-h2">{str(props, 'title')}</h2>
        <p className="sa-body">{str(props, 'body')}</p>
        {cta ? <Action to={cta} kind="solid" /> : null}
      </div>
    </section>
  );
}

export function Footer({ props }: { props: Props }) {
  const items = links(props, 'links');
  return (
    <footer className="sa-footer">
      <div className="sa-shell">
        <div className="sa-footer-top">
          <div>
            <span className="sa-wordmark">
              <Facet />
              {str(props, 'logoText')}
            </span>
            <p className="sa-footer-tagline">{str(props, 'tagline')}</p>
          </div>
          <nav className="sa-footer-links" aria-label="Rodapé">
            {items.map((item) => (
              <SiteLink key={item.href} href={item.href}>
                {item.label}
              </SiteLink>
            ))}
          </nav>
        </div>
        <div className="sa-footer-bottom">
          <span>
            © {new Date().getFullYear()} {str(props, 'legal')}
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Contato permanente. O ícone é escuro: branco sobre este verde reprova AA. */
export function FloatingWhatsapp({ href }: { href: string }) {
  return (
    <a
      className="sa-wa"
      href={href}
      rel="noreferrer"
      data-track="whatsapp"
      aria-label="Falar no WhatsApp"
    >
      <svg
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="currentColor"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.1.6 2.8.5a2.4 2.4 0 0 0 1.6-1.1 2 2 0 0 0 .1-1.1c0-.2-.2-.2-.5-.4Z" />
      </svg>
    </a>
  );
}
