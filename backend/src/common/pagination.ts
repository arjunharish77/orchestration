export function pagination(input: { page?: number | string; pageSize?: number | string }, defaults = { page: 1, pageSize: 50, maxPageSize: 200 }) {
  const page = clampNumber(input.page, 1, 100000, defaults.page);
  const pageSize = clampNumber(input.pageSize, 1, defaults.maxPageSize, defaults.pageSize);
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function clampNumber(value: number | string | undefined, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
