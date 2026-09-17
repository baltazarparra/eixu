import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { currentLogoAsset } from '@/lib/images/logo-schema';
import { structuredData } from '@/lib/sites/structured-data';
import { attributionScript } from '@/lib/tracking';
import { pages, tenant } from '@/content/site';
import { applyPremiumValues, loadPremiumContent } from '@/lib/premium-content';
import { PremiumPreviewReporter } from '@/app/premium-preview';
import { Compose } from '@/lib/safira/compose';

type Props = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{
    eixu_preview?: string | string[];
    eixu_request?: string | string[];
    eixu_scroll?: string | string[];
  }>;
};
const origin = `https://${tenant.slug}.eixu.com.br`;

function resolvePage(parts: string[] = []) {
  return pages.find((page) => page.slug === parts.join('/'));
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const page = resolvePage((await params).slug);
  if (!page) return { title: 'Página não encontrada' };
  const seo = page.seo ?? {};
  const title = seo.title || page.title;
  const preview = typeof (await searchParams).eixu_preview === 'string';
  const noindex =
    preview ||
    seo.noindex ||
    page.type === 'thank_you' ||
    page.type === 'paid_lp';
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

/* O campo é mineral em todas as páginas: a barra do sistema acompanha. */
export const viewport: Viewport = {
  themeColor: '#0c0a1a',
};

export default async function PremiumPage({ params, searchParams }: Props) {
  const { slug = [] } = await params;
  const query = await searchParams;
  const previewToken =
    typeof query.eixu_preview === 'string' ? query.eixu_preview : undefined;
  const content = await loadPremiumContent(tenant.slug, previewToken);
  const renderedPages = applyPremiumValues(pages, content.values);
  const page = renderedPages.find(
    (candidate) => candidate.slug === slug.join('/'),
  );
  if (!page) notFound();
  const pagePath = `/${page.slug}`;
  return (
    <div className="sa">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            structuredData(tenant, page, false, origin),
          ).replace(/</g, '\\u003c'),
        }}
      />
      <Compose blocks={page.blocks} tenant={tenant} pagePath={pagePath} />
      {!previewToken ? (
        <script
          dangerouslySetInnerHTML={{
            __html: attributionScript(tenant.slug, pagePath),
          }}
        />
      ) : null}
      <PremiumPreviewReporter
        enabled={Boolean(previewToken)}
        adminOrigin={
          new URL(process.env.EIXU_PLATFORM_URL || 'https://eixu.com.br').origin
        }
        revision={content.revision}
        requestId={
          typeof query.eixu_request === 'string' ? query.eixu_request : ''
        }
        initialScroll={
          typeof query.eixu_scroll === 'string'
            ? Number(query.eixu_scroll) || 0
            : 0
        }
      />
    </div>
  );
}
