'use client';

import { SiteIcon } from './icon';
import type { Vibe } from '@/lib/design/vibes';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  mapsDirectionsUrl,
  mapsEmbedUrl,
  type Address,
} from '@/lib/tenant-contacts';

/**
 * Troca entre endereços sem carregar um mapa por unidade. Sem JavaScript, o
 * conteúdo continua legível: os endereços e os links de rota ficam no HTML.
 */
export function LocationPicker({
  addresses,
  vibe = 'comercial',
}: {
  addresses: Address[];
  vibe?: Vibe;
}) {
  const id = useId();
  const [selected, select] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = addresses[selected];

  function navigate(event: KeyboardEvent, index: number) {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % addresses.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + addresses.length) % addresses.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? addresses.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="site-location-grid">
      <div className="site-location-info">
        <div
          className="site-location-tabs"
          role="tablist"
          aria-label="Endereços"
        >
          {addresses.map((address, index) => (
            <button
              key={address.text}
              type="button"
              role="tab"
              ref={(element) => {
                tabs.current[index] = element;
              }}
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel`}
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              onKeyDown={(event) => navigate(event, index)}
              onClick={() => select(index)}
            >
              <SiteIcon name="pin" vibe={vibe} size={18} />
              {address.label || `Endereço ${index + 1}`}
            </button>
          ))}
        </div>
        <div
          id={`${id}-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${selected}`}
        >
          <address className="site-location-address">{current.text}</address>
          <a
            className="site-location-route"
            href={mapsDirectionsUrl(current.text)}
            rel="noreferrer"
          >
            Como chegar <SiteIcon name="route" vibe={vibe} size={18} />
          </a>
        </div>
        <noscript>
          <ul className="site-location-list">
            {addresses.map((address) => (
              <li key={address.text}>
                <address>{address.text}</address>
                <a href={mapsDirectionsUrl(address.text)} rel="noreferrer">
                  Como chegar <SiteIcon name="route" vibe={vibe} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </noscript>
      </div>
      <div className="site-location-map">
        <iframe
          title={`Mapa de ${current.text}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapsEmbedUrl(current.text)}
        />
      </div>
    </div>
  );
}
