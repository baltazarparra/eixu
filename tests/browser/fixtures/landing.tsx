import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { themeVars } from '@/lib/blocks/theme';
import { landingFixture } from '@/tests/helpers/landing-data';

export function LandingFixture({
  query = '',
  origin = 'http://localhost',
}: {
  query?: string;
  origin?: string;
}) {
  const params = new URLSearchParams(query);
  const layout = params.get('layout') === 'form' ? 'form' : 'stage';
  const f = landingFixture(layout, params.has('steps') ? 'steps' : 'tabs');
  const page = f.pages[params.has('thanks') ? 1 : 0];
  const blocks = JSON.parse(
    JSON.stringify(page.blocks).replaceAll(
      'https://assets.test/',
      `${origin}/fixture-media/`,
    ),
  );
  if (params.has('dark'))
    Object.assign(f.tenant.brand, {
      ink: '#f5f5f5',
      paper: '#101719',
      surface: '#172224',
    });
  return (
    <div
      className="site-theme"
      data-vibe="landing"
      data-density="comfortable"
      style={themeVars(f.tenant.brand)}
    >
      <RenderBlocks
        blocks={blocks}
        ctx={{
          tenant: f.tenant,
          pagePath: `/${page.slug}`,
          pageType: page.type,
          isPreview: params.has('preview'),
          editing: params.has('editing'),
        }}
      />
    </div>
  );
}
if (typeof window !== 'undefined') {
  const root = document.getElementById('root');
  if (root)
    hydrateRoot(
      root,
      <LandingFixture
        query={window.location.search}
        origin={window.location.origin}
      />,
    );
}
