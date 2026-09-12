import { EvidenceFields } from '@/components/admin/evidence-fields';
import { ContactFields } from '@/components/admin/contact-fields';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';

const FIELD_META = {
  segment: ['Segmento', 120],
  region: ['Região atendida', 120],
  audience: ['Para quem vende', 240],
  offer: ['O que a empresa oferece', 240],
  goal: ['Ação esperada do visitante', 240],
} as const;

function IntakeFields({
  keys,
  intake,
  required = false,
}: {
  keys: (keyof typeof FIELD_META)[];
  intake: Partial<Intake>;
  required?: boolean;
}) {
  return keys.map((key) => {
    const [label, maxLength] = FIELD_META[key];
    return (
      <label key={key} className="admin-field">
        <span>{label}</span>
        <input
          className="admin-input"
          name={key}
          maxLength={maxLength}
          required={required}
          defaultValue={intake[key] ?? ''}
        />
      </label>
    );
  });
}

function EvidenceAndReferences({ intake }: { intake: Partial<Intake> }) {
  return (
    <>
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
          Sites que devem orientar estrutura, tipografia, imagens e ritmo têm
          prioridade sobre a vibe, mantendo a marca e a coerência do site.
          Instagram e LinkedIn ficam em Contatos.
        </small>
      </label>
      <EvidenceFields initial={intake.evidence} />
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
          O que o site não pode prometer nem mostrar. Um item por linha.
        </small>
      </label>
    </>
  );
}

/** Campos diretos do operador, compartilhados entre cadastro e edição. */
export function TenantFields({
  values = {},
  intake = {},
  contacts,
  withSlug = false,
  compact = false,
}: {
  values?: {
    name?: string;
    slug?: string;
    contactEmail?: string | null;
  };
  intake?: Partial<Intake>;
  contacts?: Contacts;
  withSlug?: boolean;
  /** Cadastro novo: deixa à vista apenas o necessário para começar bem. */
  compact?: boolean;
}) {
  return (
    <>
      <section id="identificacao" className="admin-form-section">
        <h2>Identificação</h2>
        <p>Como o cliente aparece no painel e no site.</p>
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
          ) : values.slug ? (
            <label className="admin-field">
              <span>Endereço do site</span>
              <input
                className="admin-input admin-numeric"
                value={values.slug}
                readOnly
              />
              <small>{values.slug}.eixu.com.br · definido no cadastro</small>
            </label>
          ) : null}
          {!compact ? (
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
          ) : null}
        </div>
      </section>

      {compact ? (
        <>
          <section id="briefing" className="admin-form-section">
            <h2 className="text-base font-semibold">
              O que o site precisa fazer
            </h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
              Dois fatos bastam para começar. O agente transforma isso em plano,
              imagens e páginas; qualquer lacuna continua explícita.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <IntakeFields keys={['offer', 'goal']} intake={intake} required />
            </div>
          </section>
          <details className="admin-optional-fields">
            <summary>Mais contexto e contatos</summary>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              <IntakeFields
                keys={['segment', 'region', 'audience']}
                intake={intake}
              />
              <EvidenceAndReferences intake={intake} />
            </div>
            <ContactFields contacts={contacts} />
          </details>
        </>
      ) : (
        <>
          <ContactFields contacts={contacts} />
          <section id="briefing" className="admin-form-section">
            <h2 className="text-base font-semibold">Briefing do negócio</h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
              O agente só afirma o que estiver aqui ou nas referências lidas; o
              resto vira lacuna.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <IntakeFields
                keys={['segment', 'region', 'audience', 'offer', 'goal']}
                intake={intake}
              />
              <EvidenceAndReferences intake={intake} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
