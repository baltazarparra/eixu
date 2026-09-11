import { createRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import type { Tenant } from '@/lib/types';

const count = Number(new URLSearchParams(location.search).get('count') ?? 2);
const tenant = {
  id: 'fixture',
  slug: 'fixture',
  name: 'Ateliê de teste',
  brand: {
    ink: '#171717',
    paper: '#ffffff',
    accent: '#245b48',
    accentAlt: '#3f665c',
    vibe: 'artistico',
  },
  dials: { motion: 2, density: 4, variance: 7 },
  contacts: {},
  brief: {},
  imageGuide: {},
} as Tenant;
createRoot(document.getElementById('root')!).render(
  <div
    className="site-theme"
    data-vibe="artistico"
    style={themeVars(tenant.brand)}
  >
    <RenderBlocks
      blocks={[
        {
          id: 'nav',
          type: 'nav.bar',
          props: {
            logoText: 'Ateliê de teste',
            layout: 'floating',
            position: 'fixed',
            backgroundOpacity: 88,
            presentation: { tone: 'ink' },
            links: [
              { label: 'Galeria', href: '#galeria' },
              { label: 'Contato', href: '#contato' },
            ],
            cta: { label: 'Conversar', href: '#contato' },
          },
        },
        {
          id: 'gallery',
          type: 'media.gallery',
          props: {
            anchor: 'galeria',
            layout: 'filmstrip',
            title: 'Arte e joalheria no ateliê',
            images: Array.from({ length: count }, (_, index) => ({
              src: `https://assets.test/${index}.svg`,
              alt: `Imagem de teste ${index + 1}`,
            })),
          },
        },
        {
          id: 'contact',
          type: 'editorial.text',
          props: {
            anchor: 'contato',
            title: 'Contato',
            body: 'Informações de contato para esta fixture.',
          },
        },
      ]}
      ctx={{ tenant, pagePath: '/', pageType: 'page' }}
    />
    <div style={{ height: 2000 }} />
  </div>,
);
