'use client';

import { useState } from 'react';

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
    <div className="mt-7 border-t pt-6">
      <h2 className="text-base font-semibold">Marca</h2>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
        O logo e as cores valem para o site inteiro. O site escurece sozinho uma
        cor que não alcança contraste mínimo no texto.
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
                name={name}
                defaultValue={initial}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
                className="admin-color"
                aria-describedby={`${name}-hint`}
              />
              <code className="text-xs text-[var(--color-muted)]">
                {values[name]}
              </code>
            </span>
            <small id={`${name}-hint`} className="text-[var(--color-muted)]">
              {hint}
            </small>
          </label>
        ))}
      </div>
    </div>
  );
}
