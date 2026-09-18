export type ReferenceOutline = {
  document: {
    background: string;
    color: string;
    font: string;
    contentWidth: number;
  };
  navigation: string[];
  sections: Array<{
    index: number;
    tag: string;
    identity: string;
    heading: string;
    text: string;
    top: number;
    height: number;
    width: number;
    background: string;
    color: string;
    display: string;
    columns: string;
    gap: string;
    padding: string;
    images: number;
    links: number;
    buttons: number;
  }>;
  typography: Array<{
    role: string;
    font: string;
    size: string;
    weight: string;
    lineHeight: string;
    letterSpacing: string;
    transform: string;
    color: string;
  }>;
  palette: Array<{ value: string; uses: number }>;
};

/**
 * Executada dentro da página da referência por `page.evaluate`, portanto não
 * pode fechar sobre nada do módulo: tudo que usa vive no próprio corpo.
 *
 * Uma leitura de layout precisa de estrutura, não de uma amostra de tags. O
 * agente recebe a sequência real das faixas, com geometria, grid, cor e
 * densidade, para recompor a mesma composição com conteúdo do cliente.
 */
export function referenceOutline(): {
  pageHeight: number;
  styles: ReferenceOutline;
} {
  const cap = (value: string | null | undefined, limit: number) =>
    (value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit);
  const visible = (element: Element) => {
    const css = getComputedStyle(element);
    if (css.display === 'none' || css.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 24;
  };
  const identify = (element: Element) => {
    const id = element.id ? `#${element.id}` : '';
    const names = Array.from(element.classList).slice(0, 3).join('.');
    return cap(`${id}${names ? `.${names}` : ''}`, 80);
  };

  // Wrappers de framework (#__next, div raiz do layout) escondem a sequência
  // real das faixas. Desça enquanto houver um único filho que ocupa o pai.
  let container: Element = document.querySelector('main') ?? document.body;
  for (let depth = 0; depth < 4; depth += 1) {
    const children = Array.from(container.children).filter(
      (child) => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK)$/.test(child.tagName),
    );
    if (children.length !== 1) break;
    const child = children[0];
    if (child.getBoundingClientRect().height < 0.8 * window.innerHeight) break;
    container = child;
  }

  const sections = Array.from(container.children)
    .filter(
      (child) =>
        !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|LINK)$/.test(child.tagName) &&
        visible(child),
    )
    .slice(0, 24)
    .map((element, index) => {
      const css = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const heading = element.querySelector('h1, h2, h3, h4');
      return {
        index,
        tag: element.tagName.toLowerCase(),
        identity: identify(element),
        heading: cap(heading?.textContent, 120),
        text: cap(element.textContent, 220),
        top: Math.round(rect.top + window.scrollY),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        background: css.backgroundColor,
        color: css.color,
        display: css.display,
        columns: cap(css.gridTemplateColumns, 120),
        gap: css.gap,
        padding: cap(css.padding, 60),
        images: element.querySelectorAll('img, picture, svg, video').length,
        links: element.querySelectorAll('a').length,
        buttons: element.querySelectorAll(
          'button, [role="button"], input[type="submit"]',
        ).length,
      };
    });

  const typography = ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'li']
    .map((role) => {
      const element = Array.from(document.querySelectorAll(role)).find(
        (candidate) =>
          visible(candidate) && (candidate.textContent ?? '').trim().length > 1,
      );
      if (!element) return null;
      const css = getComputedStyle(element);
      return {
        role,
        font: cap(css.fontFamily, 120),
        size: css.fontSize,
        weight: css.fontWeight,
        lineHeight: css.lineHeight,
        letterSpacing: css.letterSpacing,
        transform: css.textTransform,
        color: css.color,
      };
    })
    .filter((entry) => entry !== null);

  const counted = new Map<string, number>();
  for (const element of Array.from(
    document.querySelectorAll('body, header, footer, section, div, a, button'),
  ).slice(0, 400)) {
    if (!visible(element)) continue;
    const css = getComputedStyle(element);
    for (const value of [css.backgroundColor, css.color])
      if (value && value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent')
        counted.set(value, (counted.get(value) ?? 0) + 1);
  }
  const palette = Array.from(counted.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([value, uses]) => ({ value, uses }));

  const body = getComputedStyle(document.body);
  return {
    pageHeight: document.documentElement.scrollHeight,
    styles: {
      document: {
        background: body.backgroundColor,
        color: body.color,
        font: cap(body.fontFamily, 120),
        contentWidth: Math.round(
          sections.length
            ? Math.max(...sections.map((section) => section.width))
            : document.body.getBoundingClientRect().width,
        ),
      },
      navigation: Array.from(
        (
          document.querySelector('nav, header') ?? document.body
        ).querySelectorAll('a'),
      )
        .slice(0, 12)
        .map((link) => cap(link.textContent, 40))
        .filter((label) => label.length > 0),
      sections,
      typography,
      palette,
    },
  };
}
