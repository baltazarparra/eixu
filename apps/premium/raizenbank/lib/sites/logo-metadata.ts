import { surfaceOf } from '@/lib/blocks/theme';
import type { BlockInstance, Brand } from '@/lib/types';

export function logoThemeColor(brand: Brand, blocks: BlockInstance[]): string {
  const nav = blocks.find((block) => block.type === 'nav.bar');
  const presentation = nav?.props.presentation as
    | { tone?: string; background?: string }
    | undefined;
  const layout =
    typeof nav?.props.layout === 'string'
      ? nav.props.layout
      : brand.design?.navigation;
  return surfaceOf(
    brand,
    presentation?.tone,
    presentation?.background,
    nav ? layout : undefined,
  );
}

export function siteOrigin(host: string): string {
  const hostname = host.split(':')[0];
  return `${hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' ? 'http' : 'https'}://${host}`;
}
