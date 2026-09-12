'use client';

import { useState } from 'react';
import {
  VIBES,
  VIBE_HINT,
  VIBE_LABEL,
  VIBE_PALETTE,
  type Vibe,
} from '@/lib/design/vibes';

const COLORS = [
  ['primary', 'Cor primária', 'Seções e superfícies com a cor da marca.'],
  ['secondary', 'Cor secundária', 'Tom complementar para o ritmo das seções.'],
  ['highlight', 'Cor de acento', 'Botões, links e destaques.'],
] as const;

/** A mesma microcomposição torna as quatro linguagens comparáveis. */
export function VibePreview({ vibe }: { vibe: Vibe }) {
  return (
    <span className="admin-vibe-preview" data-vibe={vibe} aria-hidden="true">
      <span className="admin-vibe-nav" />
      <span className="admin-vibe-copy">
        <span />
        <span />
        <span />
      </span>
      <span className="admin-vibe-image" />
      <span className="admin-vibe-accent" />
    </span>
  );
}

/**
 * A paleta inicial é uma sugestão visual. Ela só vira decisão imutável do
 * operador quando ele edita uma cor; assim o agente pode adaptar o ponto de
 * partida ao negócio sem sobrescrever uma escolha consciente.
 */
export function BrandFields() {
  const [vibe, setVibe] = useState<Vibe>('comercial');
  const [values, setValues] = useState<Record<string, string>>(
    VIBE_PALETTE.comercial,
  );
  const [paletteEdited, setPaletteEdited] = useState(false);

  function chooseVibe(next: Vibe) {
    setVibe(next);
    if (!paletteEdited) setValues(VIBE_PALETTE[next]);
  }

  function changeColor(name: string, value: string) {
    setPaletteEdited(true);
    setValues((current) => ({ ...current, [name]: value }));
  }

  function resetPalette() {
    setPaletteEdited(false);
    setValues(VIBE_PALETTE[vibe]);
  }

  return (
    <>
      <fieldset className="mt-7 border-t pt-6">
        <legend className="text-base font-semibold">Direção visual</legend>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
          Compare as quatro direções. A escolha coordena tipografia, navegação,
          escala, ícones, imagens e ritmo do site inteiro. Se você informar
          referências, elas terão prioridade no visual; a vibe completa o que
          faltar e continua definindo a voz.
        </p>
        <div className="admin-vibe-grid">
          {VIBES.map((option) => (
            <label key={option} className="admin-vibe-card">
              <VibePreview vibe={option} />
              <span className="admin-vibe-choice">
                <input
                  type="radio"
                  name="vibe"
                  value={option}
                  checked={vibe === option}
                  onChange={() => chooseVibe(option)}
                />
                <strong>{VIBE_LABEL[option]}</strong>
              </span>
              <small>{VIBE_HINT[option]}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <details className="admin-optional-fields mt-7 border-t pt-6">
        <summary>Marca, logo e cores</summary>
        <p className="mt-2 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
          A sugestão muda com a direção visual. Edite apenas quando houver uma
          cor oficial; a partir daí o agente preserva sua escolha.
        </p>
        <input
          type="hidden"
          name="paletteSource"
          value={paletteEdited ? 'operador' : 'sugerida'}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="admin-field">
            <span>Logo do cliente</span>
            <input
              className="admin-input"
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
            />
            <small className="text-[var(--color-muted)]">
              Opcional, até 8 MB. Pode enviar depois em Dados.
            </small>
          </label>
          <div className="admin-field">
            <span>Origem da paleta</span>
            <strong>
              {paletteEdited
                ? 'Cores confirmadas por você'
                : 'Sugestão da vibe'}
            </strong>
            {paletteEdited ? (
              <button
                type="button"
                className="admin-inline-action"
                onClick={resetPalette}
              >
                Voltar à sugestão
              </button>
            ) : null}
          </div>
          {COLORS.map(([name, label, hint]) => (
            <label key={name} className="admin-field">
              <span>{label}</span>
              <span className="flex items-center gap-3">
                <input
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(values[name])
                      ? values[name]
                      : VIBE_PALETTE[vibe][name]
                  }
                  aria-label={label}
                  onChange={(event) => changeColor(name, event.target.value)}
                  className="admin-color"
                  aria-describedby={`${name}-hint`}
                />
                <input
                  className="admin-input admin-numeric"
                  name={name}
                  aria-label={`${label} em hexadecimal`}
                  value={values[name]}
                  pattern="#[0-9A-Fa-f]{6}"
                  maxLength={7}
                  required
                  onChange={(event) => changeColor(name, event.target.value)}
                />
              </span>
              <small id={`${name}-hint`} className="text-[var(--color-muted)]">
                {hint}
              </small>
            </label>
          ))}
        </div>
      </details>
    </>
  );
}
