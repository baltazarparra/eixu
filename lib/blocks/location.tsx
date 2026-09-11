import { LocationPicker } from '@/lib/blocks/location-picker';
import {
  mapsDirectionsUrl,
  mapsEmbedUrl,
  type Contacts,
} from '@/lib/tenant-contacts';

/**
 * Seção de localização montada a partir do cadastro, não do catálogo de
 * blocos. Ela sai logo acima do rodapé em toda página comum que tenha
 * endereço, como o botão flutuante de WhatsApp: é dado do operador, não
 * composição do agente, então não entra em `pages.blocks` nem no pre-flight.
 */
export function SiteLocation({ contacts }: { contacts: Contacts }) {
  const addresses = contacts.addresses;
  if (!addresses.length) return null;
  const single = addresses[0];
  return (
    <section className="site-section site-location">
      <div className="site-shell mx-auto w-full max-w-[var(--site-max,76rem)] px-6 md:px-10">
        <h2 className="site-h2 site-location-title">Onde estamos</h2>
        {addresses.length > 1 ? (
          <LocationPicker addresses={addresses} />
        ) : (
          <div className="site-location-grid">
            <div className="site-location-info">
              {single.label ? (
                <h3 className="site-location-label">{single.label}</h3>
              ) : null}
              <address className="site-location-address">{single.text}</address>
              <a
                className="site-location-route"
                href={mapsDirectionsUrl(single.text)}
                rel="noreferrer"
              >
                Como chegar
              </a>
            </div>
            <div className="site-location-map">
              <iframe
                title={`Mapa de ${single.text}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={mapsEmbedUrl(single.text)}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
