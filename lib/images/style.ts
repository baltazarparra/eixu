import type { ImageStyle } from '@/lib/types';

/**
 * Vocabulário de estilo dos pedidos de imagem. Fica num módulo folha porque o
 * plano de cenas precisa reconhecer o estilo de uma imagem já gerada, e ele não
 * pode arrastar o gerador — que traz sharp, blob e banco — para o bundle.
 */
export const ESTILO: Record<ImageStyle, string> = {
  fotografia:
    'Fotografia documental, câmera com lente 35mm, profundidade de campo natural',
  ilustracao: 'Ilustração editorial vetorial, traço limpo, sem contorno pesado',
  '3d': 'Render 3D suave, materiais foscos, iluminação de estúdio',
  gravura:
    'Gravura de traço, desenho a bico de pena com hachura fina e monocromática, assunto isolado e recortado, sem cenário ao redor',
};

/** As negativas de fotografia não servem a um desenho e vice-versa. */
export const NEGATIVAS: Record<ImageStyle, readonly string[]> = {
  fotografia: ['sem cara de banco de imagens, sem pose artificial'],
  ilustracao: ['sem cara de banco de imagens'],
  '3d': ['sem cara de banco de imagens'],
  gravura: [
    'sem fotografia, sem render, sem textura fotográfica',
    'sem cenário, sem chão, sem sombra projetada',
    'sem preenchimento de cor chapada no fundo',
  ],
};

export const TRANSPARENTE =
  'Fundo totalmente transparente, sem cor de fundo, com a arte recortada até a borda do traço';

export const ESTILOS = Object.keys(ESTILO) as ImageStyle[];

/** O guia vem de JSONB sem validação: um valor fora da união não pode quebrar. */
export function knownStyle(value: unknown): ImageStyle | undefined {
  return typeof value === 'string' && (ESTILOS as string[]).includes(value)
    ? (value as ImageStyle)
    : undefined;
}

/**
 * O estilo com que uma imagem foi pedida, lido do prompt guardado na linha.
 * `composePrompt` escreve a frase de estilo como primeira parte, então o
 * prefixo identifica a natureza sem precisar de coluna nova.
 */
export function styleOfPrompt(
  promptFinal?: string | null,
): ImageStyle | undefined {
  if (!promptFinal) return undefined;
  return ESTILOS.find((estilo) => promptFinal.startsWith(ESTILO[estilo]));
}

/** Se a arte foi pedida recortada, sem fundo. */
export function transparentPrompt(promptFinal?: string | null): boolean {
  return Boolean(promptFinal?.includes(TRANSPARENTE));
}
