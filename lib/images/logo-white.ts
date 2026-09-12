import sharp from 'sharp';
import { luminanceOf } from '@/lib/blocks/contrast';

const MAX_SIDE = 1024;
/** Alfa mínimo para um pixel contar como pintado. */
const PAINTED = 16;
/** Luminância a partir da qual o pixel começa a sumir e onde some de vez. */
const CUT_START = 0.7;
const CUT_END = 0.86;

export type WhiteLogo = {
  png: Buffer;
  /** Pixels pintados depois sobre pixels pintados antes. */
  coverage: number;
  width: number;
  height: number;
};

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Versão branca por recorte de luminância: pixel escuro ou colorido vira
 * branco opaco, pixel claro vira transparente, com transição suave entre 0,70
 * e 0,86 para não serrilhar. Isso preserva a silhueta e o texto vazado de uma
 * placa colorida e apaga a placa clara de um arquivo sem alfa. Pintar todo
 * pixel opaco de branco não serve: medido em 12/09/2026, o logo do Fisk (placa
 * vermelha com texto branco) virava um balão branco sem texto. O enquadramento
 * é o do original, para a versão escura ocupar o mesmo espaço na nav.
 *
 * Devolve null quando não sobra arte (tudo era claro) ou quando sobra um
 * bloco (arquivo sem alfa de fundo escuro): nos dois casos a versão precisa
 * ser pedida ao modelo pelo chat.
 */
export async function deriveWhiteLogo(
  bytes: Uint8Array | Buffer,
): Promise<WhiteLogo | null> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  let before = 0;
  let after = 0;
  let edge = 0;
  let edgePainted = 0;
  for (let i = 0, o = 0, p = 0; i < data.length; i += channels, o += 4, p += 1) {
    const alpha = data[i + 3];
    if (alpha >= PAINTED) before += 1;
    const luminance = luminanceOf(data[i], data[i + 1], data[i + 2]);
    const keep = 1 - smoothstep(CUT_START, CUT_END, luminance);
    const value = Math.round(alpha * keep);
    out[o] = 255;
    out[o + 1] = 255;
    out[o + 2] = 255;
    out[o + 3] = value;
    if (value >= PAINTED) after += 1;
    const x = p % width;
    const y = (p - x) / width;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
      edge += 1;
      if (value >= PAINTED) edgePainted += 1;
    }
  }
  const coverage = before ? after / before : 0;
  // Sem arte escura não sobra nada; uma placa escura sem alfa sobrevive
  // inteira até a borda e viraria um retângulo branco com o texto vazado.
  const block = edge > 0 && edgePainted / edge >= 0.95 && after / (width * height) >= 0.6;
  if (coverage < 0.05 || block) return null;
  const png = await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ palette: true, quality: 90, effort: 8 })
    .toBuffer();
  return { png, coverage: Number(coverage.toFixed(3)), width, height };
}
