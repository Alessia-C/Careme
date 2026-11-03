-- Index for the products list (GET /api/products): the rows of one user,
-- already sorted by newest first. Equality column first, sort column after.
-- id is not part of the index: it is the tie-break of the ORDER BY only.
-- Does not touch profiles, RLS or the privilege triggers.
create index products_user_id_created_at_idx
  on public.products (user_id, created_at desc);
