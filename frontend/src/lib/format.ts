export function humanizeKey(value?: string | null) {
  if (!value) return '-';
  return value
    .replace(/^custom:/, '')
    .replace(/^lead\./, '')
    .replace(/^user\./, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDate(value);
}

export function formatAmount(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return 'Rs -';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return String(value);
  return `Rs ${numberValue.toLocaleString('en-IN')}`;
}

export const formatCurrency = formatAmount;
