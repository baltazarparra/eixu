'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { StatusPill } from './primitives';

type PageOption = { slug: string; title: string; dirty: boolean };

/**
 * Seletor da página em edição. O botão mostra o caminho, que é como o chat, o
 * andamento e a revisão já se referem às páginas; o menu traz o título em
 * segunda linha. Substitui o <select> que truncava "Título (/caminho)".
 * Os itens são botões de verdade, com foco itinerante: setas movem, Enter e
 * clique escolhem, Esc fecha e devolve o foco ao gatilho.
 */
export function PagePicker({
  pages,
  value,
  onChange,
  disabled = false,
}: {
  pages: readonly PageOption[];
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = pages.find((page) => page.slug === value);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
      [active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function show() {
    if (disabled) return;
    setActive(
      Math.max(
        0,
        pages.findIndex((page) => page.slug === value),
      ),
    );
    setOpen(true);
  }
  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }
  function choose(slug: string) {
    onChange(slug);
    close();
  }
  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'Escape':
      case 'Tab':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setActive((index) => Math.min(pages.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActive(0);
        break;
      case 'End':
        event.preventDefault();
        setActive(pages.length - 1);
        break;
    }
  }

  return (
    <div ref={rootRef} className="admin-bar-picker">
      <button
        ref={buttonRef}
        type="button"
        className="admin-bar-page"
        disabled={disabled || !pages.length}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        title={
          current
            ? `/${current.slug} · trocar a página em edição`
            : 'Trocar a página em edição'
        }
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show();
          }
        }}
      >
        <span className="admin-bar-page-path">
          {current ? `/${current.slug}` : pages.length ? '' : 'Nenhuma página'}
        </span>
        {current?.dirty ? <StatusPill tone="warn">rascunho</StatusPill> : null}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && !disabled ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          className="admin-bar-menu"
          aria-label="Página em edição"
          onKeyDown={onMenuKeyDown}
        >
          {pages.map((page, index) => (
            <button
              key={page.slug}
              type="button"
              role="menuitemradio"
              aria-checked={page.slug === value}
              tabIndex={index === active ? 0 : -1}
              data-active={index === active || undefined}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(page.slug)}
            >
              <span className="admin-bar-menu-path">
                /{page.slug}
                {page.dirty ? (
                  <StatusPill tone="warn">rascunho</StatusPill>
                ) : null}
              </span>
              <span className="admin-bar-menu-title">{page.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
