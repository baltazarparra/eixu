/** Controles não controlados continuam sendo a fonte; campos repetidos mantêm a ordem. */
export function formSnapshot(form: HTMLFormElement): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) ||
      !element.name
    )
      continue;
    if (
      element instanceof HTMLInputElement &&
      (['submit', 'button', 'file'].includes(element.type) ||
        (['checkbox', 'radio'].includes(element.type) && !element.checked))
    )
      continue;
    (result[element.name] ??= []).push(element.value);
  }
  return result;
}

export function changedFields(
  before: Record<string, string[]>,
  after: Record<string, string[]>,
): number {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].reduce(
    (total, key) => {
      const a = before[key] ?? [],
        b = after[key] ?? [];
      return (
        total +
        Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
          a[i] === b[i] ? 0 : 1,
        ).reduce<number>((sum, item) => sum + item, 0)
      );
    },
    0,
  );
}
