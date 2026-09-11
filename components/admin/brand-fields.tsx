'use client';

import { useState } from 'react';
import { VIBES, VIBE_HINT, VIBE_LABEL } from '@/lib/design/vibes';

/**
 * Marca do cliente no cadastro. Definir logo e cores aqui evita que o agente
 * invente uma paleta que depois precisa ser desfeita: a direção de arte
 * escolhe estrutura e tipografia, não a cor da marca.
 */
const COLORS = [
  [
    'primary',
    'Cor primária',
    '#1f6feb',
    'Seções e superfícies com a cor da marca.',
  ],
  [
    'secondary',
    'Cor secundária',
    '#14532d',
    'Tom complementar, para alternar o ritmo das seções.',
  ],
  ['highlight', 'Cor de acento', '#1f6feb', 'Botões, links e destaques.'],
] as const;

export function BrandFields() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(COLORS.map(([name, , initial]) => [name, initial])),
  );

  return (
    <>
      <fieldset className="mt-7 border-t pt-6">
        <legend className="text-base font-semibold">Vibe do site</legend>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
          Define a linguagem visual que o agente pode usar: tipografia, ritmo,
          superfícies e tratamento de imagem. Vale para o site inteiro e é
          escolhida só aqui; mudar depois exige reconstruir as páginas.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {VIBES.map((vibe, index) => (
            <label
              key={vibe}
              className="flex cursor-pointer flex-col gap-1.5 rounded-lg border p-4 text-sm has-checked:border-[var(--color-accent)]"
            >
              <span className="flex items-center gap-3 font-medium">
                <input
                  type="radio"
                  name="vibe"
                  value={vibe}
                  defaultChecked={index === 0}
                  className="shrink-0"
                />
                {VIBE_LABEL[vibe]}
              </span>
              <small className="text-[12.5px] leading-relaxed text-[var(--color-muted)]">
                {VIBE_HINT[vibe]}
              </small>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-7 border-t pt-6">
        <h2 className="text-base font-semibold">Marca</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
          O logo e as cores valem para o site inteiro. O site escurece sozinho
          uma cor que não alcança contraste mínimo no texto.
        </p>
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
          {COLORS.map(([name, label, initial, hint]) => (
            <label key={name} className="admin-field">
              <span>{label}</span>
              <span className="flex items-center gap-3">
                <input
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(values[name])
                      ? values[name]
                      : initial
                  }
                  aria-label={label}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
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
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [name]: event.target.value,
                    }))
                  }
                />
              </span>
              <small id={`${name}-hint`} className="text-[var(--color-muted)]">
                {hint}
              </small>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
