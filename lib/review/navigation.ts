import type { Page } from 'puppeteer-core';

export type NavigationMeasurement = {
  compact: boolean;
  opened: boolean;
  closed: boolean;
  issues: string[];
};

/** Exercita apenas controles locais. Nunca segue links ou dispara conversão. */
export async function inspectNavigation(page: Page): Promise<{
  navigation?: NavigationMeasurement;
  menuJpeg?: Buffer;
}> {
  // Fontes e ResizeObserver precisam concluir antes de comparar as geometrias.
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const initial = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>('.site-nav');
    if (!nav) return null;
    const toggle = nav.querySelector<HTMLElement>('.site-menu-toggle');
    const compact = Boolean(toggle?.getClientRects().length);
    const bar = nav.getBoundingClientRect();
    const issues: string[] = [];
    if (
      innerWidth < 1024 &&
      nav.querySelector('.site-nav-desktop a[href]') &&
      !compact
    )
      issues.push('Menu compacto não está disponível nesta largura.');
    if (bar.left < -1 || bar.right > innerWidth + 1)
      issues.push('Cabeçalho ultrapassa a largura da tela.');
    if (compact && bar.height > 112)
      issues.push(
        'Cabeçalho compacto ocupa mais de 112 px antes de abrir o menu.',
      );
    if (compact && toggle) {
      const box = toggle.getBoundingClientRect();
      if (box.width < 44 || box.height < 44)
        issues.push('Botão Menu não tem alvo de toque de 44 px.');
    }
    return {
      compact,
      issues,
      reserved: nav.closest('.site-navigation-frame')!.getBoundingClientRect()
        .height,
      scrollY,
    };
  });
  if (!initial) return {};
  const navigation: NavigationMeasurement = {
    compact: initial.compact,
    opened: false,
    closed: false,
    issues: initial.issues,
  };
  if (!initial.compact) return { navigation };
  let menuJpeg: Buffer | undefined;
  try {
    await page.click('.site-menu-toggle');
    await page.waitForSelector('.site-menu-dialog[open]', { timeout: 2000 });
    navigation.opened = true;
    navigation.issues.push(
      ...(await page.evaluate((reserved) => {
        const modal = document.querySelector<HTMLDialogElement>(
          '.site-menu-dialog[open]',
        )!;
        const body = modal.querySelector<HTMLElement>('.site-menu-body')!;
        const box = modal.getBoundingClientRect();
        const issues: string[] = [];
        if (
          box.left < -1 ||
          box.top < -1 ||
          box.right > innerWidth + 1 ||
          box.bottom > innerHeight + 1
        )
          issues.push('Painel do menu sai da área visível.');
        if (body.scrollWidth > body.clientWidth + 1)
          issues.push('Menu tem rolagem horizontal.');
        if (
          Math.abs(
            document
              .querySelector('.site-navigation-frame')!
              .getBoundingClientRect().height - reserved,
          ) > 1
        )
          issues.push('Abrir o menu desloca o conteúdo da página.');
        for (const target of modal.querySelectorAll<HTMLElement>('a, button')) {
          const rect = target.getBoundingClientRect();
          if (rect.width < 44 || rect.height < 44)
            issues.push('Menu tem ação com alvo menor que 44 px.');
        }
        if (!modal.contains(document.activeElement))
          issues.push('Foco não entrou no menu.');
        return issues;
      }, initial.reserved)),
    );
    menuJpeg = Buffer.from(
      await page.screenshot({ type: 'jpeg', quality: 85 }),
    );
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('.site-menu-dialog[open]'),
      { timeout: 2000 },
    );
    navigation.closed = true;
    const restored = await page.evaluate(
      (y) => ({
        focus: document.activeElement?.matches('.site-menu-toggle'),
        scroll: Math.abs(scrollY - y) <= 1,
      }),
      initial.scrollY,
    );
    if (!restored.focus)
      navigation.issues.push('Fechar o menu não devolve o foco ao botão Menu.');
    if (!restored.scroll)
      navigation.issues.push('Fechar o menu altera a posição de rolagem.');
  } catch {
    navigation.issues.push(
      'Não foi possível completar abertura e fechamento do menu.',
    );
  } finally {
    await page.evaluate(() =>
      document
        .querySelector<HTMLDialogElement>('.site-menu-dialog[open]')
        ?.close(),
    );
  }
  return { navigation, menuJpeg };
}
