import type { Intake } from '@/lib/tenant-intake';

/** Campos diretos do operador, compartilhados entre cadastro e edição. */
export function TenantFields({
  values = {},
  intake = {},
  withSlug = false,
}: {
  values?: {
    name?: string;
    slug?: string;
    whatsapp?: string | null;
    contactEmail?: string | null;
  };
  intake?: Partial<Intake>;
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
            <small className="text-[var(--color-muted)]">
              Seu endereço será nome-do-cliente.eixu.com.br
            </small>
          </label>
        ) : null}
        <label className="admin-field">
          <span>WhatsApp com DDI</span>
          <input
            className="admin-input"
            name="whatsapp"
            maxLength={20}
            defaultValue={values.whatsapp ?? ''}
            inputMode="tel"
            placeholder="55 DDD número"
          />
        </label>
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
      <div className="mt-7 border-t pt-6">
        <h2 className="text-base font-semibold">Briefing do negócio</h2>
        <p className="mt-1 mb-5 max-w-2xl text-sm text-[var(--color-muted)]">
          O que o site precisa comunicar. Registre fatos e restrições para
          orientar o texto e as imagens.
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
            <span>Referências</span>
            <textarea
              name="references"
              className="admin-input"
              rows={3}
              defaultValue={intake.references?.join('\n')}
              placeholder="Até 3 URLs, uma por linha"
            />
          </label>
          <label className="admin-field">
            <span>Fatos confirmados</span>
            <textarea
              name="evidence"
              className="admin-input"
              rows={4}
              defaultValue={intake.evidence?.join('\n')}
              placeholder="Serviços, diferenciais e provas. Até 8 fatos, um por linha."
            />
          </label>
          <label className="admin-field">
            <span>Restrições</span>
            <textarea
              name="constraints"
              className="admin-input"
              rows={4}
              defaultValue={intake.constraints?.join('\n')}
              placeholder="O que não pode ser prometido ou mostrado. Até 8 itens, um por linha."
            />
          </label>
        </div>
      </div>
    </>
  );
}
