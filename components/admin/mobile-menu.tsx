'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { StatusPill } from './primitives';

export function MobileMenu({
  name,
  published,
  children,
  logout,
}: {
  name: string;
  published: boolean;
  children: ReactNode;
  logout?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const media = window.matchMedia('(min-width: 1024px)');
    const close = () => {
      if (media.matches) dialogRef.current?.close();
    };
    const backdrop = (event: MouseEvent) => {
      if (!dialog || event.defaultPrevented) return;
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      // O layout do cliente persiste nas transições do App Router.
      // A captura de saída com edição não salva ainda pode impedir este clique.
      if (
        link &&
        dialog.contains(link) &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        event.button === 0
      ) {
        dialog.close();
        return;
      }
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    };
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog?.open) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), [tabindex="0"]',
        ),
      ).filter((node) => node.getClientRects().length);
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog?.addEventListener('click', backdrop);
    dialog?.addEventListener('keydown', keepFocus);
    media.addEventListener('change', close);
    return () => {
      dialog?.removeEventListener('click', backdrop);
      dialog?.removeEventListener('keydown', keepFocus);
      media.removeEventListener('change', close);
    };
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="admin-icon-button admin-mobile-menu-trigger"
        aria-label="Abrir menu do cliente"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${id}-dialog`}
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        <Menu size={19} aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        id={`${id}-dialog`}
        className="admin-mobile-menu"
        aria-labelledby={id}
        onClose={() => {
          setOpen(false);
          if (triggerRef.current?.getClientRects().length)
            triggerRef.current.focus({ preventScroll: true });
        }}
      >
        <div className="admin-mobile-menu-heading">
          <div>
            <h2 id={id}>{name}</h2>
            <StatusPill tone={published ? 'ok' : 'warn'}>
              {published ? 'Publicado' : 'Rascunho'}
            </StatusPill>
          </div>
          <button
            type="button"
            className="admin-icon-button"
            aria-label="Fechar menu do cliente"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {open ? children : null}
        <div className="admin-mobile-menu-footer">
          <Link href="/admin" className="admin-secondary">
            Todos os clientes
          </Link>
          {open ? logout : null}
        </div>
      </dialog>
    </>
  );
}
