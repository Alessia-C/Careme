-- Length limits of products text columns, mirroring shared/products.ts
-- (name and brand 1-100, note up to 500). The API already enforces them; the
-- database is the last line of defense for any other writer (a future endpoint,
-- PostgREST with a user JWT).
--
-- NOT VALID: the constraints apply to every new or updated row without scanning
-- the existing ones, so the migration cannot fail on old data. After checking
-- that no row violates them, run:
--   alter table public.products validate constraint products_name_length;
--   (same for products_brand_length and products_note_length)
-- Does not touch profiles, RLS or the privilege triggers.
alter table public.products
  add constraint products_name_length
    check (char_length(btrim(name)) between 1 and 100) not valid,
  add constraint products_brand_length
    check (char_length(btrim(brand)) between 1 and 100) not valid,
  add constraint products_note_length
    check (note is null or char_length(note) <= 500) not valid;
