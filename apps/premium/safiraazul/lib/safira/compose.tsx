import type { BlockInstance, Tenant } from '@/lib/types';
import { contactsOf } from '@/lib/tenant-contacts';
import { SiteAttribution } from '@/lib/sites/site-attribution';
import { SiteNav } from './nav';
import {
  Close,
  Faq,
  FloatingWhatsapp,
  Footer,
  Hero,
  Ledger,
  Opening,
  Room,
  Steps,
  Vitrine,
  Where,
  WidePhoto,
} from './sections';
import { links, str } from './props';

/**
 * Composição da Safira Azul.
 *
 * Lê os mesmos blocos de `content/site.json` — com os valores que o operador
 * publicou pelo CMS já aplicados — e os apresenta na direção do projeto. O
 * contrato editorial aponta para `{page, block, path}`, não para o desenho,
 * então trocar a apresentação não move nenhuma chave de `content/editor.json`.
 */
export function Compose({
  blocks,
  tenant,
  pagePath,
}: {
  blocks: BlockInstance[];
  tenant: Tenant;
  pagePath: string;
}) {
  const nav = blocks.find((block) => block.type === 'nav.bar');
  const footer = blocks.find((block) => block.type.startsWith('footer.'));
  const body = blocks.filter(
    (block) =>
      block !== nav && block !== footer && !block.type.startsWith('nav.'),
  );

  const contacts = contactsOf(tenant.contacts, tenant.whatsapp);
  const address = contacts.addresses[0]?.text ?? '';
  const whatsappHref = tenant.whatsapp
    ? `/go/wa?from=${encodeURIComponent(pagePath)}`
    : '';

  /*
   * A localização com mapa fica na página que existe para localizar. Nas
   * outras, o endereço já aparece nos fatos e no rodapé: um terceiro mapa
   * não ajudaria ninguém a decidir.
   */
  const showWhere = Boolean(address) && pagePath === '/contato';

  /* O fechamento é sempre o último bloco do miolo; o mapa entra antes dele. */
  const closing = body.at(-1);
  const closesWithCta = closing?.type === 'cta.band';
  const middle = closesWithCta ? body.slice(0, -1) : body;

  return (
    <>
      <a className="sa-skip" href="#conteudo">
        Ir ao conteúdo
      </a>

      {nav ? (
        <SiteNav
          wordmark={str(nav.props, 'logoText') || tenant.name}
          navLinks={links(nav.props, 'links')}
          whatsapp={
            whatsappHref ? { href: whatsappHref, label: 'WhatsApp' } : null
          }
          pagePath={pagePath}
        />
      ) : null}

      <main id="conteudo">
        {middle.map((block) => (
          <Section key={block.id} block={block} />
        ))}
        {showWhere ? <Where address={address} /> : null}
        {closesWithCta && closing ? <Close props={closing.props} /> : null}
      </main>

      {footer ? <Footer props={footer.props} /> : null}
      {whatsappHref ? <FloatingWhatsapp href={whatsappHref} /> : null}
      <SiteAttribution />
    </>
  );
}

function Section({ block }: { block: BlockInstance }) {
  switch (block.type) {
    case 'hero.split':
      return <Hero props={block.props} />;
    case 'hero.statement':
      return <Opening props={block.props} />;
    case 'media.gallery':
      return <Vitrine props={block.props} />;
    case 'media.image':
      return <WidePhoto props={block.props} />;
    case 'feature.numbered':
    case 'feature.bento':
      return <Ledger props={block.props} />;
    case 'editorial.facts':
      return <Room props={block.props} />;
    case 'narrative.steps':
      return <Steps props={block.props} />;
    case 'faq.accordion':
      return <Faq props={block.props} />;
    case 'cta.band':
      return <Close props={block.props} />;
    default:
      return null;
  }
}
