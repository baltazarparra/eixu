/** Aspas CSV não impedem planilhas de interpretar uma fórmula recebida. */
export function csvCell(value: unknown): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number'
        ? String(value)
        : '';
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
