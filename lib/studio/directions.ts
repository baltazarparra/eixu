import { z } from 'zod';

export const STUDIO_DIRECTIONS = ['comercial', 'ousado', 'referencia'] as const;

export const studioDirectionSchema = z.enum(STUDIO_DIRECTIONS);
export type StudioDirection = z.infer<typeof studioDirectionSchema>;

export const STUDIO_DIRECTION_LABEL: Record<StudioDirection, string> = {
  comercial: 'Comercial',
  ousado: 'Ousado',
  referencia: 'Referência',
};

export const STUDIO_DIRECTION_HINT: Record<StudioDirection, string> = {
  comercial: 'Clareza, confiança e uma jornada direta até a decisão.',
  ousado: 'Contraste, composição expressiva e uma presença mais autoral.',
  referencia:
    'O link informado comanda estrutura, ritmo e direção de arte, sem copiar a marca.',
};

export const STUDIO_DIRECTION_REFERENCE: Record<StudioDirection, string> = {
  comercial: 'https://minatelsupermercados.com.br/brotas',
  ousado: 'https://manesco.com.br/',
  // O cadastro exige uma referência própria nesta direção. O fallback existe
  // apenas para manter cadastros legados legíveis até a próxima edição.
  referencia: 'https://www.tasteskill.dev/',
};

export const STUDIO_DIRECTION_PALETTE: Record<
  StudioDirection,
  { primary: string; secondary: string; highlight: string }
> = {
  comercial: { primary: '#1f6feb', secondary: '#dbeafe', highlight: '#b45309' },
  ousado: { primary: '#ff3d00', secondary: '#111111', highlight: '#ff3d00' },
  referencia: {
    primary: '#2f5d50',
    secondary: '#ece8df',
    highlight: '#2f5d50',
  },
};

export function studioDirectionOf(
  brand: Record<string, unknown>,
): StudioDirection {
  const parsed = studioDirectionSchema.safeParse(brand.direction ?? brand.vibe);
  if (parsed.success) return parsed.data;
  // Migração de leitura: valores gravados pela política anterior continuam
  // abrindo sem forçar uma escrita no banco.
  return brand.direction === 'ousado' || brand.direction === 'artistico'
    ? 'ousado'
    : 'comercial';
}
