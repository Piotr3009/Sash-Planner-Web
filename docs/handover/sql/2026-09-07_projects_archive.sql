-- ARCHED-WINDOWS-v3 Block 6 — project ARCHIVE (Piotr 07.09: the dashboard mixes finished and live work).
-- Run once in the Supabase SQL editor of project teqkuumenoerphfuqijb. Idempotent.
--
-- The app already filters `projects.archived = false` on load (cloudSync.loadAll); this migration
-- makes the column explicit, adds the archive timestamp the Archive page shows ("Archived on")
-- and an index for the two dashboard / archive queries. RLS is NOT touched: the existing
-- tenant-scoped policies on `projects` cover archived rows exactly like live ones.

alter table public.projects
  add column if not exists archived boolean not null default false;

alter table public.projects
  add column if not exists archived_at timestamptz null;

comment on column public.projects.archived is 'Block 6: true = out of the active dashboard (Archive page); batches / windows / packs untouched';
comment on column public.projects.archived_at is 'Block 6: when the project was archived (null while active); cleared on restore';

-- Backfill: a row archived before this column existed gets the archive time = its last update if known, else now().
update public.projects
   set archived_at = coalesce(archived_at, now())
 where archived = true and archived_at is null;

create index if not exists projects_tenant_archived_idx
  on public.projects (tenant_id, archived);
