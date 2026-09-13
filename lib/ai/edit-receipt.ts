import { changesPreview } from './preview-updates';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
const receiptTools = new Set([
  'edit_page',
  'confirm_evidence',
  'lint_site',
  'list_state',
  'get_page',
  'describe_block',
  'list_images',
  'lint_page',
]);

/** O fechamento da edição usa recibos dos executores. Preferências e perguntas
 * sem operação continuam sendo respondidas pelo modelo, com o contexto intacto. */
export function createEditReceipt() {
  const saved = new Map<string, string[]>();
  const failures = new Map<string, string>();
  const facts = new Set<string>();
  let checked: Record<string, unknown>[] | undefined;
  let attempted = false;
  let unchanged = false;
  let complete = true;

  return {
    observe(name: string, input: unknown, output: unknown) {
      const out = record(output);
      const inp = record(input);
      // Publicação, geração de ativos e outras operações têm seus próprios
      // resultados. Não substitua o fechamento de um pedido misto por um
      // recibo que descreve apenas a parte que este módulo conhece.
      if (!receiptTools.has(name)) complete = false;
      if (changesPreview(name, output)) checked = undefined;
      if (!['edit_page', 'confirm_evidence', 'lint_site'].includes(name))
        return;
      attempted = true;
      const page =
        typeof inp.page === 'string'
          ? `/${inp.page.replace(/^\/+|\/+$/g, '')}`
          : '/';
      const key = name === 'edit_page' ? page : name;
      if (out.error || out.ok === false) {
        failures.set(
          key,
          typeof out.error === 'string'
            ? out.error
            : 'Esta tentativa não foi salva. Confira o erro no painel.',
        );
        return;
      }
      failures.delete(key);
      if (name === 'edit_page' && out.ok === true) {
        if (out.changed === true) {
          const details = strings(out.summary);
          saved.set(page, [...(saved.get(page) ?? []), ...details]);
        } else unchanged = true;
      }
      if (name === 'confirm_evidence' && out.ok === true) {
        strings(out.added).forEach((fact) => facts.add(fact));
        if (!strings(out.added).length) unchanged = true;
      }
      if (Array.isArray(out.findings)) checked = out.findings.map(record);
    },
    text(): string | undefined {
      if (!attempted || !complete) return undefined;
      const lines: string[] = [];
      for (const [page, details] of saved) {
        lines.push(`Alterações salvas no rascunho de ${page}.`);
        lines.push(...new Set(details));
      }
      if (facts.size)
        lines.push(`Fatos registrados: ${[...facts].join('; ')}.`);
      if (!saved.size && !facts.size)
        lines.push(
          failures.size
            ? 'Nenhuma alteração foi salva por estas tentativas.'
            : unchanged
              ? 'Nenhuma nova alteração foi necessária.'
              : 'Consultei a validação atual do projeto.',
        );
      lines.push(...new Set(failures.values()));
      if (checked) {
        const errors = checked.filter((finding) => finding.level === 'error');
        const reasons = [
          ...new Set(
            errors
              .map((finding) =>
                typeof finding.message === 'string' ? finding.message : '',
              )
              .filter(Boolean),
          ),
        ];
        lines.push(
          errors.length
            ? `A publicação está bloqueada: ${reasons.slice(0, 3).join(' ')}${reasons.length > 3 ? ' Veja as demais pendências no painel.' : ''}`
            : 'A verificação atual não encontrou bloqueios de publicação.',
        );
      }
      if (saved.size) lines.push('Confira o resultado na prévia.');
      return lines.join(' ');
    },
  };
}
