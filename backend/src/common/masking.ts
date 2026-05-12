export function maskPartial(value: unknown) {
  if (value === null || value === undefined || value === '') return value;
  const text = String(value);
  if (/^\d{10}$/.test(text)) return `******${text.slice(-4)}`;
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
    return `${visible}***@${domain}`;
  }
  if (text.length <= 4) return '****';
  return `${text.slice(0, 2)}****${text.slice(-2)}`;
}
