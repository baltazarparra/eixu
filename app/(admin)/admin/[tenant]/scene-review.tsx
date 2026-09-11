'use client';

import { useState } from 'react';
import type { SiteState } from '@/lib/admin/state';

export type PendingImage = SiteState['generation']['pendingImages'][number];

export type Decision = {
  action: 'aprovar' | 'recusar';
  feedback: string;
  alt: string;
  applyLogo: boolean;
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
 * A decisão de imagem é do operador, uma por vez. O cartão vem do estado
 * persistido, não das partes da conversa: o histórico restaura só texto, e
 * recarregar o painel não pode perder uma imagem esperando resposta.
 */
export function SceneReview({
  image,
  queued,
  covered,
  target,
  disabled,
  onDecide,
}: {
  image: PendingImage;
  queued: number;
  covered: number;
  target: number;
  disabled: boolean;
  onDecide: (decision: Decision) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [alt, setAlt] = useState(image.alt ?? '');
  const [applyLogo, setApplyLogo] = useState(false);
  const isLogo = image.kind === 'logo';
  const title = isLogo
    ? `Logo${image.variant ? ` · variante ${image.variant}` : ''}`
    : `Cena ${Math.min(covered + 1, target)} de ${target}${image.role ? ` · ${image.role}` : ''}`;

  return (
    <div className="mt-6 rounded-lg border bg-[var(--color-surface)] p-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-[var(--color-muted)]">
          #{image.seq} · {image.ratio}
          {image.targetBlock ? ` · ${image.targetBlock}` : ''}
        </span>
      </div>
      {/* Miniatura do Blob recém-gravado; o otimizador não agrega nada aqui. */}
      {/* oxlint-disable-next-line next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt ?? image.requestText}
        className={`mt-3 max-h-80 w-full rounded-md border object-contain ${isLogo ? CHECKER : 'bg-[var(--color-bg)]'}`}
      />
      <p className="mt-3 text-[var(--color-muted)]">{image.requestText}</p>
      <p className="mt-2">
        <span className={scoreTone(image.score)}>
          Crítica da IA: {image.score === null ? 'sem nota' : image.score}
        </span>
        <span className="text-[var(--color-muted)]">
          {' '}
          · ela não aprova nada, a decisão é sua.
        </span>
      </p>
      {image.critiqueError ? (
        <p className="mt-1 text-[var(--color-warn)]">
          A crítica falhou: {image.critiqueError}
        </p>
      ) : null}
      {image.problemas.length ? (
        <ul className="mt-1 list-disc pl-4 text-[var(--color-muted)]">
          {image.problemas.map((problema) => (
            <li key={problema}>{problema}</li>
          ))}
        </ul>
      ) : null}
      {image.usedInDraft ? (
        <p className="mt-2 text-[var(--color-warn)]">
          Esta imagem já está numa página do rascunho. Recusar exige trocar o
          bloco antes.
        </p>
      ) : null}

      <label className="admin-field mt-3">
        <span>Texto alternativo</span>
        <input
          className="admin-input"
          value={alt}
          maxLength={140}
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Descreva a cena para quem não vê a imagem"
        />
      </label>
      <label className="admin-field mt-2">
        <span>O que mudar, se for recusar</span>
        <textarea
          className="admin-input"
          rows={2}
          value={feedback}
          maxLength={400}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Opcional. Vira o pedido da próxima tentativa."
        />
      </label>
      {isLogo ? (
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={applyLogo}
            onChange={(event) => setApplyLogo(event.target.checked)}
          />
          <span>Aplicar como logo do site ao aprovar</span>
        </label>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="admin-primary"
          disabled={disabled}
          onClick={() =>
            onDecide({ action: 'aprovar', feedback, alt, applyLogo })
          }
        >
          Aprovar
        </button>
        <button
          type="button"
          className="admin-secondary"
          disabled={disabled}
          onClick={() =>
            onDecide({ action: 'recusar', feedback, alt, applyLogo: false })
          }
        >
          Recusar e gerar outra
        </button>
        {queued > 1 ? (
          <span className="text-[var(--color-muted)]">
            +{queued - 1} aguardando
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[var(--color-muted)]">
        Recusar apaga a imagem. Só as aprovadas ficam na biblioteca e entram no
        site.
      </p>
    </div>
  );
}
