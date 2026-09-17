'use client';

import { useEffect, useRef } from 'react';
import { SiteLink } from './site-link';
import type { Link } from './props';

/**
 * A faceta: a marca do lugar, desenhada. Uma gema vista de cima, com o corte
 * da mesa e duas arestas. Serve de âncora para a assinatura do resto do site.
 */
export function Facet({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="sa-facet"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5 21.5 9l-9.5 12.5L2.5 9 12 2.5Z" />
      <path d="M6.6 9h10.8M12 2.5 9 9M12 2.5l3 6.5" />
    </svg>
  );
}

/**
 * Navegação. O menu é um `<details>` nativo: os links já estão no HTML e
 * continuam funcionando sem JavaScript. O script só acrescenta o que o
 * elemento não faz sozinho — fechar com Esc, ao tocar fora e ao trocar de
 * página — e devolve o foco ao botão para quem navega por teclado.
 */
export function SiteNav({
  wordmark,
  navLinks,
  whatsapp,
  pagePath,
}: {
  wordmark: string;
  navLinks: Link[];
  whatsapp: Link | null;
  pagePath: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const element = menu.current;
    if (!element) return;
    const close = (restoreFocus: boolean) => {
      if (!element.open) return;
      element.open = false;
      if (restoreFocus)
        element.querySelector<HTMLElement>('.sa-menu-button')?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (!element.contains(event.target as Node)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  const current = (href: string) =>
    href === pagePath ? ('page' as const) : undefined;

  return (
    <header className="sa-nav">
      <div className="sa-shell sa-nav-inner">
        <SiteLink className="sa-wordmark" href="/">
          <Facet />
          {wordmark}
        </SiteLink>

        <nav className="sa-nav-links" aria-label="Navegação principal">
          {navLinks.map((item) => (
            <SiteLink
              key={item.href}
              className="sa-nav-link"
              href={item.href}
              aria-current={current(item.href)}
            >
              {item.label}
            </SiteLink>
          ))}
        </nav>

        {whatsapp ? (
          <SiteLink
            className="sa-action sa-nav-cta"
            data-kind="solid"
            href={whatsapp.href}
          >
            {whatsapp.label}
          </SiteLink>
        ) : null}

        <details className="sa-menu" ref={menu}>
          <summary className="sa-menu-button" aria-label="Abrir menu">
            <span className="sa-menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            Menu
          </summary>
          <div className="sa-menu-panel">
            {navLinks.map((item) => (
              <SiteLink
                key={item.href}
                href={item.href}
                aria-current={current(item.href)}
              >
                {item.label}
              </SiteLink>
            ))}
            {whatsapp ? (
              <SiteLink
                className="sa-action"
                data-kind="solid"
                href={whatsapp.href}
              >
                {whatsapp.label}
              </SiteLink>
            ) : null}
          </div>
        </details>
      </div>
    </header>
  );
}
