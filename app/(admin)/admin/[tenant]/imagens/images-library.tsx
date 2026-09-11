'use client';

import { useMemo, useState } from 'react';
import { AdminHeader } from '@/components/admin/navigation';
import { adminFetch } from '@/lib/admin/http';
import type { ImageGuide, TenantImage } from '@/lib/types';

type LibraryState = {
  guide: ImageGuide;
  images: TenantImage[];
  logoUrl?: string | null;
};

/** Xadrez atrás do logo, para a transparência ficar visível. */
const CHECKER =
  'bg-[conic-gradient(#d8d8d8_25%,#ffffff_0_50%,#d8d8d8_0_75%,#ffffff_0)] bg-[length:16px_16px]';

/** Cor da nota: verde a partir de 7, amarelo de 5 a 7, vermelho abaixo. */
function scoreTone(score: number | null): string {
  if (score === null) return 'text-[var(--color-muted)]';
  if (score >= 7) return 'text-[var(--color-ok)]';
  if (score >= 5) return 'text-[var(--color-warn)]';
  return 'text-[var(--color-err)]';
}

/**
 * Acervo numerado do cliente, disponível assim que a imagem é gerada.
 * Alterações são pedidas no chat; a remoção continua protegida por uso.
 */
export function ImagesLibrary({
  tenant,
  initial,
}: {
  tenant: { slug: string; name: string };
  initial: LibraryState;
}) {
  const [library, setLibrary] = useState<LibraryState>(initial);
  const [actionId, setActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todas' | 'foto' | 'logo' | 'rejeitada'>(
    'todas',
  );

  async function runAction(id: string, run: () => Promise<void>) {
    if (actionId) return;
    setActionId(id);
    setNotice(null);
    try {
      await run();
      const next = await adminFetch<LibraryState>(
        `/api/admin/${tenant.slug}/images`,
      );
      setLibrary(next);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a ação.',
      );
    } finally {
      setActionId(null);
      setDeleteTarget(null);
    }
  }

  async function applyAsLogo(url: string, seq: number) {
    await runAction(url, async () => {
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: url }),
      });
      setNotice(`Logo #${seq} aplicado no site.`);
    });
  }

  async function remove(id: string, seq: number) {
    await runAction(id, async () => {
      await adminFetch(`/api/admin/${tenant.slug}/images`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setNotice(`Imagem #${seq} apagada.`);
    });
  }

  const visible = useMemo(
    () =>
      library.images.filter((image) =>
        filter === 'rejeitada'
          ? image.status === 'rejeitada'
          : image.status !== 'rejeitada' &&
            (filter === 'todas' || image.kind === filter),
      ),
    [library.images, filter],
  );
  const guide = library.guide;
  const guideText = [
    guide.estilo,
    guide.luz,
    guide.paleta?.join(', '),
    guide.ambientes?.join(', '),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <AdminHeader tenant={tenant} active="imagens" />
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight">Imagens</h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">
          As imagens ficam salvas aqui e podem ser usadas no site sem aprovação.
          Para mudar uma delas, informe o número na conversa do site: “quero
          atualizar a imagem #5, quero outro carro”. A nova versão ganha outro
          número e substitui a anterior nos rascunhos; ambas ficam na
          biblioteca.
        </p>
        {guideText ? (
          <p className="mt-2 max-w-2xl text-xs text-[var(--color-muted)]">
            Guia de imagem: {guideText}
          </p>
        ) : null}
        {notice ? (
          <output className="admin-notice mt-5 block" aria-live="polite">
            {notice}
          </output>
        ) : null}

        <div
          className="mt-7 mb-6 flex gap-1 border-b pb-5"
          aria-label="Filtrar imagens"
        >
          {(
            [
              ['todas', 'Todas'],
              ['foto', 'Fotos'],
              ['logo', 'Logos'],
              ['rejeitada', 'Rejeitadas'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-3 py-2 text-xs ${
                filter === value
                  ? 'bg-[var(--color-surface-2)]'
                  : 'text-[var(--color-muted)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {visible.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((image) => (
              <li
                key={image.id}
                className={`flex flex-col overflow-hidden rounded-lg border bg-[var(--color-bg)] ${
                  image.status === 'rejeitada' ? 'opacity-60' : ''
                }`}
              >
                <a
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`block ${image.kind === 'logo' ? CHECKER : 'bg-black/20'}`}
                >
                  {/* Arquivo no Blob; o otimizador não agrega nada aqui. */}
                  {/* oxlint-disable-next-line next/no-img-element */}
                  <img
                    src={image.url}
                    alt={image.alt ?? image.requestText}
                    className={`w-full object-contain ${image.kind === 'logo' ? 'max-h-52 p-4' : 'max-h-72'}`}
                    loading="lazy"
                  />
                </a>
                <div className="flex flex-col gap-2 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono">#{image.seq}</span>
                    <span className={`font-medium ${scoreTone(image.score)}`}>
                      {image.score === null
                        ? 'sem nota'
                        : image.score.toFixed(1)}
                    </span>
                    <span className="text-[var(--color-muted)]">
                      {image.kind === 'logo'
                        ? (image.critique.variante ?? 'logo')
                        : image.ratio}
                    </span>
                    {image.url === library.logoUrl ? (
                      <span className="rounded-full bg-[color-mix(in_oklab,var(--color-accent)_25%,transparent)] px-2 py-0.5 text-[0.65rem] text-[var(--color-accent)]">
                        Logo do site
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[0.7rem] leading-snug text-[var(--color-muted)]">
                    {image.alt ?? image.requestText}
                  </p>

                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {image.status !== 'rejeitada' &&
                    image.kind === 'logo' &&
                    image.url !== library.logoUrl ? (
                      <button
                        type="button"
                        disabled={Boolean(actionId)}
                        onClick={() => void applyAsLogo(image.url, image.seq)}
                        className="rounded-md border px-2.5 py-1 text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                      >
                        Usar como logo
                      </button>
                    ) : null}
                    {image.status !== 'rejeitada' && image.kind !== 'logo' ? (
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(`usa a imagem #${image.seq} no hero`)
                            .then(
                              () =>
                                setNotice(
                                  `Pedido copiado. Cole na conversa do site para aplicar a imagem #${image.seq}.`,
                                ),
                              () =>
                                setNotice(
                                  `No chat do site, peça: use a imagem #${image.seq} no hero.`,
                                ),
                            );
                        }}
                        className="rounded-md border px-2.5 py-1 text-[0.7rem] text-[var(--color-muted)]"
                      >
                        Usar no site
                      </button>
                    ) : null}
                    <a
                      href={`/admin/${tenant.slug}?imagem=${image.seq}`}
                      aria-label={`Solicitar alteração da imagem #${image.seq}`}
                      className="rounded-md border px-2.5 py-1 text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    >
                      Solicitar alteração
                    </a>
                    <button
                      type="button"
                      disabled={Boolean(actionId)}
                      onClick={() =>
                        deleteTarget === image.id
                          ? void remove(image.id, image.seq)
                          : setDeleteTarget(image.id)
                      }
                      className="ml-auto rounded-md px-2 py-1 text-[0.7rem] text-[var(--color-muted)] hover:text-[var(--color-err)]"
                    >
                      {deleteTarget === image.id
                        ? 'Confirmar exclusão'
                        : 'Apagar'}
                    </button>
                    {deleteTarget === image.id ? (
                      <button
                        type="button"
                        className="admin-secondary"
                        onClick={() => setDeleteTarget(null)}
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--color-muted)]">
            {filter === 'rejeitada'
              ? 'Nenhuma imagem rejeitada.'
              : library.images.length
                ? 'Nenhuma imagem neste filtro.'
                : 'As imagens geradas na conversa do site ficam aqui.'}
          </p>
        )}
      </main>
    </>
  );
}
