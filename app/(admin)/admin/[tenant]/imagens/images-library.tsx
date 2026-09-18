'use client';

import { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { EmptyState, SegmentedControl } from '@/components/admin/primitives';
import { adminFetch } from '@/lib/admin/http';
import type { TenantImage } from '@/lib/types';
import {
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_HINT,
  imageUploadError,
} from '@/lib/images/upload-policy';

type LibraryState = {
  images: TenantImage[];
  logoUrl?: string | null;
};

export function ImagesLibrary({
  tenant,
  initial,
  basePath = '/admin',
}: {
  tenant: { slug: string; name: string };
  initial: LibraryState;
  basePath?: '/admin' | '/studio';
}) {
  const [library, setLibrary] = useState(initial);
  const [filter, setFilter] = useState<'todas' | 'foto' | 'logo'>('todas');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLibrary(
      await adminFetch<LibraryState>(`/api/admin/${tenant.slug}/images`),
    );
  }

  async function upload(files: File[]) {
    if (busy || !files.length) return;
    setBusy('upload');
    setNotice('');
    const saved: number[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        const error = imageUploadError(file);
        if (error) throw new Error(error);
        const body = new FormData();
        body.set('file', file);
        const response = await adminFetch<{ image: TenantImage }>(
          `/api/admin/${tenant.slug}/images`,
          { method: 'POST', body },
        );
        saved.push(response.image.seq);
      } catch (error) {
        failures.push(
          `${file.name}: ${error instanceof Error ? error.message : 'falha no envio'}`,
        );
      }
    }
    await refresh();
    setBusy(null);
    setNotice(
      [
        saved.length
          ? `Disponíveis: ${saved.map((seq) => `#${seq}`).join(', ')}.`
          : '',
        failures.length ? `Não enviadas: ${failures.join(' · ')}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }

  async function applyLogo(image: TenantImage) {
    setBusy(image.id);
    setNotice('');
    try {
      await adminFetch(`/api/admin/${tenant.slug}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ logoUrl: image.url }),
      });
      await refresh();
      setNotice(`Imagem #${image.seq} definida como logo.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Falha ao aplicar o logo.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(image: TenantImage) {
    setBusy(image.id);
    setNotice('');
    try {
      await adminFetch(`/api/admin/${tenant.slug}/images`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: image.id }),
      });
      await refresh();
      setNotice(`Imagem #${image.seq} apagada.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Falha ao apagar.');
    } finally {
      setBusy(null);
      setDeleteTarget(null);
    }
  }

  const visible = useMemo(
    () =>
      library.images.filter(
        (image) => filter === 'todas' || image.kind === filter,
      ),
    [filter, library.images],
  );
  const chatLink = (message: string) =>
    `${basePath}/${tenant.slug}?pedido=${encodeURIComponent(message)}`;

  return (
    <main className="admin-page admin-images-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">Acervo do projeto</p>
          <h1>Imagens</h1>
          <p>
            Cada arquivo recebe um número estável. Use esse número no chat para
            aplicar, substituir, recortar ou refinar a imagem no site.
          </p>
        </div>
        <div className="admin-page-actions">
          <Link
            className="admin-secondary"
            href={chatLink('Quero criar ou buscar imagens para o projeto: ')}
          >
            Pedir no chat
          </Link>
          <input
            ref={inputRef}
            hidden
            type="file"
            multiple
            accept={IMAGE_UPLOAD_ACCEPT}
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <button
            type="button"
            className="admin-primary"
            disabled={Boolean(busy)}
            onClick={() => inputRef.current?.click()}
          >
            {busy === 'upload' ? 'Enviando…' : 'Enviar imagens'}
          </button>
          <p className="admin-upload-hint">{IMAGE_UPLOAD_HINT}</p>
        </div>
      </div>

      {notice ? (
        <output className="admin-notice" aria-live="polite">
          {notice}
        </output>
      ) : null}

      <SegmentedControl
        label="Filtrar imagens"
        value={filter}
        onChange={setFilter}
        options={[
          ['todas', 'Todas'],
          ['foto', 'Fotos'],
          ['logo', 'Logos'],
        ]}
      />

      {visible.length ? (
        <ul className="admin-image-grid">
          {visible.map((image) => (
            <li key={image.id} className="admin-image-card">
              <div className="admin-image-asset">
                <Image
                  src={image.url}
                  alt={image.alt ?? `Imagem #${image.seq}`}
                  width={480}
                  height={320}
                  unoptimized
                />
                <span className="admin-image-number">#{image.seq}</span>
              </div>
              <div className="admin-image-card-body">
                <strong>
                  {image.alt || image.requestText || 'Sem descrição'}
                </strong>
                <small>
                  {image.width && image.height
                    ? `${image.width} × ${image.height}`
                    : image.ratio}
                </small>
                <div className="admin-image-actions">
                  <Link
                    className="admin-secondary"
                    href={chatLink(
                      `Use a imagem #${image.seq} no projeto. Antes de alterar, confirme onde ela deve entrar.`,
                    )}
                  >
                    Usar no site
                  </Link>
                  <button
                    type="button"
                    className="admin-secondary"
                    disabled={Boolean(busy) || library.logoUrl === image.url}
                    onClick={() => void applyLogo(image)}
                  >
                    {library.logoUrl === image.url
                      ? 'Logo atual'
                      : 'Usar como logo'}
                  </button>
                  <button
                    type="button"
                    className="admin-secondary admin-image-remove"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      deleteTarget === image.id
                        ? void remove(image)
                        : setDeleteTarget(image.id)
                    }
                  >
                    {deleteTarget === image.id
                      ? 'Confirmar exclusão'
                      : 'Apagar'}
                  </button>
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
        >
          Envie material do cliente ou peça ao agente para criar e organizar as
          imagens necessárias.
        </EmptyState>
      )}
    </main>
  );
}
