'use client';

import { useState } from 'react';

export function EvidenceFields({ initial = [] }: { initial?: string[] }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  function add() {
    const value = draft.trim();
    if (!value || items.length >= 8) return;
    setItems((current) => [...current, value]);
    setDraft('');
    setAdding(false);
  }
  return (
    <div className="admin-field admin-evidence">
      <span>
        Fatos confirmados <em>opcional</em>
      </span>
      <input type="hidden" name="evidence" value={items.join('\n')} />
      <ul>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>
            <span>{item}</span>
            <button
              type="button"
              aria-label={`Remover fato: ${item}`}
              onClick={() =>
                setItems((current) => current.filter((_, i) => i !== index))
              }
            >
              ×
            </button>
          </li>
        ))}
        {items.length < 8 ? (
          <li className="admin-evidence-add">
            <button
              type="button"
              onClick={() => setAdding(!adding)}
              aria-expanded={adding}
            >
              + prova
            </button>
          </li>
        ) : null}
      </ul>
      {adding ? (
        <div className="admin-evidence-input">
          <input
            className="admin-input"
            aria-label="Novo fato confirmado"
            value={draft}
            maxLength={160}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                add();
              }
            }}
          />
          <button
            className="admin-secondary"
            type="button"
            disabled={!draft.trim()}
            onClick={add}
          >
            Adicionar
          </button>
        </div>
      ) : null}
      <small>
        Inclua apenas o que a empresa comprova. Até 8 fatos, com 160 caracteres
        cada.
      </small>
    </div>
  );
}
