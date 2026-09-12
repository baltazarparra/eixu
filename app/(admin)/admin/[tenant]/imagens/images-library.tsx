'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  SegmentedControl,
  StatusPill,
} from '@/components/admin/primitives';
import { adminFetch } from '@/lib/admin/http';
import type { ImageUsage } from '@/lib/images/usage';
import type { ImageGuide, TenantImage } from '@/lib/types';

type LibraryState = {
  guide: ImageGuide;
  images: TenantImage[];
  logoUrl?: string | null;
  usage: Record<string, ImageUsage[]>;
};

function usageLabel(items: ImageUsage[]): string {
  if (!items.length) return 'Fora das páginas';
  const scope = (name: ImageUsage['scope']) => {
    const matches = items.filter((item) => item.scope === name);
    if (!matches.length) return null;
    const labels = [
      ...new Set(
        matches.map((item) =>
          item.kind === 'logo' ? 'logo' : (item.page ?? 'página'),
        ),
      ),
    ];
    return `${name === 'draft' ? 'Rascunho' : 'Publicado'}: ${labels.join(', ')}`;
  };
  return [scope('draft'), scope('published')].filter(Boolean).join(' · ');
}

function scoreTone(score: number | null) {
  return score === null
    ? 'neutral'
    : score >= 8
      ? 'ok'
      : score >= 6
        ? 'neutral'
        : 'err';
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
      library.images.filter(
        (image) =>
          filter === 'todas' ||
          (filter === 'rejeitada'
            ? image.status === 'rejeitada'
            : image.status !== 'rejeitada' && image.kind === filter),
      ),
    [library.images, filter],
  );
  const guide = library.guide;
  const chatLink = (request: string) =>
    `/admin/${tenant.slug}?pedido=${encodeURIComponent(request)}`;
  return (
    <>
      <main className="admin-page admin-images-page">
        <div className="admin-page-heading">
          <div>
            <h1>Imagens</h1>
            <p>
              Peça uma mudança pelo número no chat: “atualize a imagem{' '}
              <strong className="admin-numeric">#5</strong>”. A nova versão
              troca os rascunhos e preserva a original.
            </p>
          </div>
          <div className="admin-page-actions">
            <Link
              className="admin-secondary"
              href={chatLink('Quero editar o guia de imagem: ')}
            >
              Editar guia
            </Link>
            <Link
              className="admin-primary"
              href={chatLink('Quero gerar novas imagens para o site: ')}
            >
              Gerar imagens
            </Link>
          </div>
        </div>
        {notice ? (
          <output className="admin-notice" aria-live="polite">
            {notice}
          </output>
        ) : null}
        <div className="admin-images-layout">
          <aside className="admin-image-guide">
            <h2 className="admin-label">Guia de imagem</h2>
            <dl>
              {(
                [
                  ['Estilo', guide.estilo],
                  ['Luz', guide.luz],
                  ['Paleta', guide.paleta],
                  ['Ambientes', guide.ambientes],
                  ['Sujeitos', guide.sujeitos],
                  ['Nunca', guide.nunca],
                ] as const
              ).map(([label, value]) => (
                <div key={label} data-negative={label === 'Nunca' || undefined}>
                  <dt>{label}</dt>
                  <dd>
                    {Array.isArray(value) ? (
                      value.length ? (
                        <ul className="admin-guide-chips">
                          {value.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        'Não informado'
                      )
                    ) : (
                      value || 'Não informado'
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              {guide.notas ||
                'O guia orienta a geração. As imagens ficam disponíveis assim que são criadas; a crítica ajuda a escolher os ajustes.'}
            </p>
            <Link
              className="admin-secondary"
              href={chatLink('Quero definir o guia de imagem: ')}
            >
              Ajustar na conversa
            </Link>
          </aside>
          <section
            className="admin-image-collection"
            aria-label="Acervo de imagens"
          >
            <div className="admin-image-toolbar">
              <SegmentedControl
                label="Filtrar imagens"
                value={filter}
                onChange={setFilter}
                options={[
                  ['todas', `Todas ${library.images.length}`],
                  ['foto', 'Fotos'],
                  ['logo', 'Logos'],
                  ['rejeitada', 'Rejeitadas'],
                ]}
              />
            </div>
            {visible.length ? (
              <ul className="admin-image-grid">
                {visible.map((image) => (
                  <li key={image.id} className="admin-image-card">
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="admin-image-frame"
                      data-ratio={image.ratio}
                      data-kind={image.kind}
                    >
                      <span className="admin-image-status">
                        <StatusPill
                          tone={image.status === 'rejeitada' ? 'err' : 'ok'}
                        >
                          {image.status === 'rejeitada'
                            ? 'Rejeitada'
                            : 'Disponível'}
                        </StatusPill>
                      </span>
                      <span className="admin-image-number">#{image.seq}</span>
                      <span className="admin-image-ratio">{image.ratio}</span>

                      {/* Arquivo no Blob; o otimizador não agrega nada aqui. */}
                      {/* oxlint-disable-next-line next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.alt ?? image.requestText}
                        className="admin-image"
                        loading="lazy"
                      />
                    </a>
                    <div className="admin-image-caption">
                      <p
                        title={
                          image.description ?? image.alt ?? image.requestText
                        }
                      >
                        {image.description ?? image.alt ?? image.requestText}
                      </p>
                      <div className="admin-image-meta">
                        <span>
                          {image.kind}
                          {image.url === library.logoUrl
                            ? ' · logo do site'
                            : ''}
                        </span>
                        <span data-tone={scoreTone(image.score)}>
                          {image.score === null
                            ? 'sem crítica'
                            : `${image.score.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 10`}
                        </span>
                      </div>
                      <p
                        className="admin-image-usage"
                        title={(library.usage[image.id] ?? [])
                          .map((item) =>
                            item.kind === 'logo'
                              ? `${item.scope}: logo`
                              : `${item.scope}: ${item.page} · bloco ${item.block}`,
                          )
                          .join('\n')}
                      >
                        {usageLabel(library.usage[image.id] ?? [])}
                      </p>
                      <div className="admin-image-actions">
                        {image.status !== 'rejeitada' &&
                        image.kind === 'logo' &&
                        image.url !== library.logoUrl ? (
                          <button
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() =>
                              void applyAsLogo(image.url, image.seq)
                            }
                            className="admin-secondary"
                          >
                            Usar como logo
                          </button>
                        ) : null}
                        {image.status !== 'rejeitada' &&
                        image.kind !== 'logo' ? (
                          <Link
                            href={chatLink(
                              `Quero usar a imagem #${image.seq} no site: `,
                            )}
                            className="admin-secondary"
                          >
                            Usar no site
                          </Link>
                        ) : null}
                        <a
                          href={`/admin/${tenant.slug}?imagem=${image.seq}`}
                          aria-label={`Solicitar alteração da imagem #${image.seq}`}
                          className="admin-secondary"
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
                          className="admin-secondary admin-image-remove"
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
              <EmptyState
                kind="images"
                title={
                  library.images.length
                    ? 'Nenhuma imagem neste filtro'
                    : 'O acervo ainda está vazio'
                }
                action={
                  <Link
                    className="admin-secondary"
                    href={chatLink(
                      'Quero definir o guia e gerar imagens para o site: ',
                    )}
                  >
                    Definir guia na conversa
                  </Link>
                }
              >
                {library.images.length
                  ? 'Escolha outro filtro para ver o restante do acervo.'
                  : 'Defina o estilo, a paleta e o que nunca pode aparecer. Depois, peça as imagens na conversa do site.'}
              </EmptyState>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
