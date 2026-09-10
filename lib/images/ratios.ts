/**
 * Proporções por bloco. O renderizador recorta com object-cover, então o que
 * importa é a imagem nascer com a orientação certa: retrato para o hero,
 * paisagem para imagem solta e galeria.
 */
export const RATIO_BY_BLOCK: Record<string, Ratio> = {
  'hero.split': '4:5',
  'hero.cover': '16:9',
  'hero.poster': '4:5',
  'hero.editorial': '16:9',
  'hero.offset': '4:5',
  'hero.atelier': '4:5',
  'narrative.split': '5:6',
  'feature.bento': '4:3',
  'feature.explorer': '4:3',
  'media.image': '16:9',
  'media.gallery': '4:3',
  livre: '1:1',
};

export const RATIOS = ['4:5', '5:6', '16:9', '4:3', '1:1'] as const;
export type Ratio = (typeof RATIOS)[number];

export type TargetBlock = keyof typeof RATIO_BY_BLOCK;

/** Dica de composição, para o assunto sobreviver ao recorte de cada bloco. */
export const FRAMING: Record<string, string> = {
  'hero.split':
    'enquadramento vertical, assunto no terço superior, área respirável em volta',
  'hero.cover':
    'enquadramento panorâmico, assunto no terço direito e área limpa à esquerda para texto',
  'hero.poster':
    'enquadramento vertical gráfico, assunto inteiro e silhueta legível',
  'hero.editorial':
    'enquadramento panorâmico documental, cena com profundidade e leitura lateral',
  'hero.offset':
    'enquadramento vertical, assunto descentralizado e espaço negativo intencional',
  'hero.atelier':
    'enquadramento vertical de ambiente ou produto com materialidade, profundidade e margens para recorte',
  'feature.explorer':
    'cena de aplicação em paisagem, assunto legível ao lado de descrição; sem texto na foto',
  'narrative.split': 'enquadramento vertical fechado no assunto',
  'feature.bento':
    'enquadramento paisagem, assunto único e recorte forte em tamanhos variados',
  'media.image': 'enquadramento panorâmico, assunto centralizado',
  'media.gallery':
    'enquadramento paisagem, assunto único e legível em miniatura',
  livre: 'enquadramento quadrado equilibrado',
};

/**
 * Sempre `size`, nunca `aspectRatio`.
 *
 * Testado no gateway: `aspectRatio` é ignorado em silêncio pelo flux, que
 * devolve quadrado sem emitir aviso, e a Bytedance recusa o parâmetro. Já
 * `size` funciona nos três: a OpenAI aceita a lista fixa dela e a BFL deriva a
 * proporção do tamanho. Passar pixels é o único caminho previsível.
 */
export function dimensionsFor(
  model: string,
  ratio: Ratio,
): { size: `${number}x${number}` } {
  const portrait = ratio === '4:5' || ratio === '5:6';
  const landscape = ratio === '16:9' || ratio === '4:3';

  if (model.startsWith('openai/')) {
    // A OpenAI só aceita estes três tamanhos.
    if (portrait) return { size: '1024x1536' };
    if (landscape) return { size: '1536x1024' };
    return { size: '1024x1024' };
  }

  // A Bytedance recusa qualquer coisa abaixo de 3,7 megapixels.
  if (model.startsWith('bytedance/')) {
    const big: Record<Ratio, `${number}x${number}`> = {
      '4:5': '1728x2160',
      '5:6': '1664x1996',
      '16:9': '2560x1440',
      '4:3': '2304x1728',
      '1:1': '1920x1920',
    };
    return { size: big[ratio] };
  }

  const byRatio: Record<Ratio, `${number}x${number}`> = {
    '4:5': '1024x1280',
    '5:6': '1024x1216',
    '16:9': '1536x864',
    '4:3': '1536x1152',
    '1:1': '1024x1024',
  };
  return { size: byRatio[ratio] };
}

export function ratioForBlock(block: string | undefined): Ratio {
  return RATIO_BY_BLOCK[block ?? 'livre'] ?? '1:1';
}
