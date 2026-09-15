'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/admin/http';
import type { SocialProfile } from '@/lib/social-profile';

const NETWORK_LABEL = { instagram: 'Instagram', linkedin: 'LinkedIn' } as const;
// Leitura interrompida deixaria "lendo" gravado; a consulta desiste em 60 s.
const POLL_MS = 3000;
const POLL_ATTEMPTS = 20;

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Controlado pelo formulário: o estado do perfil tem um dono só. */
export function SocialProfileCard({
  slug,
  social: current,
  hasSocialUrl,
  onChange,
}: {
  slug: string;
  social: SocialProfile | null;
  hasSocialUrl: boolean;
  onChange: (social: SocialProfile | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  // Guarda a leitura que ficou sem resposta: uma leitura nova tem outro
  // lidoEm e volta a ser acompanhada, sem reset dentro do efeito.
  const [gaveUpAt, setGaveUpAt] = useState<string | null>(null);

  const pending = current?.status === 'lendo';
  const startedAt = current?.lidoEm;
  const reading = pending && gaveUpAt !== startedAt;

  useEffect(() => {
    if (!pending) return;
    let attempts = 0;
    let cancelled = false;
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > POLL_ATTEMPTS) {
        clearInterval(timer);
        setGaveUpAt(startedAt ?? null);
        return;
      }
      try {
        const { social: next } = await adminFetch<{
          social: SocialProfile | null;
        }>(`/api/admin/${slug}/social`);
        if (
          !cancelled &&
          (!next || next.status !== 'lendo' || next.readId !== current?.readId)
        ) {
          clearInterval(timer);
          onChange(next);
        }
      } catch {
        clearInterval(timer);
        setGaveUpAt(startedAt ?? null);
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pending, startedAt, current?.readId, slug, onChange]);

  const reload = useCallback(async () => {
    setBusy(true);
    setNotice('');
    setGaveUpAt(null);
    try {
      const { social: next } = await adminFetch<{ social: SocialProfile }>(
        `/api/admin/${slug}/social`,
        { method: 'POST' },
      );
      onChange(next);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível ler o perfil.',
      );
    } finally {
      setBusy(false);
    }
  }, [slug, onChange]);

  if (!hasSocialUrl && !current) return null;

  const identity =
    current?.status === 'ok'
      ? [
          current.handle ? `@${current.handle}` : (current.name ?? current.url),
          current.followers ? `${current.followers} seguidores` : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <div className="admin-social-card">
      {current?.avatarUrl ? (
        <Image
          src={current.avatarUrl}
          alt={`Foto de perfil de ${current.name ?? slug}`}
          width={40}
          height={40}
          unoptimized
          className="admin-social-avatar"
        />
      ) : null}
      <div className="admin-social-identity">
        {!current ? (
          <span>Salve o briefing com um perfil para lermos nome, bio e foto.</span>
        ) : reading ? (
          <span>Lendo o perfil…</span>
        ) : pending ? (
          <span>
            A leitura não terminou. Tente novamente ou siga pelo briefing.
          </span>
        ) : current.status === 'ok' ? (
          <span>{identity}</span>
        ) : (
          <span>
            Perfil bloqueado para consumo
            {current.motivo ? `: ${current.motivo}` : '.'} O agente vai usar só
            o briefing e as referências. Cole a bio em Fatos confirmados e envie
            a foto ou o logo abaixo.
          </span>
        )}
        {current && !reading ? (
          <small>
            {NETWORK_LABEL[current.network]} · perfil lido em{' '}
            {readableDate(current.lidoEm)}
          </small>
        ) : null}
      </div>
      {hasSocialUrl ? (
        <button
          type="button"
          className="admin-compact-button"
          onClick={() => void reload()}
          disabled={busy}
        >
          <RefreshCw size={13} aria-hidden="true" />
          {busy ? 'Lendo…' : 'Ler de novo'}
        </button>
      ) : null}
      {current?.status === 'ok' && (current.bio || current.avatarNotes) ? (
        <p className="admin-social-detail">
          {current.bio}
          {current.bio && current.avatarNotes ? ' ' : ''}
          {current.avatarNotes ? `Avatar: ${current.avatarNotes}` : ''}
        </p>
      ) : null}
      {notice ? (
        <p aria-live="polite" className="admin-social-detail" data-tone="err">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
