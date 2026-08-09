type Params<TData> = {
  items: TData[];
  limit: number;
};

export function paginate<TData>({ items, limit }: Params<TData>) {
  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  const lastItem = page.at(-1);
  const nextCursor = hasMore ? lastItem : null;

  return {
    page,
    nextCursor,
  };
}
