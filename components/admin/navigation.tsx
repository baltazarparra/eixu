'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { StatusPill } from './primitives';

type TenantIdentity = { slug: string; name: string; status?: string };
type Area = 'site' | 'imagens' | 'trafego' | 'dados';
const HeaderSlot = createContext<{ node: HTMLDivElement | null } | null>(null);
const RefreshTenant = createContext<(() => void) | undefined>(undefined);

export function useRefreshTenant() {
  return useContext(RefreshTenant);
}

function TenantHeader({
  tenant,
  active,
  children,
}: {
  tenant: TenantIdentity;
  active: Area;
  children?: ReactNode;
}) {
  const root = `/admin/${tenant.slug}`;
  return (
    <header className="admin-tenant-header">
      <div className="admin-tenant-top">
        <div className="admin-tenant-identity">
          <div>
            <p>{tenant.name}</p>
            <StatusPill tone={tenant.status === 'published' ? 'ok' : 'warn'}>
              {tenant.status === 'published' ? 'Publicado' : 'Rascunho'}
            </StatusPill>
          </div>
          <a
            href={`https://${tenant.slug}.eixu.com.br`}
            target="_blank"
            rel="noreferrer"
          >
            {tenant.slug}.eixu.com.br <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="admin-tenant-actions">
          <a
            className="admin-secondary"
            href={`/s/${tenant.slug}?preview=1&__tenant=${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Ver prévia <span aria-hidden="true">↗</span>
          </a>
          {children}
        </div>
      </div>
      <nav className="admin-tenant-tabs" aria-label="Área do cliente">
        {(
          [
            ['site', '', 'Site'],
            ['imagens', '/imagens', 'Imagens'],
            ['trafego', '/trafego', 'Tráfego'],
            ['dados', '/dados', 'Dados'],
          ] as const
        ).map(([key, suffix, label]) => (
          <Link
            key={key}
            href={`${root}${suffix}`}
            aria-current={active === key ? 'page' : undefined}
          >
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}

/** O cabeçalho pertence ao layout; o editor mantém a decisão de publicação ao vivo. */
export function TenantFrame({
  tenant,
  children,
}: {
  tenant: TenantIdentity;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const suffix = pathname?.split('/')[3];
  const active: Area =
    suffix === 'imagens' || suffix === 'trafego' || suffix === 'dados'
      ? suffix
      : 'site';
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  return (
    <RefreshTenant.Provider value={() => router.refresh()}>
      <HeaderSlot.Provider value={{ node }}>
        <div className="admin-tenant-frame">
          <TenantHeader tenant={tenant} active={active}>
            {active === 'site' ? (
              <div ref={setNode} className="admin-publish-slot" />
            ) : (
              <Link className="admin-primary" href={`/admin/${tenant.slug}`}>
                Revisar e publicar
              </Link>
            )}
          </TenantHeader>
          <div className="admin-tenant-content">{children}</div>
        </div>
      </HeaderSlot.Provider>
    </RefreshTenant.Provider>
  );
}

export function WorkspaceHeader({
  tenant,
  actions,
  note,
}: {
  tenant: TenantIdentity;
  actions: ReactNode;
  note?: string;
}) {
  const slot = useContext(HeaderSlot);
  const content = (
    <>
      {note ? <span className="admin-header-note">{note}</span> : null}
      {actions}
    </>
  );
  if (slot) return slot.node ? createPortal(content, slot.node) : null;
  // O workspace também é exercitado isoladamente pelos testes de navegador.
  return (
    <TenantHeader tenant={tenant} active="site">
      {content}
    </TenantHeader>
  );
}

export function MobileViews({
  value,
  onChange,
  second = 'Prévia',
}: {
  value: 'chat' | 'content';
  onChange: (value: 'chat' | 'content') => void;
  second?: string;
}) {
  return (
    <div className="admin-mobile-views" aria-label="Área de trabalho">
      <button
        type="button"
        aria-pressed={value === 'chat'}
        onClick={() => onChange('chat')}
      >
        Conversa
      </button>
      <button
        type="button"
        aria-pressed={value === 'content'}
        onClick={() => onChange('content')}
      >
        {second}
      </button>
    </div>
  );
}
