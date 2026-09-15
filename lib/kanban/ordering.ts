/** Posições são derivadas da ordem dos IDs, sempre consecutivas a partir de zero. */
export function sameOrder(before: readonly string[], after: readonly string[]) {
  return (
    before.length === after.length && before.every((id, i) => id === after[i])
  );
}

export function insertBefore(
  ids: readonly string[],
  id: string,
  beforeId: string | null,
): string[] | null {
  if (beforeId === null) return [...ids, id];
  const index = ids.indexOf(beforeId);
  if (index < 0) return null;
  return [...ids.slice(0, index), id, ...ids.slice(index)];
}
