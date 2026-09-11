'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Reserva a altura real do cabeçalho fixo, inclusive com o menu mobile aberto. */
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
    if (position !== 'fixed' || !frame.current || !content.current) return;
    const container = frame.current;
    const header = content.current;
    const theme = container.closest<HTMLElement>('.site-theme');
    const measure = () => {
      const height = header.getBoundingClientRect().height;
      container.style.setProperty('--navigation-height', `${height}px`);
      theme?.style.setProperty('--navigation-offset', `${height + 16}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => {
      observer.disconnect();
      theme?.style.removeProperty('--navigation-offset');
    };
  }, [position]);
  return (
    <div ref={frame} className="site-navigation-frame" data-position={position}>
      <div ref={content} className="site-navigation-content">
        {children}
      </div>
    </div>
  );
}
