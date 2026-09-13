import sharp from 'sharp';
import ImageTracer from 'imagetracerjs';

/** Aceita vetor autocontido; nenhum conteúdo ativo, recurso externo ou entidade. */
export function safeLogoSvg(bytes: Buffer): string | undefined {
  const text = bytes.toString('utf8').trim();
  // PNGs do gerador incluem SVG em metadados C2PA. Só analisar como XML
  // quando o arquivo começa com markup, nunca pelo conteúdo do bitmap.
  if (!text.startsWith('<')) return undefined;
  if (!/<svg[\s>]/i.test(text.slice(0, 1024))) return undefined;
  if (
    /<\s*(?:[\w-]+:)?(?:script|foreignObject|iframe|object|embed|image|animate\w*|set)\b/i.test(
      text,
    ) ||
    /<!\s*(?:DOCTYPE|ENTITY)|<\?xml-stylesheet|\son[\w:-]+\s*=|@import|\\|&#/i.test(
      text,
    ) ||
    /(?:href|src)\s*=\s*(['"])(?!#)[\s\S]*?\1/i.test(text) ||
    /url\(\s*['"]?(?!#)/i.test(text)
  )
    throw new Error('SVG de logo contém conteúdo ativo ou referência externa.');
  if (
    (text.match(/<svg[\s>]/gi) ?? []).length !== 1 ||
    !/<\/svg\s*>\s*$/i.test(text)
  )
    throw new Error('SVG de logo inválido.');
  return text;
}

export type TraceGate = {
  approved: boolean;
  iou: number;
  colorError: number;
  bytes: number;
  flat: boolean;
};

/** O gate usa os pixels originais, não os pixels já quantizados pelo traçador. */
export async function logoTraceGate(
  master: Buffer,
  svg: string,
): Promise<TraceGate> {
  const original = await sharp(master)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = original.info;
  const traced = await sharp(Buffer.from(svg), { density: 144 })
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer();
  let intersection = 0,
    union = 0,
    error = 0,
    samples = 0;
  const colors = new Map<number, number>();
  for (let i = 0; i < original.data.length; i += 4) {
    const a = original.data[i + 3] >= 128,
      b = traced[i + 3] >= 128;
    if (a || b) union++;
    if (a && b) {
      intersection++;
      for (let c = 0; c < 3; c++)
        error += Math.abs(original.data[i + c] - traced[i + c]);
    }
    if (original.data[i + 3] >= 250) {
      const key =
        (original.data[i] >> 4) * 256 +
        (original.data[i + 1] >> 4) * 16 +
        (original.data[i + 2] >> 4);
      colors.set(key, (colors.get(key) ?? 0) + 1);
      samples++;
    }
  }
  const iou = union ? intersection / union : 0;
  const colorError = intersection ? error / (intersection * 3 * 255) : 1;
  const flat =
    samples > 0 &&
    [...colors.values()]
      .sort((a, b) => b - a)
      .slice(0, 12)
      .reduce((a, b) => a + b, 0) /
      samples >=
      0.9;
  const bytes = Buffer.byteLength(svg);
  return {
    approved:
      iou >= 0.9 && colorError <= 24 / 255 && bytes <= 150 * 1024 && flat,
    iou,
    colorError,
    bytes,
    flat,
  };
}

export async function traceLogo(
  master: Buffer,
): Promise<{ svg: string; gate: TraceGate } | null> {
  const { data, info } = await sharp(master)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = data[i + 3] < 128 ? 0 : 255;
    if (!data[i + 3]) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
  const svg = ImageTracer.imagedataToSVG(
    { data, width: info.width, height: info.height },
    {
      numberofcolors: 12,
      colorquantcycles: 3,
      colorsampling: 2,
      pathomit: 8,
      ltres: 1,
      qtres: 1,
      roundcoords: 1,
      viewbox: true,
      scale: 1,
      desc: false,
      strokewidth: 0,
    },
  )
    .replace(
      /<path\b[^>]*\bopacity="0(?:\.0*)?"[^>]*(?:\/>|>[\s\S]*?<\/path>)/gi,
      '',
    )
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/gi, '');
  const gate = await logoTraceGate(master, svg);
  if (!gate.approved) {
    console.info('[logo] SVG traçado recusado', gate);
    return null;
  }
  return { svg, gate };
}
