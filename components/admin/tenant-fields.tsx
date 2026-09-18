import type { ReactNode } from 'react';
import { EvidenceFields } from '@/components/admin/evidence-fields';
import { ContactFields } from '@/components/admin/contact-fields';
import { FormSection } from '@/components/admin/primitives';
import { HelpHint, HelpNote } from '@/components/admin/help';
import type { Intake } from '@/lib/tenant-intake';
import type { Contacts } from '@/lib/tenant-contacts';

/** No cadastro novo a nota ensina; no cadastro salvo ela só relembra. */
type FieldProps = { intake: Partial<Intake>; compact?: boolean };

function StoryField({ intake, compact }: FieldProps) {
  return (
    <label className="admin-field">
      <span>História do cliente</span>
      <textarea
        name="story"
        className="admin-input"
        rows={compact ? 9 : 8}
        maxLength={12000}
        required
        defaultValue={intake.story ?? ''}
        placeholder="Conte como a empresa nasceu, o que faz, para quem vende, onde atende, seus diferenciais, provas e o que espera que o visitante faça."
      />
      {compact ? (
        <HelpHint>
          Esta é a principal fonte factual do site. Inclua segmento, região
          atendida e público dentro da narrativa, junto do contexto que torna o
          cliente único.
        </HelpHint>
      ) : null}
    </label>
  );
}

function ReferenceField({ intake, compact }: FieldProps) {
  const legacy =
    (intake.references?.length ?? 0) > 1
      ? ` Este cadastro antigo tem ${intake.references?.length} referências; ao salvar, confirme acima qual será a única.`
      : '';
  return (
    <label className="admin-field">
      <span>
        Referência visual <em>· opcional</em>
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
      <HelpHint>
        {compact
          ? `Use um site cuja aparência sirva de inspiração. Ele não fornece fatos nem contatos do cliente. Quando a captura puder ser analisada, sua composição, tipografia, imagens, ritmo e acabamento terão prioridade sobre a direção inicial. Sem referência, seguimos a direção escolhida.${legacy}`
          : `Quando verificada, sua composição, tipografia e ritmo têm prioridade sobre a direção escolhida.${legacy}`}
      </HelpHint>
    </label>
  );
}

function CurrentSiteField({ intake, compact }: FieldProps) {
  return (
    <label className="admin-field">
      <span>
        Site atual <em>· opcional</em>
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
      <HelpHint>
        {compact
          ? 'Informe o site que já pertence ao cliente. Vamos reunir conteúdo e fotos úteis; esse link não define a aparência do novo site. A história acima prevalece em conflitos. Sem site atual, a criação segue com o que você contou.'
          : 'Só para reunir conteúdo e fotos. Não define a aparência do novo site.'}
      </HelpHint>
    </label>
  );
}

function ConstraintsField({ intake }: FieldProps) {
  return (
    <label className="admin-field admin-constraints">
      <span>
        Restrições <em>· um item por linha</em>
      </span>
      <textarea
        name="constraints"
        className="admin-input"
        rows={3}
        defaultValue={intake.constraints?.join('\n')}
        placeholder="Ex.: não prometer prazo; não citar preço"
      />
      <HelpHint>O que o site não pode prometer nem mostrar.</HelpHint>
    </label>
  );
}

/** Campos diretos do operador, compartilhados entre cadastro e edição. */
export function TenantFields({
  values = {},
  intake = {},
  contacts,
  withSlug = false,
  compact = false,
  socialCard,
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
  /** Perfil social lido, renderizado dentro do grupo Redes sociais. */
  socialCard?: ReactNode;
}) {
  const identity = (
    <>
      <div className="admin-field-grid">
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
            <HelpHint>Seu endereço será nome-do-cliente.eixu.com.br</HelpHint>
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
        {!withSlug && values.slug ? (
          // O endereço não se edita aqui: faixa informativa, não campo morto.
          <div className="admin-domain-band">
            <span>Endereço do site</span>
            <strong>{values.slug}.eixu.com.br</strong>
            <span>definido no cadastro</span>
          </div>
        ) : null}
      </div>
      <HelpNote>
        Como o cliente aparece no painel e no site. O endereço vem do cadastro e
        não muda por aqui.
      </HelpNote>
    </>
  );

  if (compact)
    return (
      <>
        <FormSection id="identificacao" title="Identificação">
          {identity}
        </FormSection>
        <FormSection id="briefing" title="História do cliente">
          <HelpNote>
            Conte a história com substância. O agente transforma essa fonte em
            posicionamento, plano, imagens e páginas sem inventar o que não foi
            informado.
          </HelpNote>
          <div className="admin-field-stack">
            <StoryField intake={intake} compact />
          </div>
        </FormSection>
        <FormSection id="site-atual" title="Site atual">
          <HelpNote>
            Reaproveite o conhecimento e os ativos públicos que o cliente já
            tem.
          </HelpNote>
          <div className="admin-field-stack">
            <CurrentSiteField intake={intake} compact />
          </div>
        </FormSection>
        <FormSection id="referencia" title="Referência para o site">
          <HelpNote>
            Se houver uma referência, ela passa a comandar a direção visual.
          </HelpNote>
          <div className="admin-field-stack">
            <ReferenceField intake={intake} compact />
          </div>
        </FormSection>
        <details className="admin-optional-fields">
          <summary>Mais contexto e contatos</summary>
          <div className="admin-field-stack mt-5">
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
            <EvidenceFields initial={intake.evidence} />
            <ConstraintsField intake={intake} compact />
          </div>
          <ContactFields contacts={contacts} />
        </details>
      </>
    );

  return (
    <>
      <FormSection id="identificacao" ordinal="01" title="Identificação">
        {identity}
      </FormSection>
      <ContactFields contacts={contacts} ordinal="02" socialCard={socialCard} />
      <FormSection
        id="historia"
        ordinal="03"
        title="História"
        status="fonte factual do site"
      >
        <HelpNote>
          A história sustenta o conteúdo e prevalece em conflitos. Inclua
          segmento, região atendida e público dentro da narrativa.
        </HelpNote>
        <div className="admin-field-stack">
          <StoryField intake={intake} />
          <div className="admin-field-grid">
            <CurrentSiteField intake={intake} />
            <ReferenceField intake={intake} />
          </div>
          <EvidenceFields initial={intake.evidence} />
          <ConstraintsField intake={intake} />
        </div>
      </FormSection>
    </>
  );
}
