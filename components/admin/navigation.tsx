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
import { ArrowLeft, MessageSquare, Smartphone } from 'lucide-react';
import { StatusPill } from './primitives';
import { useAdminSession } from './session';
import { MobileMenu } from './mobile-menu';

type TenantIdentity = { slug: string; name: string; status?: string };
type Area = 'site' | 'imagens' | 'trafego' | 'dados' | 'consumo';
/** Pontos de montagem na barra para os controles vivos do editor. */
type HeaderSlots = {
  conversation: HTMLDivElement | null;
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
  ['consumo', '/consumo', 'Consumo'],
] as const;

function statusPresentation(status?: string) {
  if (status === 'published')
    return { label: 'Publicado', tone: 'ok' as const };
  if (status === 'archived')
    return { label: 'Arquivado', tone: 'neutral' as const };
  return { label: 'Rascunho', tone: 'warn' as const };
}

/**
 * Barra única de 64 px: identidade, áreas do cliente, controles da prévia e a
 * decisão de publicação na mesma régua. Três cabeçalhos empilhados somavam
 * 207 px antes de qualquer conteúdo e abriam o mesmo rascunho por dois botões.
 */
function TenantHeader({
  tenant,
  active,
  conversation,
  preview,
  decision,
}: {
  tenant: TenantIdentity;
  active: Area;
  conversation?: ReactNode;
  preview?: ReactNode;
  decision?: ReactNode;
}) {
  const root = `/admin/${tenant.slug}`;
  const session = useAdminSession();
  const status = statusPresentation(tenant.status);
  const links = AREAS.map(([key, suffix, label]) => (
    <Link
      key={key}
      href={`${root}${suffix}`}
      aria-current={active === key ? 'page' : undefined}
    >
      {label}
    </Link>
  ));
  return (
    <header className="admin-bar">
      <div className="admin-bar-identity">
        <Link
          href="/admin"
          className="admin-secondary admin-back"
          aria-label="Voltar para a lista de clientes"
          title="Clientes"
        >
          <ArrowLeft size={15} aria-hidden="true" />
        </Link>
        {conversation}
        <div>
          <div>
            <strong>{tenant.name}</strong>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
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
        {links}
      </nav>
      {preview}
      <div className="admin-bar-decide">
        {decision}
        <Link
          className="admin-activity-link"
          href={`/admin/atividade?tenant=${encodeURIComponent(tenant.slug)}`}
          title={`Atividade · ${session?.operator ?? 'operação'}`}
        >
          {session?.operator ?? 'Atividade'}
        </Link>
        <div className="admin-bar-logout">{session?.logout}</div>
      </div>
      <MobileMenu
        name={tenant.name}
        status={tenant.status}
        logout={session?.logout}
      >
        <nav aria-label="Áreas do cliente no celular">
          {links}
          <Link
            href={`/admin/atividade?tenant=${encodeURIComponent(tenant.slug)}`}
          >
            Atividade · {session?.operator ?? 'operação'}
          </Link>
        </nav>
      </MobileMenu>
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
    suffix === 'imagens' ||
    suffix === 'trafego' ||
    suffix === 'dados' ||
    suffix === 'consumo'
      ? suffix
      : 'site';
  const [conversation, setConversation] = useState<HTMLDivElement | null>(null);
  const [preview, setPreview] = useState<HTMLDivElement | null>(null);
  const [decision, setDecision] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(
    () => ({ conversation, preview, decision }),
    [conversation, preview, decision],
  );
  const editor = active === 'site';
  return (
    <RefreshTenant.Provider value={() => router.refresh()}>
      <HeaderSlot.Provider value={slots}>
        <div className="admin-tenant-frame">
          <TenantHeader
            tenant={tenant}
            active={active}
            conversation={
              editor ? (
                <div ref={setConversation} className="admin-bar-slot" />
              ) : null
            }
            preview={
              editor ? (
                <div ref={setPreview} className="admin-bar-slot" />
              ) : null
            }
            decision={
              editor ? (
                <div ref={setDecision} className="admin-bar-slot" />
              ) : (
                <Link className="admin-primary" href={`/admin/${tenant.slug}`}>
                  <span className="admin-preview-link-desktop">
                    Revisar e publicar
                  </span>
                  <span className="admin-preview-link-mobile">Ver prévia</span>
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
  conversation,
  preview,
  decision,
}: {
  tenant: TenantIdentity;
  /** Recolhe ou reabre a conversa, junto do retorno à lista de clientes. */
  conversation: ReactNode;
  /** Grupo PRÉVIA: página em foco, largura e abrir em outra aba. */
  preview: ReactNode;
  /** O que condiciona a publicação: andamento, aviso de revisão e Publicar. */
  decision: ReactNode;
}) {
  const slots = useContext(HeaderSlot);
  if (slots) {
    return (
      <>
        {slots.conversation
          ? createPortal(conversation, slots.conversation)
          : null}
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
      conversation={conversation}
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
    <fieldset className="admin-mobile-views" aria-label="Área de trabalho">
      <button
        type="button"
        aria-pressed={value === 'chat'}
        aria-controls="admin-conversation"
        onClick={() => onChange('chat')}
      >
        <MessageSquare size={18} aria-hidden="true" /> Conversa
      </button>
      <button
        type="button"
        aria-pressed={value === 'content'}
        aria-controls="admin-preview"
        onClick={() => onChange('content')}
      >
        <Smartphone size={18} aria-hidden="true" /> {second}
      </button>
    </fieldset>
  );
}
