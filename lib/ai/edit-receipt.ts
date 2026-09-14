import { changesPreview } from './preview-updates';
import { publicationFinding } from '@/lib/sites/publication-policy';

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
const receiptTools = new Set([
  'edit_page',
  'repair_publication',
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
  const visualMeasurements = new Map<string, Record<string, unknown>>();
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
      if (
        ![
          'edit_page',
          'repair_publication',
          'confirm_evidence',
          'lint_site',
        ].includes(name)
      )
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
      if (name === 'edit_page') {
        const measurement = record(out.visualMeasurement);
        if (Object.keys(measurement).length)
          visualMeasurements.set(page, measurement);
      }
      if (
        ['edit_page', 'repair_publication'].includes(name) &&
        out.ok === true
      ) {
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
      const pagesByDetail = new Map<string, string[]>();
      for (const [page, details] of saved)
        for (const detail of new Set(details))
          pagesByDetail.set(detail, [
            ...(pagesByDetail.get(detail) ?? []),
            page,
          ]);
      const grouped = new Set<string>();
      for (const [detail, pages] of pagesByDetail) {
        if (pages.length < 2) continue;
        const match = detail.match(/^Em “(.+)”: (.+)\.$/);
        if (!match) continue;
        grouped.add(detail);
        const name = match[1][0].toUpperCase() + match[1].slice(1);
        lines.push(
          `${name} com ${match[2]} nas ${pages.length} páginas: ${pages.join(', ')}.`,
        );
      }
      for (const [page, details] of saved) {
        const remaining = [...new Set(details)].filter(
          (detail) => !grouped.has(detail),
        );
        if (!remaining.length) continue;
        lines.push(`Alterações salvas no rascunho de ${page}.`);
        lines.push(...remaining);
      }
      const visualLines = new Set<string>();
      for (const [page, measurement] of visualMeasurements) {
        const status = measurement.status;
        const issues = strings(measurement.issues);
        if (status === 'disabled') {
          visualLines.add(
            'A medição renderizada automática não ocorreu porque EIXU_REVIEW_CAPTURE=0.',
          );
          continue;
        }
        if (status !== 'complete') {
          visualLines.add(
            `A alteração de ${page} foi salva, mas a medição renderizada não ocorreu${issues[0] ? `: ${issues[0]}` : '.'}`,
          );
          continue;
        }
        if (measurement.ok !== true) {
          visualLines.add(
            `A alteração de ${page} foi salva, mas a medição renderizada encontrou problemas: ${issues.slice(0, 4).join(' ')}${issues.length > 4 ? ' Veja os demais no painel.' : ''}`,
          );
          continue;
        }
        const viewports = Array.isArray(measurement.viewports)
          ? measurement.viewports.map(record)
          : [];
        const widths = [
          ...new Set(
            viewports
              .map((viewport) => viewport.width)
              .filter((width): width is number => typeof width === 'number'),
          ),
        ];
        const blocks = viewports.flatMap((viewport) =>
          Array.isArray(viewport.blocks) ? viewport.blocks.map(record) : [],
        );
        const backgrounds = [
          ...new Set(
            blocks
              .map((block) => {
                const color =
                  typeof block.backgroundColor === 'string'
                    ? block.backgroundColor
                    : '';
                const image =
                  typeof block.backgroundImage === 'string'
                    ? block.backgroundImage
                    : 'none';
                return color
                  ? `${color}${image === 'none' ? ', sem imagem de fundo' : ', com degradê renderizado'}`
                  : '';
              })
              .filter(Boolean),
          ),
        ];
        const ratios = blocks
          .map((block) => block.minimumContrast)
          .filter((ratio): ratio is number => typeof ratio === 'number');
        visualLines.add(
          `Medição renderizada de ${page} em ${widths.join(' e ')} px: ${backgrounds.join('; ') || 'superfície computada'}${
            ratios.length
              ? `; contraste mínimo ${Math.min(...ratios)
                  .toFixed(1)
                  .replace('.', ',')}:1`
              : '; nenhum texto visível para medir'
          }.`,
        );
      }
      lines.push(...visualLines);
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
        const errors = checked.filter(
          (finding) =>
            publicationFinding({
              ...finding,
              level: finding.level === 'error' ? 'error' : 'warn',
              rule: typeof finding.rule === 'string' ? finding.rule : '',
              message:
                typeof finding.message === 'string' ? finding.message : '',
            }).level === 'error',
        );
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
            ? `Há erros técnicos para corrigir: ${reasons.slice(0, 3).join(' ')}${reasons.length > 3 ? ' Veja os demais no painel.' : ''}`
            : checked.length
              ? 'As recomendações estão no painel e não impedem a publicação quando você pedir.'
              : 'A verificação atual não encontrou bloqueios de publicação.',
        );
      }
      // Autorização não vira evidência. Falta de prova oferece reparo sem
      // obrigar o operador a repetir frases criadas pelo modelo.
      const pending = (plan ?? [])
        .filter(
          (item) =>
            item.regra === 'landing-prova' || item.regra === 'landing-preco',
        )
        .flatMap((item) =>
          Array.isArray(item.confirmar)
            ? (item.confirmar as Record<string, unknown>[])
            : [],
        )
        .filter((fact) => typeof fact.frase === 'string');
      const select = (canal: string, written: boolean) => [
        ...new Set(
          pending
            .filter((fact) => fact.canal === canal && fact.escrita === written)
            .map((fact) => fact.frase as string),
        ),
      ];
      const toWrite = select('chat', false);
      const toRegister = select('dados', false);
      const written = [...select('chat', true), ...select('dados', true)];
      if (toWrite.length)
        lines.push(
          'Há alegações sem confirmação. O reparo das pendências pode retirá-las usando as evidências disponíveis, sem exigir que você repita frases.',
        );
      if (toRegister.length)
        lines.push(
          'Há alegações sem evidência cadastrada; elas podem ser ajustadas pelo reparo das pendências.',
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
