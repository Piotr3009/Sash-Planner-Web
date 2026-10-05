-- Ironmongery ITEM # (Piotr 05.10.2026): the Joinery Core stock export carries `item_number`
-- (MAT-489 … MAT-501 for the casement hinges) for ironmongery exactly as for timber, and the
-- Ironmongery "Add" form assigns IRN-xxx — but this table had no column for it, so cloudSync
-- dropped the number on every save and the ITEM # column came back empty after a reload,
-- while `materials` (which has the column) kept MAT-012 etc.
--
-- Run ONCE in the Supabase SQL editor of project teqkuumenoerphfuqijb, BEFORE deploying the
-- app change that writes the column (an upsert with an unknown column fails). Idempotent.
-- RLS is not touched: the existing tenant-scoped policies on `ironmongery` cover the new column.
--
-- No backfill: items imported from Joinery Core get their number back by re-importing the same
-- export (matched by jc_uuid, no duplicates); items added by hand get the next IRN-xxx from
-- the app on its next load.

alter table public.ironmongery
  add column if not exists item_number text null;

comment on column public.ironmongery.item_number is
  'ITEM # shown in the catalogue: the Joinery Core number (MAT-xxx) for imported items, IRN-xxx for items added by hand (05.10.2026)';

create index if not exists ironmongery_tenant_item_number_idx
  on public.ironmongery (tenant_id, item_number);
