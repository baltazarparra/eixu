'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** O diálogo nativo fornece isolamento de foco e top layer, mesmo em headers com blur. */
export function MobileNavigation({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const restoreScroll = useRef<(() => void) | null>(null);
  const [expanded, setExpanded] = useState(false);

  const unlock = () => {
    restoreScroll.current?.();
    restoreScroll.current = null;
  };
  const close = () => {
    // Destrave antes da navegação nativa de uma âncora, não no evento close tardio.
    unlock();
    dialog.current?.close();
    setExpanded(false);
  };

  useEffect(() => {
    const button = trigger.current;
    const modal = dialog.current;
    if (!button || !modal) return;
    const reset = () => {
      unlock();
      modal.close();
      setExpanded(false);
    };
    const resize = new ResizeObserver(() => {
      if (modal.open && !button.getClientRects().length) reset();
    });
    let outsidePress = false;
    const onPointerDown = (event: PointerEvent) => {
      const rect = modal.getBoundingClientRect();
      outsidePress =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
    };
    const onClick = (event: MouseEvent) => {
      if (
        (event.target as Element).closest('a[href]') ||
        (outsidePress && event.target === modal)
      )
        reset();
      outsidePress = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const targets = [
        ...modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ),
      ];
      const first = targets[0];
      const last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    modal.addEventListener('pointerdown', onPointerDown);
    modal.addEventListener('click', onClick);
    modal.addEventListener('keydown', onKeyDown);
    resize.observe(button);
    window.addEventListener('pagehide', reset);
    return () => {
      resize.disconnect();
      window.removeEventListener('pagehide', reset);
      modal.removeEventListener('pointerdown', onPointerDown);
      modal.removeEventListener('click', onClick);
      modal.removeEventListener('keydown', onKeyDown);
      unlock();
      modal.close();
    };
  }, []);

  const open = () => {
    const modal = dialog.current;
    if (!modal || modal.open) return;
    const body = document.body;
    const root = document.documentElement;
    const x = window.scrollX;
    const y = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: root.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    const scrollbar = window.innerWidth - root.clientWidth;
    if (scrollbar)
      body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbar}px`;
    Object.assign(body.style, {
      position: 'fixed',
      top: `${-y}px`,
      left: `${-x}px`,
      right: '0',
    });
    root.style.overflow = 'hidden';
    restoreScroll.current = () => {
      Object.assign(body.style, {
        position: previous.position,
        top: previous.top,
        left: previous.left,
        right: previous.right,
        paddingRight: previous.paddingRight,
      });
      root.style.overflow = previous.overflow;
      window.scrollTo({ left: x, top: y, behavior: 'instant' });
    };
    modal.showModal();
    modal
      .querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
    setExpanded(true);
  };

  return (
    <>
      <details className="site-mobile-nav">
        <summary
          ref={trigger}
          className="site-menu-toggle"
          aria-controls={id}
          aria-haspopup="dialog"
          aria-expanded={expanded || undefined}
          onClick={(event) => {
            if (typeof dialog.current?.showModal !== 'function') return;
            event.preventDefault();
            open();
          }}
        >
          Menu <span className="site-menu-symbol" aria-hidden="true" />
        </summary>
        <div className="site-mobile-fallback">{children}</div>
      </details>
      <dialog
        ref={dialog}
        id={id}
        className="site-menu-dialog"
        aria-label={`Menu de ${label}`}
        onCancel={close}
        onClose={() => {
          unlock();
          setExpanded(false);
        }}
      >
        <div className="site-menu-heading">
          <span className="site-menu-brand">{label}</span>
          <button type="button" className="site-menu-close" onClick={close}>
            Fechar <span className="site-menu-symbol" aria-hidden="true" />
          </button>
        </div>
        <div className="site-menu-body">{children}</div>
      </dialog>
    </>
  );
}
