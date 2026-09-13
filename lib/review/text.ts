import type { Page } from 'puppeteer-core';

export type BrokenWord = {
  page: string;
  viewport: string;
  selector: string;
  word: string;
};

export type TextInspection = {
  brokenWords: BrokenWord[];
};

/**
 * Mede palavras inteiras nos elementos que sustentam a hierarquia e as ações.
 * Uma Range por palavra revela quando o navegador fragmentou o mesmo termo em
 * mais de uma linha, algo que scrollWidth e screenshots não tornam objetivo.
 */
export async function inspectText(
  browserPage: Page,
  context: Pick<BrokenWord, 'page' | 'viewport'>,
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
  return {
    brokenWords: measured.map((item) => ({ ...context, ...item })),
  };
}
