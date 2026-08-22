type Params<TData extends { id: unknown }> = {
  items: TData[];
  limit: number;
};

export function paginate<TData extends { id: unknown }>({ items, limit }: Params<TData>) {
  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  const lastItem = page.at(-1);
  const nextCursor = hasMore ? lastItem?.id : null;

  return {
    page,
    nextCursor,
  };
}
