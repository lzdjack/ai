export function paginate<T>(list: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(Math.max(1, page), pages);
  return {
    items: list.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pages,
    total: list.length,
  };
}
