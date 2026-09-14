import type { Page } from 'puppeteer-core';

export type BrokenWord = {
  page: string;
  viewport: string;
  selector: string;
  word: string;
};

export type TextInspection = {
  brokenWords: BrokenWord[];
  contrasts: TextContrast[];
};

export type TextContrast = {
  page: string;
  viewport: string;
  selector: string;
  text: string;
  color: string;
  backgrounds: string[];
  /** false quando uma imagem impede provar contraste só pelo CSS computado. */
  measurable: boolean;
  ratio: number;
};

type TextInspectionOptions = {
  /** Contraste custa mais DOM work e só é necessário após edição visual. */
  contrast?: boolean;
  /** Restringe a medição aos blocos efetivamente alterados. */
  blockIds?: string[];
};

/**
 * Mede palavras inteiras nos elementos que sustentam a hierarquia e as ações.
 * Uma Range por palavra revela quando o navegador fragmentou o mesmo termo em
 * mais de uma linha, algo que scrollWidth e screenshots não tornam objetivo.
 */
export async function inspectText(
  browserPage: Page,
  context: Pick<BrokenWord, 'page' | 'viewport'>,
  options: TextInspectionOptions = {},
): Promise<TextInspection> {
  await browserPage.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const measured = await browserPage.evaluate(() => {
    const selector = [
      'h1',
      'h2',
      'h3',
      'blockquote',
      '.site-action',
      '.site-nav-link',
      '.site-nav-cta',
      'label',
      'figcaption',
      '.site-eyebrow',
      '.site-explorer-kicker',
    ].join(',');
    const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'word' });
    const results: { selector: string; word: string }[] = [];
    const seen = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      // O menu compacto é uma das poucas superfícies que aceita anywhere:
      // URLs e destinos longos precisam continuar alcançáveis em 320 px.
      if (element.closest('.site-mobile-nav, .site-menu-dialog')) continue;
      let visible = Boolean(element.getClientRects().length);
      for (
        let current: HTMLElement | null = element;
        visible && current;
        current = current.parentElement
      ) {
        const style = getComputedStyle(current);
        if (
          current.hidden ||
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          (current instanceof HTMLDialogElement && !current.open)
        )
          visible = false;
      }
      if (!visible) continue;
      const block = element.closest<HTMLElement>('[data-block]');
      const classes = [...element.classList]
        .filter((name) => name.startsWith('site-'))
        .slice(0, 2)
        .map((name) => `.${name}`)
        .join('');
      const owner = block?.dataset.block
        ? `[data-block="${block.dataset.block}"] `
        : '';
      const elementSelector = `${owner}${element.tagName.toLowerCase()}${classes}`;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.parentElement?.closest(selector) === element &&
            node.textContent?.trim()
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      let node = walker.nextNode();
      while (node) {
        const value = node.textContent ?? '';
        for (const segment of segmenter.segment(value)) {
          if (!segment.isWordLike) continue;
          const range = document.createRange();
          range.setStart(node, segment.index);
          range.setEnd(node, segment.index + segment.segment.length);
          const tops = new Set(
            [...range.getClientRects()]
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map((rect) => Math.round(rect.top * 2) / 2),
          );
          if (tops.size > 1) {
            const key = `${elementSelector}\n${segment.segment}`;
            if (!seen.has(key)) {
              seen.add(key);
              results.push({
                selector: elementSelector,
                word: segment.segment,
              });
            }
          }
        }
        node = walker.nextNode();
      }
    }
    return results;
  });
  const contrasts = options.contrast
    ? await browserPage.evaluate((blockIds) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const painter = canvas.getContext('2d', { willReadFrequently: true })!;
        const rgba = (value: string) => {
          painter.clearRect(0, 0, 1, 1);
          painter.fillStyle = '#000000';
          painter.fillStyle = value;
          painter.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = painter.getImageData(0, 0, 1, 1).data;
          return { value: `rgb(${r}, ${g}, ${b})`, r, g, b, a: a / 255 };
        };
        const colorsIn = (image: string) => {
          if (!image || image === 'none') return [];
          const matches = image.match(
            /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}/gi,
          );
          const colors = (matches ?? []).map(rgba);
          return colors.filter(
            (color, index) =>
              colors.findIndex(
                (candidate) =>
                  candidate.value === color.value && candidate.a === color.a,
              ) === index,
          );
        };
        const composite = (
          top: ReturnType<typeof rgba>,
          bottom: ReturnType<typeof rgba>,
        ) => {
          const alpha = top.a + bottom.a * (1 - top.a);
          const channel = (foreground: number, background: number) =>
            alpha === 0
              ? 0
              : Math.round(
                  (foreground * top.a + background * bottom.a * (1 - top.a)) /
                    alpha,
                );
          const r = channel(top.r, bottom.r);
          const g = channel(top.g, bottom.g);
          const b = channel(top.b, bottom.b);
          return { value: `rgb(${r}, ${g}, ${b})`, r, g, b, a: alpha };
        };
        const unique = (colors: ReturnType<typeof rgba>[]) =>
          colors.filter(
            (color, index) =>
              colors.findIndex(
                (candidate) =>
                  candidate.value === color.value && candidate.a === color.a,
              ) === index,
          );
        const channel = (value: number) => {
          const srgb = value / 255;
          return srgb <= 0.04045
            ? srgb / 12.92
            : ((srgb + 0.055) / 1.055) ** 2.4;
        };
        const luminance = (value: string) => {
          const { r, g, b } = rgba(value);
          return (
            0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
          );
        };
        const ratio = (first: string, second: string) => {
          const a = luminance(first);
          const b = luminance(second);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        };
        const visible = (element: HTMLElement) => {
          if (!element.getClientRects().length || element.ariaHidden === 'true')
            return false;
          for (
            let current: HTMLElement | null = element;
            current;
            current = current.parentElement
          ) {
            const style = getComputedStyle(current);
            if (
              current.hidden ||
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              Number(style.opacity) === 0 ||
              (current instanceof HTMLDialogElement && !current.open)
            )
              return false;
          }
          return true;
        };
        const backgroundsOf = (
          element: HTMLElement | null,
        ): { colors: ReturnType<typeof rgba>[]; measurable: boolean } => {
          if (!element) return { colors: [rgba('#ffffff')], measurable: true };
          const underneath = backgroundsOf(element.parentElement);
          const style = getComputedStyle(element);
          const fill = rgba(style.backgroundColor);
          const base =
            fill.a >= 0.999
              ? { colors: [fill], measurable: true }
              : fill.a > 0
                ? {
                    colors: unique(
                      underneath.colors.map((color) => composite(fill, color)),
                    ),
                    measurable: underneath.measurable,
                  }
                : underneath;
          if (!style.backgroundImage || style.backgroundImage === 'none')
            return base;
          const stops = colorsIn(style.backgroundImage);
          if (style.backgroundImage.includes('url(') || !stops.length)
            return { colors: base.colors, measurable: false };
          return {
            colors: unique(
              stops.flatMap((stop) =>
                base.colors.map((color) => composite(stop, color)),
              ),
            ),
            measurable:
              stops.every((stop) => stop.a >= 0.999) || base.measurable,
          };
        };
        const roots = blockIds?.length
          ? blockIds
              .map((id) =>
                document.querySelector<HTMLElement>(
                  `[data-block-id="${CSS.escape(id)}"]`,
                ),
              )
              .filter((root): root is HTMLElement => Boolean(root))
          : [document.documentElement];
        const selector = [
          'h1',
          'h2',
          'h3',
          'h4',
          'p',
          'a',
          'button',
          'label',
          'dt',
          'dd',
          'li',
          'summary',
          'blockquote',
          'figcaption',
          'span',
        ].join(',');
        return roots.flatMap((root) =>
          [...root.querySelectorAll<HTMLElement>(selector)]
            .filter(
              (element) =>
                visible(element) &&
                [...element.childNodes].some(
                  (node) =>
                    node.nodeType === Node.TEXT_NODE &&
                    Boolean(node.textContent?.trim()),
                ),
            )
            .map((element) => {
              const owner = element.closest<HTMLElement>('[data-block-id]');
              const classes = [...element.classList]
                .filter((name) => name.startsWith('site-'))
                .slice(0, 2)
                .map((name) => `.${name}`)
                .join('');
              const foreground = rgba(getComputedStyle(element).color);
              const measuredBackgrounds = backgroundsOf(element);
              const backgrounds = measuredBackgrounds.colors.map(
                (background) => background.value,
              );
              return {
                selector: `${owner ? `[data-block-id="${owner.dataset.blockId}"] ` : ''}${element.tagName.toLowerCase()}${classes}`,
                text: (element.textContent ?? '').trim().slice(0, 120),
                color: foreground.value,
                backgrounds,
                measurable: measuredBackgrounds.measurable,
                ratio: Math.min(
                  ...measuredBackgrounds.colors.map((background) =>
                    ratio(
                      composite(foreground, background).value,
                      background.value,
                    ),
                  ),
                ),
              };
            }),
        );
      }, options.blockIds)
    : [];
  return {
    brokenWords: measured.map((item) => ({ ...context, ...item })),
    contrasts: contrasts.map((item) => ({ ...context, ...item })),
  };
}
