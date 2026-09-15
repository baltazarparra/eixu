/** @param {string} value */
export function parseCardNumber(value) {
  const match = /^#?([0-9]+)$/.exec(value.trim());
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isInteger(number) && number > 0 && number <= 2_147_483_647
    ? number
    : null;
}

/** @param {number} number */
export function formatCardNumber(number) {
  return String(number).padStart(4, '0');
}
