// oxlint-disable next/no-img-element -- As fotos vêm do Blob, que não gera
// variantes por tamanho: `next/image` não teria de onde montar um srcset e só
// acrescentaria um salto de otimização. O enquadramento é feito em CSS, a
// abertura carrega com prioridade e o resto é lazy.
import { mapsDirectionsUrl, mapsEmbedUrl } from '@/lib/tenant-contacts';
import { Facet, Seal } from './nav';
import { SiteLink } from './site-link';
import { link, links, list, ordinal, str, strings, type Link } from './props';

type Props = Record<string, unknown>;

/** O rótulo entre parênteses: a garra que segura a pedra, desenhada em letra. */
function Eyebrow({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p className="sa-eyebrow">
      <i aria-hidden="true">(</i>
      {children}
      <i aria-hidden="true">)</i>
    </p>
  );
}

function Action({ to, kind }: { to: Link; kind: 'solid' | 'ghost' }) {
  return (
    <SiteLink className="sa-action" data-kind={kind} href={to.href}>
      {to.label}
      {kind === 'solid' ? <Seal /> : null}
    </SiteLink>
  );
}

/**
 * Abertura da home. O nome da casa ocupa a largura da página em capitular
 * romana, a luz da gema abre atrás dele e a peça aparece logo abaixo, sob o
 * arco — a ordem com que alguém chega a uma vitrine: o nome, depois a joia.
 */
export function Hero({ props }: { props: Props }) {
  const image = str(props, 'image');
  const cta = link(props, 'cta');
  const secondary = link(props, 'secondary');
  const bullets = strings(props, 'bullets');
  return (
    <section className="sa-section sa-hero">
      <div className="sa-bloom" aria-hidden="true" />
      <div className="sa-shell sa-hero-inner">
        <Eyebrow>{str(props, 'eyebrow')}</Eyebrow>
        <h1 className="sa-display sa-h1">{str(props, 'headline')}</h1>
        <p className="sa-lede">{str(props, 'subtext')}</p>
        <div className="sa-hero-actions">
          {cta ? <Action to={cta} kind="solid" /> : null}
          {secondary ? <Action to={secondary} kind="ghost" /> : null}
        </div>
      </div>
      {image ? (
        <div className="sa-arc">
          <img
            src={image}
            alt={str(props, 'imageAlt')}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      ) : null}
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

/**
 * Abertura das páginas internas: só tipografia. O recuo da primeira linha
 * escalona o título quando a página pede presença; a página de contato abre
 * centrada, porque ali o texto é um convite e não um cartaz.
 */
export function Opening({ props }: { props: Props }) {
  const cta = link(props, 'cta');
  const align = str(props, 'layout') === 'center' ? 'center' : 'start';
  return (
    <section className="sa-section sa-opening" data-align={align}>
      <div className="sa-bloom" aria-hidden="true" />
      <div className="sa-shell">
        <Eyebrow>{str(props, 'eyebrow')}</Eyebrow>
        <h1 className="sa-display sa-h1">{str(props, 'headline')}</h1>
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
 * A lapidação. Capítulo escuro porque é aqui que a peça aparece: as fotos do
 * cliente são joias acesas sobre pedra, e o fundo claro as devolveria como
 * dois retângulos pretos. As placas saem do esquadro de propósito.
 */
export function Vitrine({ props }: { props: Props }) {
  const images = list(props, 'images');
  const [first, second] = images;
  return (
    <section className="sa-section sa-reveal" data-tone="ink">
      <div className="sa-shell">
        {/* Sem rótulo inventado: o título já nomeia a seção. */}
        <h2 className="sa-display sa-h2 sa-cut-title">{str(props, 'title')}</h2>
        <div className="sa-plates">
          {first ? (
            <figure className="sa-plate" data-tilt="a">
              <img
                src={str(first, 'src')}
                alt={str(first, 'alt')}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ) : null}
          {second ? (
            <figure className="sa-plate" data-tilt="b">
              <img
                src={str(second, 'src')}
                alt={str(second, 'alt')}
                loading="lazy"
                decoding="async"
              />
            </figure>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * A peça sob o vidro curvo: foto de ponta a ponta. A legenda fica embaixo,
 * na margem clara — etiqueta de mostruário, não texto sobre a joia, que
 * dependeria da luminosidade da foto para ser legível.
 */
export function ArcPhoto({ props }: { props: Props }) {
  const caption = str(props, 'caption');
  return (
    <section className="sa-section sa-reveal">
      <figure className="sa-arc-figure">
        <div className="sa-arc">
          <img
            src={str(props, 'src')}
            alt={str(props, 'alt')}
            loading="lazy"
            decoding="async"
          />
        </div>
        {caption ? (
          <figcaption className="sa-shell sa-caption">
            <span>{caption}</span>
          </figcaption>
        ) : null}
      </figure>
    </section>
  );
}

/**
 * A ficha de rigor: quatro entradas numeradas com fio de ouro entre elas —
 * o vocabulário de quem cataloga pedra, não ícones de biblioteca.
 */
export function Ledger({ props }: { props: Props }) {
  const items = list(props, 'items');
  const lead = str(props, 'lead');
  return (
    <section className="sa-section sa-reveal">
      <div className="sa-shell">
        <div className="sa-head" data-split={lead ? '' : undefined}>
          <div>
            <Eyebrow>{str(props, 'eyebrow')}</Eyebrow>
            <h2 className="sa-display sa-h2">{str(props, 'title')}</h2>
          </div>
          {lead ? <p className="sa-body">{lead}</p> : null}
        </div>
        <div className="sa-ledger">
          {items.map((item, index) => {
            const href = str(item, 'href');
            const title = str(item, 'title');
            return (
              <article className="sa-ledger-item" key={title}>
                <span className="sa-ledger-n" aria-hidden="true">
                  {ordinal(index)}
                </span>
                <div>
                  <h3 className="sa-h3">
                    {href ? (
                      <SiteLink href={href}>{title}</SiteLink>
                    ) : (
                      <>{title}</>
                    )}
                  </h3>
                  <p>{str(item, 'body')}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/**
 * O catálogo. Cada categoria ocupa uma gaveta inteira do mostruário, com o
 * nome em corpo de cartaz e a descrição na coluna oposta — o gesto que
 * separa uma vitrine de uma lista de produtos.
 */
export function Catalog({ props }: { props: Props }) {
  const items = list(props, 'items');
  return (
    <section className="sa-section sa-reveal" data-tone="ink">
      <div className="sa-shell">
        <div className="sa-head">
          <div>
            <Eyebrow>{str(props, 'eyebrow')}</Eyebrow>
            <h2 className="sa-display sa-h2">{str(props, 'title')}</h2>
          </div>
        </div>
        <ul className="sa-catalog">
          {items.map((item) => (
            <li key={str(item, 'title')}>
              <h3 className="sa-display sa-catalog-name">
                {str(item, 'title')}
              </h3>
              <p>{str(item, 'body')}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A sala de recepção, em papel branco: o plano mais claro do site, onde o
 * texto convida a entrar na loja e os dados práticos ficam à mão.
 */
export function Room({ props }: { props: Props }) {
  const facts = list(props, 'facts');
  return (
    <section className="sa-section sa-reveal">
      <div className="sa-shell sa-room">
        <div>
          <Eyebrow>{str(props, 'eyebrow')}</Eyebrow>
          <h2 className="sa-display sa-h2">{str(props, 'title')}</h2>
          <p className="sa-body">{str(props, 'body')}</p>
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
    <section className="sa-section sa-reveal" data-tone="ink">
      <div className="sa-shell">
        <div className="sa-head">
          <div>
            <Eyebrow>{str(props, 'eyebrow')}</Eyebrow>
            <h2 className="sa-display sa-h2">{str(props, 'title')}</h2>
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
    <section className="sa-section sa-reveal">
      <div className="sa-shell sa-faq-grid">
        <div>
          <h2 className="sa-display sa-h2" data-scale="tight">
            {str(props, 'title')}
          </h2>
        </div>
        <div className="sa-faq">
          {items.map((item) => (
            <details key={str(item, 'q')}>
              <summary>
                {str(item, 'q')}
                <i aria-hidden="true" />
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
    <section className="sa-section sa-reveal" id="onde-estamos">
      <div className="sa-shell sa-where">
        <div>
          <h2 className="sa-display sa-h2">Onde estamos</h2>
          <address className="sa-address">{address}</address>
          <div>
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
    <section className="sa-section sa-close" data-tone="ink">
      <div className="sa-bloom" aria-hidden="true" />
      <div className="sa-shell">
        <h2 className="sa-display sa-h2">{str(props, 'title')}</h2>
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
              <Facet size={20} />
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
