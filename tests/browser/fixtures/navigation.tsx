import { useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import type { LogoAsset, Tenant } from '@/lib/types';

export function NavigationFixture({ query = '' }: { query?: string }) {
  const params = new URLSearchParams(query);
  const count = Number(params.get('count') ?? 2);
  const vibe = params.get('vibe') ?? 'artistico';
  const layout = params.get('layout') ?? 'floating';
  const version = Number(params.get('version') ?? 0);
  const asset = params.has('asset');
  const logo = params.get('logo') ?? (asset ? 'asset' : null);
  const long = params.has('long');
  const preview = params.has('preview');
  const [visible, setVisible] = useState(true);
  const tenant = {
    id: 'fixture',
    slug: 'fixture',
    name: 'Ateliê de teste',
    brand: {
      ink: '#171717',
      paper: '#ffffff',
      accent: '#245b48',
      accentAlt: '#3f665c',
      vibe,
      logoUrl: logo ? `https://assets.test/logo-${logo}.svg` : undefined,
      design:
        version || layout === 'contrast'
          ? {
              version: version || undefined,
              navigation: layout === 'contrast' ? 'contrast' : undefined,
            }
          : undefined,
    },
    dials: { motion: 2, density: 4, variance: 7 },
    contacts: {},
    brief: {},
    imageGuide: {},
  } as Tenant;
  if (asset) {
    const url = 'https://assets.test/nav-asset.png';
    tenant.brand.logoAsset = {
      version: 1,
      source: tenant.brand.logoUrl!,
      sourceHash: '123456789abc',
      background: 'transparent',
      master: { url, width: 384, height: 256 },
      nav: { url, width: 384, height: 256 },
      aspect: 1.5,
      displayHeight: 56,
      preparedAt: '2026-09-12T12:00:00.000Z',
      icon: {
        png32: url,
        png192: url,
        png512: url,
        maskable512: url,
        apple180: url,
      },
      og: { url, width: 1200, height: 630 },
    } satisfies LogoAsset;
  }
  const links = params.has('empty')
    ? []
    : long
      ? [
          { label: 'Soluções para ambientes e projetos', href: '/' },
          {
            label: 'Materiais e possibilidades de aplicação',
            href: '#galeria',
          },
          { label: 'Como escolher o melhor acabamento', href: '#contato' },
          { label: 'Cuidados com seu projeto e conservação', href: '#galeria' },
          {
            label: 'Atendimento e dúvidas sobre os materiais',
            href: '#contato',
          },
        ]
      : [
          { label: 'Início', href: '/' },
          { label: 'Galeria', href: '#galeria' },
          { label: 'Contato', href: '#contato' },
        ];
  if (params.has('fit'))
    links.splice(
      0,
      links.length,
      { label: 'Materiais e detalhes', href: '/' },
      { label: 'Projetos e ambientes', href: '#galeria' },
      { label: 'Cuidados e escolhas', href: '#contato' },
      { label: 'Sobre nosso trabalho', href: '#galeria' },
    );
  return (
    <div
      className="site-theme"
      data-vibe={vibe}
      data-design-version={version || undefined}
      style={themeVars(tenant.brand)}
    >
      {visible && (
        <RenderBlocks
          blocks={[
            {
              id: 'nav',
              type: 'nav.bar',
              props: {
                logoText: long ? 'Arquitetura & Interiores' : 'Ateliê de teste',
                logoHeight:
                  !asset && logo
                    ? Number(params.get('logoHeight') ?? 160)
                    : undefined,
                layout: layout === 'contrast' ? undefined : layout,
                position: params.get('position') ?? 'fixed',
                backgroundOpacity: 88,
                presentation: {
                  tone: 'ink',
                  ...(params.has('panel') ? { edge: 'panel' } : {}),
                },
                links,
                cta: params.has('nocta')
                  ? undefined
                  : {
                      label: long
                        ? 'Conversar sobre materiais e acabamentos'
                        : 'Conversar',
                      href: '#contato',
                    },
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
          ctx={{
            tenant,
            pagePath: '/',
            pageType: 'page',
            previewTenant: preview ? 'fixture' : undefined,
            isPreview: preview,
          }}
        />
      )}
      <button
        id="toggle-navigation"
        type="button"
        onClick={() => setVisible(!visible)}
      >
        Alternar fixture
      </button>
      <div style={{ height: 2000 }} />
    </div>
  );
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('root');
  if (container)
    hydrateRoot(container, <NavigationFixture query={location.search} />);
}
