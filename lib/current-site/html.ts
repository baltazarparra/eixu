const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  atilde: 'ã',
  auml: 'ä',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  iacute: 'í',
  icirc: 'î',
  oacute: 'ó',
  ocirc: 'ô',
  otilde: 'õ',
  ouml: 'ö',
  uacute: 'ú',
  ucirc: 'û',
  uuml: 'ü',
  ccedil: 'ç',
  ntilde: 'ñ',
  ordf: 'ª',
  ordm: 'º',
  deg: '°',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

function decodeOnce(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&([a-z]+);/gi, (_entity, name: string) => {
      const decoded = ENTITIES[name.toLowerCase()];
      if (!decoded) return ' ';
      return /^[A-Z]/.test(name) ? decoded.toUpperCase() : decoded;
    });
}

export function decode(value: string): string {
  const once = decodeOnce(value);
  const twice = /&#x?\d/i.test(once) ? decodeOnce(once) : once;
  return twice.replace(/\s+/g, ' ').trim();
}

export function metaContent(html: string, name: string): string | undefined {
  const quoted = `("|')((?:(?!\\1)[^>])*)\\1`;
  const before = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=${quoted}`,
    'i',
  );
  const after = new RegExp(
    `<meta[^>]+content=${quoted}[^>]*(?:name|property)=["']${name}["']`,
    'i',
  );
  const match = before.exec(html) ?? after.exec(html);
  return match ? decode(match[2]) : undefined;
}

export function stripNoise(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}
