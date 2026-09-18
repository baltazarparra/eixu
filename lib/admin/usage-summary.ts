const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat('pt-BR');
const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatTokens(value?: number): string {
  return value === undefined
    ? 'tokens não informados'
    : `${compact.format(value)} tokens`;
}

export function formatCost(value?: number): string {
  return value === undefined ? 'custo não informado' : money.format(value);
}

export function formatCount(value?: number): string {
  return value === undefined ? 'não informado' : full.format(value);
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}
