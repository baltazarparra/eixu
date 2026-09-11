'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { StatusDot } from './primitives';

export type RailClient = { slug: string; name: string; status: string };

export function AdminShell({
  clients,
  operator,
  logout,
  children,
}: {
  clients: RailClient[];
  operator: string;
  logout: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === '/admin/login') return children;
  return (
    <div className="admin-shell" data-menu-open={open || undefined}>
      <a href="#admin-main" className="admin-skip">
        Ir ao conteúdo
      </a>
      <div className="admin-mobile-top">
        <span className="admin-brand">
          <span className="admin-brand-mark">E</span>EIXU
        </span>
        <button
          type="button"
          className="admin-secondary"
          aria-expanded={open}
          aria-controls="admin-rail"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Fechar clientes' : 'Clientes'}
        </button>
      </div>
      <aside className="admin-rail" id="admin-rail">
        <Link
          href="/admin"
          className="admin-brand"
          onClick={() => setOpen(false)}
        >
          <span className="admin-brand-mark">E</span>
          <span>
            EIXU<small>painel interno</small>
          </span>
        </Link>
        <nav aria-label="Navegação principal">
          <Link
            href="/admin"
            className="admin-rail-nav"
            aria-current={pathname === '/admin' ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            <span className="admin-rail-glyph" aria-hidden="true" />
            Clientes
          </Link>
        </nav>
        <div className="admin-rail-label">
          <span>Clientes recentes</span>
          <span>{clients.length}</span>
        </div>
        <nav className="admin-rail-clients" aria-label="Trocar de cliente">
          {clients.map((client) => (
            <Link
              key={client.slug}
              href={`/admin/${client.slug}`}
              aria-current={
                pathname === `/admin/${client.slug}` ||
                pathname?.startsWith(`/admin/${client.slug}/`)
                  ? 'page'
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              <StatusDot tone={client.status === 'published' ? 'ok' : 'warn'} />
              <span>
                {client.name}
                <small>{client.slug}</small>
              </span>
            </Link>
          ))}
          {!clients.length ? (
            <p>Seus clientes aparecem aqui após o cadastro.</p>
          ) : null}
        </nav>
        <div className="admin-operator">
          <span className="admin-avatar">
            {operator.slice(0, 2).toLocaleUpperCase('pt-BR')}
          </span>
          <span>
            {operator}
            <small>operador</small>
          </span>
          {logout}
        </div>
      </aside>
      <div className="admin-shell-content" id="admin-main" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
