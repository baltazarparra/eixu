import { z } from 'zod';

export const STUDIO_DIRECTIONS = [
  'comercial',
  'moderno',
  'ousado',
  'artistico',
  'landing',
] as const;

export const studioDirectionSchema = z.enum(STUDIO_DIRECTIONS);
export type StudioDirection = z.infer<typeof studioDirectionSchema>;

export const STUDIO_DIRECTION_LABEL: Record<StudioDirection, string> = {
  comercial: 'Comercial',
  moderno: 'Moderno',
  ousado: 'Ousado',
  artistico: 'Artístico',
  landing: 'Landing Page',
};

export const STUDIO_DIRECTION_HINT: Record<StudioDirection, string> = {
  comercial: 'Claro, direto e orientado à decisão.',
  moderno: 'Preciso, tecnológico e com ritmo editorial.',
  ousado: 'Contraste alto, escala expressiva e presença forte.',
  artistico: 'Composição autoral, tátil e menos previsível.',
  landing: 'Uma narrativa focada em uma oferta e uma ação.',
};

export const STUDIO_DIRECTION_REFERENCE: Record<StudioDirection, string> = {
  comercial: 'https://minatelsupermercados.com.br/brotas',
  moderno: 'https://reflect.app/',
  ousado: 'https://manesco.com.br/',
  artistico: 'https://actionline.io/',
  landing: 'https://nubank.com.br/ultravioleta',
};

export const STUDIO_DIRECTION_PALETTE: Record<
  StudioDirection,
  { primary: string; secondary: string; highlight: string }
> = {
  comercial: { primary: '#1f6feb', secondary: '#dbeafe', highlight: '#b45309' },
  moderno: { primary: '#5b63d6', secondary: '#1b1e24', highlight: '#c9d1ff' },
  ousado: { primary: '#ff3d00', secondary: '#111111', highlight: '#ff3d00' },
  artistico: { primary: '#8b5e3c', secondary: '#eadbc8', highlight: '#9d174d' },
  landing: { primary: '#16a34a', secondary: '#ecfdf5', highlight: '#f59e0b' },
};

export function studioDirectionOf(
  brand: Record<string, unknown>,
): StudioDirection {
  const parsed = studioDirectionSchema.safeParse(brand.direction ?? brand.vibe);
  return parsed.success ? parsed.data : 'comercial';
}
