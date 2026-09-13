import { EvidenceFields } from '@/components/admin/evidence-fields';
import { ContactFields } from '@/components/admin/contact-fields';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';

function StoryField({ intake }: { intake: Partial<Intake> }) {
  return (
    <label className="admin-field sm:col-span-2">
      <span>História do cliente</span>
      <textarea
        name="story"
        className="admin-input"
        rows={9}
        maxLength={12000}
        required
        defaultValue={intake.story ?? ''}
        placeholder="Conte como a empresa nasceu, o que faz, para quem vende, onde atende, seus diferenciais, provas e o que espera que o visitante faça."
      />
      <small>
        Esta é a principal fonte factual do site. Inclua segmento, região
        atendida e público dentro da narrativa, junto do contexto que torna o
        cliente único.
      </small>
    </label>
  );
}

function ReferenceField({ intake }: { intake: Partial<Intake> }) {
  return (
    <label className="admin-field sm:col-span-2">
      <span>
        Referência visual <em>opcional</em>
      </span>
      <input
        name="reference"
        className="admin-input"
        type="url"
        inputMode="url"
        maxLength={2000}
        defaultValue={intake.references?.[0] ?? ''}
        placeholder="https://exemplo.com"
      />
      <small>
        Use um único site. Quando o link puder ser lido, sua composição,
        tipografia, imagens, ritmo e acabamento terão prioridade sobre a vibe e
        os padrões do gerador, dentro dos recursos disponíveis.
        {(intake.references?.length ?? 0) > 1
          ? ` Este cadastro antigo tem ${intake.references?.length} referências; ao salvar, confirme acima qual será a única.`
          : ''}
      </small>
    </label>
  );
}

function CurrentSiteField({ intake }: { intake: Partial<Intake> }) {
  return (
    <label className="admin-field sm:col-span-2">
      <span>
        Site atual <em>opcional</em>
      </span>
      <input
        name="currentSiteUrl"
        className="admin-input"
        type="url"
        inputMode="url"
        maxLength={2000}
        defaultValue={intake.currentSiteUrl ?? ''}
        placeholder="https://site-atual.com.br"
      />
      <small>
        O agente navega pelas páginas públicas desse domínio, reúne conteúdo,
        links, contatos e dados estruturados e importa fotos úteis para a
        biblioteca. A história informada acima prevalece quando houver conflito.
      </small>
    </label>
  );
}

function EvidenceAndConstraints({ intake }: { intake: Partial<Intake> }) {
  return (
    <>
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
            <h2 className="text-base font-semibold">História do cliente</h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
              Conte a história com substância. O agente transforma essa fonte em
              posicionamento, plano, imagens e páginas sem inventar o que não
              foi informado.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <StoryField intake={intake} />
            </div>
          </section>
          <section id="site-atual" className="admin-form-section">
            <h2 className="text-base font-semibold">Site atual</h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
              Reaproveite o conhecimento e os ativos públicos que o cliente já
              tem.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <CurrentSiteField intake={intake} />
            </div>
          </section>
          <section id="referencia" className="admin-form-section">
            <h2 className="text-base font-semibold">Referência para o site</h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
              Se houver uma referência, ela passa a comandar a direção visual.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ReferenceField intake={intake} />
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
              <EvidenceAndConstraints intake={intake} />
            </div>
            <ContactFields contacts={contacts} />
          </details>
        </>
      ) : (
        <>
          <ContactFields contacts={contacts} />
          <section id="briefing" className="admin-form-section">
            <h2 className="text-base font-semibold">História e fontes</h2>
            <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
              A história sustenta o conteúdo. O site atual traz fatos e ativos.
              Uma referência visual verificada comanda a composição.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <StoryField intake={intake} />
              <CurrentSiteField intake={intake} />
              <ReferenceField intake={intake} />
              <EvidenceAndConstraints intake={intake} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
