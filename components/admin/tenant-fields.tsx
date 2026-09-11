import { ContactFields } from '@/components/admin/contact-fields';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';

/** Campos diretos do operador, compartilhados entre cadastro e edição. */
export function TenantFields({
  values = {},
  intake = {},
  contacts,
  withSlug = false,
}: {
  values?: {
    name?: string;
    slug?: string;
    contactEmail?: string | null;
  };
  intake?: Partial<Intake>;
  contacts?: Contacts;
  withSlug?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="admin-field">
          <span>Nome do cliente</span>
          <input
            className="admin-input"
            name="name"
            required
            maxLength={80}
            defaultValue={values.name}
            autoComplete="organization"
          />
        </label>
        {withSlug ? (
          <label className="admin-field">
            <span>Endereço do site</span>
            <input
              className="admin-input"
              name="slug"
              required
              minLength={2}
              maxLength={63}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="nome-do-cliente"
            />
            <small>Seu endereço será nome-do-cliente.eixu.com.br</small>
          </label>
        ) : null}
        <label className="admin-field">
          <span>E-mail de contato</span>
          <input
            className="admin-input"
            name="contactEmail"
            type="email"
            maxLength={120}
            defaultValue={values.contactEmail ?? ''}
          />
        </label>
      </div>
      <ContactFields contacts={contacts} />
      <div className="mt-7 border-t pt-6">
        <h2 className="text-base font-semibold">Briefing do negócio</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
          O que o site precisa comunicar. Todos os campos são opcionais; quanto
          mais fatos confirmados, menos o agente precisa supor. Ele só afirma o
          que estiver aqui ou nas referências lidas; o resto vira lacuna.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['segment', 'Segmento', 120],
              ['region', 'Região atendida', 120],
              ['audience', 'Para quem vende', 240],
              ['offer', 'O que oferece', 240],
              ['goal', 'Ação esperada do visitante', 240],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key} className="admin-field">
              <span>{label}</span>
              <input
                className="admin-input"
                name={key}
                maxLength={max}
                defaultValue={intake[key] ?? ''}
              />
            </label>
          ))}
          <label className="admin-field">
            <span>
              Referências <em>opcional</em>
            </span>
            <textarea
              name="references"
              className="admin-input"
              rows={3}
              defaultValue={intake.references?.join('\n')}
              placeholder="Uma URL por linha, até 3"
            />
            <small>
              Site atual, materiais ou inspirações que o agente pode abrir.
              Instagram e LinkedIn vão em Contatos, no campo Redes sociais.
            </small>
          </label>
          <label className="admin-field">
            <span>
              Fatos confirmados <em>opcional</em>
            </span>
            <textarea
              name="evidence"
              className="admin-input"
              rows={4}
              defaultValue={intake.evidence?.join('\n')}
              placeholder="Ex.: 12 anos em Bauru; equipe de 4 técnicos"
            />
            <small>
              O que a empresa faz e comprova: serviços, região, tempo de
              mercado, equipe, certificações, prazos. O site só afirma o que
              estiver aqui ou em uma referência lida. Um fato por linha, até 8.
            </small>
          </label>
          <label className="admin-field">
            <span>
              Restrições <em>opcional</em>
            </span>
            <textarea
              name="constraints"
              className="admin-input"
              rows={4}
              defaultValue={intake.constraints?.join('\n')}
              placeholder="Ex.: não prometer prazo; não citar preço"
            />
            <small>
              O que o site não pode prometer nem mostrar: serviços que a empresa
              não atende, garantias, preços, fotos de pessoas, termos proibidos.
              Um item por linha, até 8.
            </small>
          </label>
        </div>
      </div>
    </>
  );
}
