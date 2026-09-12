import { useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RenderBlocks } from '@/lib/blocks/render';
import { InlineEditor } from '@/lib/blocks/inline-editor';
import type { InlineEditorProps } from '@/lib/blocks/edit-protocol';
import type { BlockInstance, Tenant } from '@/lib/types';

export type InlineFixtureData = {
  tenant: Tenant;
  blocks: BlockInstance[];
  theme: Record<string, string>;
  editor: InlineEditorProps;
  editing: boolean;
};
export function InlineFixture({ data }: { data: InlineFixtureData }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true';
  }, []);
  return (
    <div
      className="site-theme"
      data-vibe={data.tenant.brand.vibe}
      data-design-version={data.tenant.brand.design?.version}
      data-editing={data.editing || undefined}
      data-motion="still"
      style={data.theme}
    >
      <RenderBlocks
        blocks={data.blocks}
        ctx={{
          tenant: data.tenant,
          pagePath: '/',
          isPreview: data.editing,
          editing: data.editing,
        }}
      />
      {data.editing && <InlineEditor {...data.editor} />}
    </div>
  );
}
const state =
  typeof document !== 'undefined' &&
  document.getElementById('inline-fixture-data');
if (state)
  hydrateRoot(
    document.getElementById('root')!,
    <InlineFixture data={JSON.parse(state.textContent ?? '{}')} />,
  );
