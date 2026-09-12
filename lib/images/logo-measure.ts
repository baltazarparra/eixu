import sharp from 'sharp';
import { luminanceOf } from '@/lib/blocks/contrast';
import type { LogoFit } from '@/lib/types';

/** Lado máximo da leitura: as frações não mudam e o custo cabe numa aplicação. */
const MAX_SIDE = 256;
/** Alfa mínimo para um pixel contar como pintado. */
const PAINTED = 16;
/** Faixa da borda medida para detectar placa: 2% do lado, no mínimo 2 px. */
const RING = 0.02;

function saturationOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  return max ? (max - Math.min(r, g, b)) / max : 0;
}

/**
 * Lê o logo em RGBA e mede o que decide se ele serve sobre a superfície do
 * site: transparência real, luminância da arte e placa. Placa é o retângulo
 * opaco em volta da arte que o visualizador do operador esconde sobre branco
 * e o site escuro mostra inteiro. Um arquivo sem alfa é placa por definição;
 * com alfa, a placa aparece quando a faixa de borda da arte é quase toda
 * opaca, clara e sem cor. Um retângulo colorido com texto vazado não conta:
 * ele é a marca, e funciona sobre qualquer papel.
 */
export async function measureLogoFit(
  bytes: Uint8Array | Buffer,
  source: string,
): Promise<LogoFit> {
  const buffer = Buffer.from(bytes);
  const meta = await sharp(buffer).metadata();
  const hasAlpha = Boolean(meta.hasAlpha);
  const { data, info } = await sharp(buffer)
    .resize(MAX_SIDE, MAX_SIDE, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let transparent = 0;
  let opaque = 0;
  let light = 0;
  let dark = 0;
  let sum = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i + 3] < PAINTED) {
        transparent += 1;
        continue;
      }
      opaque += 1;
      const luminance = luminanceOf(data[i], data[i + 1], data[i + 2]);
      sum += luminance;
      if (luminance > 0.85) light += 1;
      if (luminance < 0.3) dark += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  let plate: LogoFit['plate'] = null;
  if (opaque && maxX >= minX && maxY >= minY) {
    const band = Math.max(2, Math.round(Math.min(maxX - minX, maxY - minY) * RING));
    let ring = 0;
    let ringOpaque = 0;
    let ringLuminance = 0;
    let ringSaturation = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const onRing =
          x < minX + band || x > maxX - band || y < minY + band || y > maxY - band;
        if (!onRing) continue;
        ring += 1;
        const i = (y * width + x) * channels;
        if (data[i + 3] < PAINTED) continue;
        ringOpaque += 1;
        ringLuminance += luminanceOf(data[i], data[i + 1], data[i + 2]);
        ringSaturation += saturationOf(data[i], data[i + 1], data[i + 2]);
      }
    }
    const opaqueFraction = ring ? ringOpaque / ring : 0;
    const luminance = ringOpaque ? ringLuminance / ringOpaque : 0;
    const saturation = ringOpaque ? ringSaturation / ringOpaque : 0;
    const flat = opaqueFraction >= 0.95 && saturation < 0.15;
    if (!hasAlpha) plate = luminance >= 0.5 ? 'light' : 'dark';
    else if (flat && luminance > 0.85) plate = 'light';
  }

  const total = width * height;
  return {
    source,
    measuredAt: new Date().toISOString(),
    width: meta.width ?? width,
    height: meta.height ?? height,
    hasAlpha,
    transparentFraction: round(total ? transparent / total : 0),
    opaqueLuminance: round(opaque ? sum / opaque : 0),
    lightFraction: round(opaque ? light / opaque : 0),
    darkFraction: round(opaque ? dark / opaque : 0),
    plate,
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
