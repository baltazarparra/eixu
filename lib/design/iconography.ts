import type { Vibe } from './vibes';

/** Símbolos semânticos, nunca SVG/URL arbitrário produzido pelo agente. */
export const ICON_NAMES = [
  'arrow-up-right',
  'arrow-right',
  'plus',
  'check',
  'quote',
  'phone',
  'mail',
  'pin',
  'chat',
  'route',
  'compass',
  'layers',
  'book',
  'leaf',
  'sun',
  'lightning',
  'globe',
  'tools',
  'chart',
  'handshake',
  'heart',
  'shield',
  'clock',
  'palette',
  'camera',
  'cube',
] as const;
export type SiteIconName = (typeof ICON_NAMES)[number];

export const ICON_STYLE = {
  comercial: { weight: 'regular', label: 'linear acolhedora', motion: 'lift' },
  moderno: { weight: 'light', label: 'linear técnica', motion: 'nudge' },
  ousado: { weight: 'bold', label: 'gráfica de traço forte', motion: 'push' },
  artistico: { weight: 'duotone', label: 'duotone orgânica', motion: 'tilt' },
} as const satisfies Record<
  Vibe,
  { weight: string; label: string; motion: string }
>;
