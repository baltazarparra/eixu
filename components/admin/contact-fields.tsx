'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { FormSection } from '@/components/admin/primitives';
import { HelpHint, HelpNote } from '@/components/admin/help';
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
    <button type="button" className="admin-add-row" onClick={onClick}>
      <Plus size={14} aria-hidden="true" />
      {label}
    </button>
  );
}

/** Legenda com o limite do grupo como sufixo apagado, não como aviso. */
function GroupLegend({ label, limit }: { label: string; limit: string }) {
  return (
    <legend className="admin-legend">
      {label} <span>· {limit}</span>
    </legend>
  );
}

export function ContactFields({
  contacts = EMPTY_CONTACTS,
  ordinal,
  /** Cartão read-only do perfil lido, companhia do link que o gerou. */
  socialCard,
}: {
  contacts?: Contacts;
  ordinal?: string;
  socialCard?: ReactNode;
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
    <FormSection
      id="contato"
      ordinal={ordinal}
      title="Contato"
      status="tudo opcional"
    >
      <HelpNote>
        O primeiro WhatsApp vira o botão flutuante e os CTAs rastreados;
        telefone comum vira link de ligação; o endereço vira o mapa acima do
        rodapé; as redes vão para o rodapé. O primeiro Instagram ou LinkedIn
        também é lido para o briefing.
      </HelpNote>
      <div className="admin-field-groups">
        <fieldset className="admin-field">
          <GroupLegend label="Telefones" limit="até 4" />
          <div className="flex flex-col gap-2">
            {phones.rows.map(({ key, value }) => (
              <div key={key} className="flex flex-wrap items-center gap-2">
                <input
                  className="admin-input admin-numeric min-w-0 grow basis-48"
                  name="phone"
                  maxLength={24}
                  inputMode="tel"
                  aria-label="Número com DDI"
                  placeholder="+55 11 99999-9999"
                  defaultValue={value.number ? formatPhone(value.number) : ''}
                />
                <select
                  className="admin-input admin-phone-kind shrink-0 grow-0 basis-32"
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
          <HelpHint>
            Use + e o DDI nos números internacionais. WhatsApp exige DDI;
            telefone local pode ficar sem ele.
          </HelpHint>
        </fieldset>

        <fieldset className="admin-field">
          <GroupLegend label="Redes sociais" limit="até 8" />
          <div className="flex flex-col gap-2">
            {social.rows.map(({ key, value }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  className="admin-input min-w-0 grow"
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
            {socialCard}
            {social.rows.length < 8 ? (
              <AddRow label="Outra rede" onClick={social.add} />
            ) : null}
          </div>
        </fieldset>

        <fieldset className="admin-field">
          <GroupLegend label="Endereços" limit="até 5" />
          <div className="flex flex-col gap-2">
            {addresses.rows.map(({ key, value }) => (
              <div key={key} className="flex flex-wrap items-center gap-2">
                <input
                  className="admin-input shrink-0 grow-0 basis-40"
                  name="addressLabel"
                  maxLength={40}
                  aria-label="Nome do endereço"
                  placeholder="Loja, Fábrica…"
                  defaultValue={value.label}
                />
                <input
                  className="admin-input min-w-0 grow basis-64"
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
          <HelpHint>
            O endereço completo melhora o pino no mapa. O mapa carrega sob
            demanda e sempre oferece o link de rota.
          </HelpHint>
        </fieldset>
      </div>
    </FormSection>
  );
}
