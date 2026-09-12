import { contrastRatio } from './contrast';

let paint: CanvasRenderingContext2D | null = null;
/** Resolve inclusive color-mix e superfícies translúcidas calculadas pelo navegador. */
export function measuredBackground(node: HTMLElement): string | undefined {
  if (!paint) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    paint = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (!paint) return undefined;
  const layers: number[][] = [];
  for (let at: HTMLElement | null = node; at; at = at.parentElement) {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = getComputedStyle(at).backgroundColor;
    paint.fillRect(0, 0, 1, 1);
    const rgba = [...paint.getImageData(0, 0, 1, 1).data];
    layers.push(rgba);
    if (rgba[3] === 255) break;
  }
  const rgb = layers
    .reverse()
    .reduce(
      (back, front) =>
        back.map(
          (channel, i) =>
            channel * (1 - front[3] / 255) + (front[i] * front[3]) / 255,
        ),
      [255, 255, 255],
    );
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
}

/** O menor contraste inclui a medição atual e as superfícies exigidas no servidor. */
export function editorContrast(
  color: string,
  backgrounds: string[],
  nodes: HTMLElement[],
): number {
  const visible = nodes.filter((node) => node.getClientRects().length);
  const measured = visible
    .map(measuredBackground)
    .filter((value): value is string => Boolean(value));
  return Math.min(
    ...[...backgrounds, ...measured].map((background) =>
      contrastRatio(color, background),
    ),
  );
}
