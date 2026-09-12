'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { StatusPill } from './primitives';
import { useAdminSession } from './session';

type TenantIdentity = { slug: string; name: string; status?: string };
type Area = 'site' | 'imagens' | 'trafego' | 'dados';
/** Dois pontos de montagem na barra: o grupo da prévia e o da decisão. */
type HeaderSlots = {
  preview: HTMLDivElement | null;
  decision: HTMLDivElement | null;
};
const HeaderSlot = createContext<HeaderSlots | null>(null);
const RefreshTenant = createContext<(() => void) | undefined>(undefined);

export function useRefreshTenant() {
  return useContext(RefreshTenant);
}

const AREAS = [
  ['site', '', 'Site'],
  ['imagens', '/imagens', 'Imagens'],
  ['trafego', '/trafego', 'Tráfego'],
  ['dados', '/dados', 'Dados'],
] as const;

/**
 * Barra única de 64 px: identidade, áreas do cliente, controles da prévia e a
 * decisão de publicação na mesma régua. Três cabeçalhos empilhados somavam
 * 207 px antes de qualquer conteúdo e abriam o mesmo rascunho por dois botões.
 */
function TenantHeader({
  tenant,
  active,
  preview,
  decision,
}: {
  tenant: TenantIdentity;
  active: Area;
  preview?: ReactNode;
  decision?: ReactNode;
}) {
  const root = `/admin/${tenant.slug}`;
  const session = useAdminSession();
  return (
    <header className="admin-bar">
      <div className="admin-bar-identity">
        <Link
          href="/admin"
          className="admin-back"
          aria-label="Voltar para a lista de clientes"
          title="Clientes"
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </Link>
        <div>
          <div>
            <strong>{tenant.name}</strong>
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
      </div>
      <nav className="admin-bar-nav" aria-label="Área do cliente">
        {AREAS.map(([key, suffix, label]) => (
          <Link
            key={key}
            href={`${root}${suffix}`}
            aria-current={active === key ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {preview}
      <div className="admin-bar-decide">
        {decision}
        {session?.logout}
      </div>
    </header>
  );
}

/**
 * O cabeçalho pertence ao layout; o editor injeta pelos slots o que muda ao
 * vivo (página em foco, largura, abrir em outra aba, andamento e Publicar).
 */
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
  const [preview, setPreview] = useState<HTMLDivElement | null>(null);
  const [decision, setDecision] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(() => ({ preview, decision }), [preview, decision]);
  const editor = active === 'site';
  return (
    <RefreshTenant.Provider value={() => router.refresh()}>
      <HeaderSlot.Provider value={slots}>
        <div className="admin-tenant-frame">
          <TenantHeader
            tenant={tenant}
            active={active}
            preview={
              editor ? <div ref={setPreview} className="admin-bar-slot" /> : null
            }
            decision={
              editor ? (
                <div ref={setDecision} className="admin-bar-slot" />
              ) : (
                <Link className="admin-primary" href={`/admin/${tenant.slug}`}>
                  Revisar e publicar
                </Link>
              )
            }
          />
          <div className="admin-tenant-content">{children}</div>
        </div>
      </HeaderSlot.Provider>
    </RefreshTenant.Provider>
  );
}

export function WorkspaceHeader({
  tenant,
  preview,
  decision,
}: {
  tenant: TenantIdentity;
  /** Grupo PRÉVIA: página em foco, largura e abrir em outra aba. */
  preview: ReactNode;
  /** O que condiciona a publicação: andamento, aviso de revisão e Publicar. */
  decision: ReactNode;
}) {
  const slots = useContext(HeaderSlot);
  if (slots) {
    return (
      <>
        {slots.preview ? createPortal(preview, slots.preview) : null}
        {slots.decision ? createPortal(decision, slots.decision) : null}
      </>
    );
  }
  // O workspace também é exercitado isoladamente pelos testes de navegador.
  return (
    <TenantHeader
      tenant={tenant}
      active="site"
      preview={preview}
      decision={decision}
    />
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
