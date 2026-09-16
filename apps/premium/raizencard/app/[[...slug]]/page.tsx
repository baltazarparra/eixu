import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { RenderBlocks } from '@/lib/blocks/render';
import { renderedDesignVersionOf, themeVars } from '@/lib/blocks/theme';
import { renderedMotif, renderingVibeOf } from '@/lib/design/vibes';
import {
  hasReferenceDirection,
  referenceAspects,
} from '@/lib/design/references';
import { currentLogoAsset } from '@/lib/images/logo-schema';
import { logoThemeColor } from '@/lib/sites/logo-metadata';
import { structuredData } from '@/lib/sites/structured-data';
import { attributionScript } from '@/lib/tracking';
import { pages, posts, tenant } from '@/content/site';
import { RaizenCardHome } from '@/app/raizen-card-home';

type Props = { params: Promise<{ slug?: string[] }> };
const origin = `https://${tenant.slug}.eixu.com.br`;

function resolvePage(parts: string[] = []) {
  return pages.find((page) => page.slug === parts.join('/'));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = resolvePage((await params).slug);
  if (!page) return { title: 'Página não encontrada' };
  const seo = page.seo ?? {};
  const title = seo.title || page.title;
  const noindex =
    seo.noindex || page.type === 'thank_you' || page.type === 'paid_lp';
  const canonical =
    seo.canonical || (page.slug ? `${origin}/${page.slug}` : `${origin}/`);
  const asset = currentLogoAsset(tenant.brand);
  return {
    metadataBase: new URL(origin),
    title,
    description: seo.description,
    robots: noindex ? { index: false, follow: false } : undefined,
    alternates: { canonical },
    ...(asset
      ? {
          icons: {
            icon: [
              ...(asset.icon.svg
                ? [
                    {
                      url: asset.icon.svg,
                      sizes: 'any',
                      type: 'image/svg+xml',
                    },
                  ]
                : []),
              {
                url: asset.icon.png32,
                sizes: '32x32',
                type: 'image/png',
              },
              {
                url: asset.icon.png192,
                sizes: '192x192',
                type: 'image/png',
              },
            ],
            apple: [
              {
                url: asset.icon.apple180,
                sizes: '180x180',
                type: 'image/png',
              },
            ],
          },
          manifest: '/manifest.webmanifest',
        }
      : {}),
    twitter: {
      card: asset ? 'summary_large_image' : 'summary',
      title,
      description: seo.description,
      ...(asset ? { images: [asset.og.url] } : {}),
    },
    openGraph: {
      url: canonical,
      title,
      description: seo.description,
      type: page.type === 'post' ? 'article' : 'website',
      locale: tenant.locale.replace('-', '_'),
      siteName: tenant.name,
      ...(asset
        ? {
            images: [
              {
                url: asset.og.url,
                width: 1200,
                height: 630,
                alt: `Logo de ${tenant.name}`,
              },
            ],
          }
        : {}),
    },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const page = resolvePage((await params).slug);
  return page ? { themeColor: logoThemeColor(tenant.brand, page.blocks) } : {};
}

export default async function PremiumPage({ params }: Props) {
  const page = resolvePage((await params).slug);
  if (!page) notFound();
  const referenceDirected = hasReferenceDirection(tenant.brand);
  const designVersion = tenant.brand.design?.version;
  const modulated = [4, 5, 6].includes(designVersion ?? 0) && referenceDirected;
  const aspects = modulated
    ? [...referenceAspects(tenant.brand)]
        .sort((left, right) => left.localeCompare(right))
        .join(' ')
    : undefined;
  const pagePath = `/${page.slug}`;
  const pageContent =
    page.slug === '' ? (
      <RaizenCardHome />
    ) : (
      <RenderBlocks
        blocks={page.blocks}
        ctx={{
          tenant,
          posts,
          pagePath,
          pageType: page.type,
        }}
      />
    );
  return (
    <div
      className="site-theme"
      style={themeVars(tenant.brand) as React.CSSProperties}
      data-variance={tenant.dials.variance <= 3 ? 'quiet' : 'expressive'}
      data-density={
        tenant.dials.density <= 3
          ? 'airy'
          : tenant.dials.density >= 8
            ? 'compact'
            : 'normal'
      }
      data-motion={tenant.dials.motion <= 3 ? 'still' : 'gentle'}
      data-vibe={renderingVibeOf(tenant.brand)}
      data-reference-direction={referenceDirected ? 'true' : undefined}
      data-visual-authority={
        designVersion === 6 && referenceDirected ? 'reference' : 'vibe'
      }
      data-design-version={renderedDesignVersionOf(tenant.brand)}
      data-profile-version={designVersion}
      data-structure={tenant.brand.design?.structure}
      data-reference-aspects={aspects || undefined}
      data-hero={tenant.brand.design?.heroComposition}
      data-navigation={tenant.brand.design?.navigation}
      data-rhythm={tenant.brand.design?.rhythm}
      data-imagery={tenant.brand.design?.imageTreatment}
      data-surface={tenant.brand.design?.surfaceStyle}
      data-motif={renderedMotif(tenant.brand)}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            structuredData(tenant, page, false, origin),
          ).replace(/</g, '\\u003c'),
        }}
      />
      {pageContent}
      <script
        dangerouslySetInnerHTML={{
          __html: attributionScript(tenant.slug, pagePath),
        }}
      />
    </div>
  );
}
