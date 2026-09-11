'use client';

import { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  EMPTY_CONTACTS,
  formatPhone,
  type Contacts,
} from '@/lib/tenant-contacts';

/**
 * Linhas repetíveis de contato. Cada linha submete campos de mesmo nome, e o
 * servidor pareia telefone e tipo pelo índice; linha em branco é descartada
 * depois do pareamento. Sem estado compartilhado com o servidor: o formulário
 * é a fonte, como no resto do cadastro.
 */
function useRows<T>(initial: T[], blank: () => T, minimum = 1) {
  const seed = initial.length
    ? initial
    : Array.from({ length: minimum }, blank);
  const [rows, setRows] = useState(() =>
    seed.map((value, index) => ({ key: `s${index}`, value })),
  );
  const counter = useRef(0);
  return {
    rows,
    add: () =>
      setRows((current) => [
        ...current,
        { key: `n${(counter.current += 1)}`, value: blank() },
      ]),
    remove: (key: string) =>
      setRows((current) => current.filter((row) => row.key !== key)),
  };
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="admin-secondary self-start"
      onClick={onClick}
    >
      <Plus size={15} aria-hidden="true" />
      {label}
    </button>
  );
}

export function ContactFields({
  contacts = EMPTY_CONTACTS,
}: {
  contacts?: Contacts;
}) {
  const phones = useRows(contacts.phones, () => ({
    number: '',
    whatsapp: true,
  }));
  const addresses = useRows(contacts.addresses, () => ({
    label: '',
    text: '',
  }));
  const social = useRows<string>(contacts.social, () => '');

  return (
    <div className="mt-7 border-t pt-6">
      <h2 className="text-base font-semibold">Contatos</h2>
      <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
        Tudo opcional e usado direto no site: o primeiro WhatsApp vira o botão
        flutuante e os CTAs rastreados, telefone comum vira link de ligação,
        endereço vira o mapa acima do rodapé e as redes vão para o rodapé. O
        primeiro Instagram ou LinkedIn da lista também é lido para o briefing.
      </p>
      <div className="grid gap-7 sm:grid-cols-2">
        <fieldset className="admin-field">
          <legend className="mb-2 text-[13px] font-medium">
            Telefones <em className="text-[11px] font-normal">até 4</em>
          </legend>
          <div className="flex flex-col gap-2">
            {phones.rows.map(({ key, value }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  className="admin-input"
                  name="phone"
                  maxLength={24}
                  inputMode="tel"
                  aria-label="Número com DDI"
                  placeholder="55 11 99999-9999"
                  defaultValue={value.number ? formatPhone(value.number) : ''}
                />
                <select
                  className="admin-input w-auto shrink-0"
                  name="phoneKind"
                  aria-label="Tipo do número"
                  defaultValue={value.whatsapp ? 'whatsapp' : 'telefone'}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="telefone">Telefone</option>
                </select>
                <button
                  type="button"
                  className="admin-icon-button shrink-0"
                  aria-label="Remover telefone"
                  onClick={() => phones.remove(key)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            {phones.rows.length < 4 ? (
              <AddRow label="Outro telefone" onClick={phones.add} />
            ) : null}
          </div>
        </fieldset>

        <fieldset className="admin-field">
          <legend className="mb-2 text-[13px] font-medium">
            Redes sociais <em className="text-[11px] font-normal">até 8</em>
          </legend>
          <div className="flex flex-col gap-2">
            {social.rows.map(({ key, value }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  className="admin-input"
                  name="social"
                  maxLength={200}
                  aria-label="Link da rede social"
                  placeholder="@perfil ou instagram.com/suaempresa"
                  defaultValue={value}
                />
                <button
                  type="button"
                  className="admin-icon-button shrink-0"
                  aria-label="Remover rede social"
                  onClick={() => social.remove(key)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            {social.rows.length < 8 ? (
              <AddRow label="Outra rede" onClick={social.add} />
            ) : null}
          </div>
        </fieldset>

        <fieldset className="admin-field sm:col-span-2">
          <legend className="mb-2 text-[13px] font-medium">
            Endereços <em className="text-[11px] font-normal">até 5</em>
          </legend>
          <div className="flex flex-col gap-2">
            {addresses.rows.map(({ key, value }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  className="admin-input w-auto shrink-0 sm:w-44"
                  name="addressLabel"
                  maxLength={40}
                  aria-label="Nome do endereço"
                  placeholder="Loja, Fábrica…"
                  defaultValue={value.label}
                />
                <input
                  className="admin-input"
                  name="addressText"
                  maxLength={200}
                  aria-label="Endereço completo"
                  placeholder="Rua, número, bairro, cidade e estado"
                  defaultValue={value.text}
                />
                <button
                  type="button"
                  className="admin-icon-button shrink-0"
                  aria-label="Remover endereço"
                  onClick={() => addresses.remove(key)}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            {addresses.rows.length < 5 ? (
              <AddRow label="Outro endereço" onClick={addresses.add} />
            ) : null}
          </div>
          <small>
            O endereço completo melhora o pino no mapa. O mapa carrega sob
            demanda e sempre oferece o link de rota.
          </small>
        </fieldset>
      </div>
    </div>
  );
}
