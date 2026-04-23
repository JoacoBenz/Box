const ARS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const ARS_WITH_CENTS = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return ARS.format(amount);
}

export function formatMoneyWithCents(amount: number): string {
  return ARS_WITH_CENTS.format(amount);
}

export function formatMoneyShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000)
    return `${amount < 0 ? '-' : ''}$${(Math.abs(amount) / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000)
    return `${amount < 0 ? '-' : ''}$${(Math.abs(amount) / 1_000).toFixed(0)}K`;
  return formatMoney(amount);
}
