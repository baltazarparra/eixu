'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Mede a barra fechada e recolhe a navegação quando seus destinos não cabem. */
export function NavigationFrame({
  position = 'static',
  children,
}: {
  position?: 'static' | 'fixed';
  children: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!frame.current || !content.current) return;
    const container = frame.current;
    const header = content.current;
    const theme = container.closest<HTMLElement>('.site-theme');
    const row = header.querySelector<HTMLElement>('.site-nav-row');
    const brand = header.querySelector<HTMLElement>('.site-nav-brand');
    const logo = brand?.querySelector<HTMLImageElement>('img');
    const desktop = header.querySelector<HTMLElement>('.site-nav-desktop');
    const mobile = window.matchMedia('(max-width: 1023px)');
    const measure = () => {
      if (row && brand && desktop) {
        const style = getComputedStyle(row);
        const available =
          row.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        // A largura desejada independe do modo atual. Não revele controles
        // desktop para medir: isso interromperia um menu que já está aberto.
        const brandWidth = logo?.naturalHeight
          ? Math.min(
              (logo.naturalWidth / logo.naturalHeight) *
                parseFloat(
                  getComputedStyle(logo).getPropertyValue('--logo-height'),
                ),
              parseFloat(getComputedStyle(brand).maxWidth),
            )
          : brand.getBoundingClientRect().width;
        const needed =
          brandWidth + desktop.scrollWidth + parseFloat(style.columnGap);
        container.dataset.compact = String(
          mobile.matches || needed > available + 1,
        );
      }
      const height = header.getBoundingClientRect().height;
      container.style.setProperty('--navigation-height', `${height}px`);
      if (position === 'fixed')
        theme?.style.setProperty('--navigation-offset', `${height + 16}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    if (row) observer.observe(row);
    if (brand) observer.observe(brand);
    logo?.addEventListener('load', measure);
    if (desktop) observer.observe(desktop);
    desktop
      ?.querySelectorAll('nav, .site-nav-cta')
      .forEach((item) => observer.observe(item));
    mobile.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      mobile.removeEventListener('change', measure);
      logo?.removeEventListener('load', measure);
      if (position === 'fixed')
        theme?.style.removeProperty('--navigation-offset');
    };
  }, [position, children]);
  return (
    <div
      ref={frame}
      className="site-navigation-frame"
      data-position={position}
      data-compact="true"
    >
      <div ref={content} className="site-navigation-content">
        {children}
      </div>
    </div>
  );
}
