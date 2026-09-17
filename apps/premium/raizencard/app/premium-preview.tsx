'use client';

import { useEffect } from 'react';

export function PremiumPreviewReporter({
  enabled,
  adminOrigin,
  revision,
  requestId,
  initialScroll,
}: {
  enabled: boolean;
  adminOrigin: string;
  revision: number;
  requestId: string;
  initialScroll: number;
}) {
  useEffect(() => {
    if (!enabled || window.parent === window) return;
    let frame = 0;
    const send = (type: string, detail: Record<string, unknown> = {}) =>
      window.parent.postMessage(
        { type, revision, requestId, ...detail },
        adminOrigin,
      );
    const reportScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        send('eixu:premium-preview-scroll', { y: window.scrollY }),
      );
    };
    const blockSubmit = (event: Event) => event.preventDefault();
    const blockNavigation = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!link || (link.getAttribute('href') ?? '').startsWith('#')) return;
      event.preventDefault();
    };
    if (Number.isFinite(initialScroll) && initialScroll > 0)
      requestAnimationFrame(() => window.scrollTo({ top: initialScroll }));
    window.addEventListener('scroll', reportScroll, { passive: true });
    document.addEventListener('submit', blockSubmit, true);
    document.addEventListener('click', blockNavigation, true);
    send('eixu:premium-preview-ready');
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', reportScroll);
      document.removeEventListener('submit', blockSubmit, true);
      document.removeEventListener('click', blockNavigation, true);
    };
  }, [adminOrigin, enabled, initialScroll, requestId, revision]);
  return null;
}
