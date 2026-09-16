'use client';

import { useEffect, useRef, useState } from 'react';

const links = [
  ['#vantagens', 'Vantagens'],
  ['#beneficios', 'Benefícios'],
  ['#seguranca', 'Segurança'],
  ['#duvidas', 'Dúvidas'],
  ['#contato', 'Pedir cartão'],
] as const;

export function RaizenCardMobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      requestAnimationFrame(() => buttonRef.current?.focus());
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return (
    <div className="rc-mobile-nav" data-open={open ? 'true' : 'false'}>
      <button
        ref={buttonRef}
        className="rc-mobile-menu-button"
        type="button"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls="rc-mobile-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span />
        <span />
      </button>
      <nav id="rc-mobile-menu" aria-label="Navegação móvel" hidden={!open}>
        {links.map(([href, label]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
