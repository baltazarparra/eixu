import type { LogoRendition } from '@/lib/types';

export type RgbaImage = { data: Uint8Array; width: number; height: number };
export type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function displayHeightFor(
  aspect: number,
): LogoRendition['displayHeight'] {
  return aspect >= 3.5 ? 40 : aspect >= 2 ? 48 : aspect >= 1 ? 56 : 64;
}

export function alphaBounds(image: RgbaImage, threshold = 16): PixelBox | null {
  const { data, width, height } = image;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < left
    ? null
    : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function neighbours(
  index: number,
  width: number,
  total: number,
  visit: (next: number) => void,
) {
  if (index % width) visit(index - 1);
  if (index % width < width - 1) visit(index + 1);
  if (index >= width) visit(index - width);
  if (index + width < total) visit(index + width);
}

/** Remove só a cor conectada à borda e contadores pequenos. Nunca color-key global. */
export function removeUniformBackground(
  image: RgbaImage,
): RgbaImage & { background: LogoRendition['background'] } {
  const { width, height } = image;
  const total = width * height;
  let transparent = 0;
  for (let i = 3; i < image.data.length; i += 4)
    if (image.data[i] < 16) transparent++;
  if (transparent / total >= 0.02)
    return { ...image, background: 'transparent' };

  const border: number[] = [];
  for (let x = 0; x < width; x++) {
    border.push(x, (height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++)
    border.push(y * width, y * width + width - 1);
  const color = [0, 1, 2].map((channel) => {
    const values = border
      .map((index) => image.data[index * 4 + channel])
      .sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const distance = (i: number) =>
    Math.hypot(
      image.data[i * 4] - color[0],
      image.data[i * 4 + 1] - color[1],
      image.data[i * 4 + 2] - color[2],
    );
  if (border.filter((i) => distance(i) <= 28).length / border.length < 0.7)
    return { ...image, background: 'opaque' };

  const data = new Uint8Array(image.data);
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  let end = 0;
  const add = (index: number) => {
    if (!seen[index] && distance(index) <= 28) {
      seen[index] = 1;
      queue[end++] = index;
    }
  };
  border.forEach(add);
  for (let cursor = 0; cursor < end; cursor++) {
    const i = queue[cursor];
    data[i * 4 + 3] = 0;
    neighbours(i, width, total, add);
  }
  const bounds = alphaBounds({ data, width, height });
  if (!bounds) return { ...image, background: 'opaque' };
  const holeLimit = bounds.width * bounds.height * 0.02;
  // Componentes da cor de fundo que ficaram fechados dentro da arte.
  for (let i = 0; i < total; i++) {
    if (seen[i] || distance(i) > 28) continue;
    end = 0;
    add(i);
    for (let cursor = 0; cursor < end; cursor++)
      neighbours(queue[cursor], width, total, add);
    if (end < holeLimit)
      for (let j = 0; j < end; j++) data[queue[j] * 4 + 3] = 0;
  }
  // Uma faixa de antialiasing, sem propagar a erosão para o interior do desenho.
  const removed = data.slice();
  for (let i = 0; i < total; i++) {
    if (removed[i * 4 + 3] === 0) continue;
    const d = distance(i);
    if (d > 60) continue;
    let touches = false;
    neighbours(i, width, total, (j) => {
      if (!removed[j * 4 + 3]) touches = true;
    });
    if (!touches) continue;
    const alpha = Math.max(0.05, d / 60);
    data[i * 4 + 3] = Math.round(255 * alpha);
    for (let c = 0; c < 3; c++)
      data[i * 4 + c] = Math.round(
        Math.max(
          0,
          Math.min(255, (data[i * 4 + c] - color[c] * (1 - alpha)) / alpha),
        ),
      );
  }
  return { data, width, height, background: 'removed' };
}

/** Símbolo isolado do wordmark: componente relevante, aproximadamente quadrado e com vão real. */
export function markBox(
  image: RgbaImage,
): [number, number, number, number] | undefined {
  const { data, width, height } = image;
  const total = width * height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  const components: (PixelBox & { area: number })[] = [];
  for (let start = 0; start < total; start++) {
    if (seen[start] || data[start * 4 + 3] < 128) continue;
    let end = 0,
      left = width,
      right = 0,
      top = height,
      bottom = 0;
    const add = (i: number) => {
      if (seen[i] || data[i * 4 + 3] < 128) return;
      seen[i] = 1;
      queue[end++] = i;
    };
    add(start);
    for (let cursor = 0; cursor < end; cursor++) {
      const i = queue[cursor],
        x = i % width,
        y = Math.floor(i / width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      neighbours(i, width, total, add);
    }
    components.push({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
      area: end,
    });
  }
  const painted = components.reduce((sum, c) => sum + c.area, 0);
  const sorted = components.sort((a, b) => b.area - a.area);
  const candidate = sorted.find(
    (c) =>
      c.width / c.height >= 0.6 &&
      c.width / c.height <= 1.6 &&
      c.area >= painted * 0.15 &&
      components.every(
        (other) =>
          other === c ||
          other.area < painted * 0.002 ||
          Math.max(
            other.left - (c.left + c.width),
            c.left - (other.left + other.width),
          ) >=
            width * 0.03,
      ),
  );
  if (!candidate) return undefined;
  return [
    candidate.left / width,
    candidate.top / height,
    candidate.width / width,
    candidate.height / height,
  ];
}

export function validReadingBox(
  image: RgbaImage,
  box?: number[],
): box is [number, number, number, number] {
  if (
    !box ||
    box.length !== 4 ||
    box.some((n) => !Number.isFinite(n) || n < 0 || n > 1)
  )
    return false;
  const [x, y, w, h] = box;
  if (w < 0.08 || h < 0.08 || x + w > 1 || y + h > 1) return false;
  const left = Math.floor(x * image.width),
    top = Math.floor(y * image.height);
  const right = Math.min(image.width, Math.ceil((x + w) * image.width));
  const bottom = Math.min(image.height, Math.ceil((y + h) * image.height));
  let painted = 0;
  for (let row = top; row < bottom; row++)
    for (let col = left; col < right; col++)
      if (image.data[(row * image.width + col) * 4 + 3] >= 16) painted++;
  return painted / ((right - left) * (bottom - top)) >= 0.05;
}
