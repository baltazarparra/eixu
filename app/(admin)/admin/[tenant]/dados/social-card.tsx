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

  return (
    <section className="admin-form-section">
      <div className="flex flex-wrap items-start gap-5">
        {current?.avatarUrl ? (
          <Image
            src={current.avatarUrl}
            alt={`Foto de perfil de ${current.name ?? slug}`}
            width={80}
            height={80}
            unoptimized
            className="size-20 rounded-lg border object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">
            Perfil na rede social
            {current ? ` · ${NETWORK_LABEL[current.network]}` : ''}
          </h2>
          {!current ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Salve o briefing com um perfil para lermos nome, bio e foto.
            </p>
          ) : reading ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Lendo o perfil…
            </p>
          ) : pending ? (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              A leitura não terminou. Tente novamente ou siga pelo briefing.
            </p>
          ) : current.status === 'ok' ? (
            <>
              <p className="mt-1 text-sm">
                {current.name ?? current.url}
                {current.handle ? ` · @${current.handle}` : ''}
                {current.followers ? ` · ${current.followers}` : ''}
              </p>
              {current.bio ? (
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  {current.bio}
                </p>
              ) : null}
              {current.avatarNotes ? (
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Avatar: {current.avatarNotes}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Perfil bloqueado para consumo
              {current.motivo ? `: ${current.motivo}` : '.'} O agente vai usar
              só o briefing e as referências. Cole a bio em Fatos confirmados e
              envie a foto ou o logo abaixo.
            </p>
          )}
          {current && !reading ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Lido em {readableDate(current.lidoEm)}
            </p>
          ) : null}
          {hasSocialUrl ? (
            <button
              type="button"
              className="admin-secondary mt-4"
              onClick={() => void reload()}
              disabled={busy}
            >
              <RefreshCw size={15} />
              {busy ? 'Lendo…' : 'Ler perfil novamente'}
            </button>
          ) : null}
          {notice ? (
            <p
              aria-live="polite"
              className="mt-3 text-sm text-[var(--color-err)]"
            >
              {notice}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
