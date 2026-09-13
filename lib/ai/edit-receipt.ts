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
  // Resolver uma recomendação de proporção gera outra versão da foto. Sem esta
  // entrada, o turno de pendências perdia o fechamento verificável.
  'update_image',
]);
const quote = (value: string) => `"${value}"`;
const phrases = (list: string[]) =>
  `${list.slice(0, 6).map(quote).join('; ')}${list.length > 6 ? ' e as demais listadas no painel' : ''}`;

/** O fechamento da edição usa recibos dos executores. Preferências e perguntas
 * sem operação continuam sendo respondidas pelo modelo, com o contexto intacto. */
export function createEditReceipt() {
  const saved = new Map<string, string[]>();
  const failures = new Map<string, string>();
  const facts = new Set<string>();
  const images: string[] = [];
  let plan: Record<string, unknown>[] | undefined;
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
      // O plano vem de qualquer validação deste turno, inclusive lint_page.
      if (Array.isArray(out.plano)) plan = out.plano.map(record);
      if (name === 'update_image') {
        if (out.error || out.ok === false)
          failures.set(
            'update_image',
            typeof out.error === 'string'
              ? out.error
              : 'A imagem não foi atualizada. Confira o erro no painel.',
          );
        else if (out.ok === true) {
          const applied = Array.isArray(out.paginasAtualizadas)
            ? out.paginasAtualizadas.filter(
                (page): page is string => typeof page === 'string',
              )
            : [];
          const previous =
            typeof out.anterior === 'string' ? out.anterior : 'anterior';
          const current = typeof out.numero === 'string' ? out.numero : 'nova';
          images.push(
            `Imagem ${previous} atualizada: nova versão ${current}${
              applied.length
                ? ` aplicada em ${applied.join(', ')}`
                : ' salva na biblioteca'
            }. A original continua no acervo.`,
          );
        }
        return;
      }
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
      else if (Array.isArray(out.publicationPending))
        checked = out.publicationPending.map(record);
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
      lines.push(...images);
      if (!saved.size && !facts.size && !images.length)
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
      // Um fato que o operador não escreveu não vira prova. O fechamento diz
      // exatamente quais frases faltam, em vez de repetir a regra.
      const pending = (plan ?? [])
        .filter((item) => item.nivel === 'erro')
        .flatMap((item) =>
          Array.isArray(item.confirmar)
            ? (item.confirmar as Record<string, unknown>[])
            : [],
        )
        .filter((fact) => typeof fact.frase === 'string');
      const select = (canal: string, written: boolean) => [
        ...new Set(
          pending
            .filter(
              (fact) => fact.canal === canal && fact.escrita === written,
            )
            .map((fact) => fact.frase as string),
        ),
      ];
      const toWrite = select('chat', false);
      const toRegister = select('dados', false);
      const written = [...select('chat', true), ...select('dados', true)];
      if (toWrite.length)
        lines.push(
          `Para liberar a prova, o operador precisa escrever no chat, com estas palavras: ${phrases(toWrite)}.`,
        );
      if (toRegister.length)
        lines.push(
          `Estas frases não cabem na confirmação pelo chat; registre em Dados › Evidências: ${phrases(toRegister)}.`,
        );
      if (written.length)
        lines.push(
          `Fatos já escritos pelo operador que continuam sem registro: ${phrases(written)}.`,
        );
      if (saved.size) lines.push('Confira o resultado na prévia.');
      return lines.join(' ');
    },
  };
}
