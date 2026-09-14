-- bSuite export: tenant storage for Matt's .bSolid programs (14.09.2026).
-- bSolid reads the programs from INSIDE the .ewlist (Programs\NAME.bSolid), so the export
-- needs the program files: uploaded once per target in Window Settings, embedded on export.
-- Private bucket, tenant folder per object path: <tenant_id>/<target_id>/<key>/<file>.bSolid
-- Same tenant rule as glass-references (user_profiles.tenant_id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bsuite-programs', 'bsuite-programs', false, 52428800, null)
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = null;

drop policy if exists "bsuite programs tenant select" on storage.objects;
create policy "bsuite programs tenant select" on storage.objects for select
  using (bucket_id = 'bsuite-programs'
         and (storage.foldername(name))[1] = (select up.tenant_id::text from user_profiles up where up.id = auth.uid()));

drop policy if exists "bsuite programs tenant insert" on storage.objects;
create policy "bsuite programs tenant insert" on storage.objects for insert
  with check (bucket_id = 'bsuite-programs'
         and (storage.foldername(name))[1] = (select up.tenant_id::text from user_profiles up where up.id = auth.uid()));

drop policy if exists "bsuite programs tenant update" on storage.objects;
create policy "bsuite programs tenant update" on storage.objects for update
  using (bucket_id = 'bsuite-programs'
         and (storage.foldername(name))[1] = (select up.tenant_id::text from user_profiles up where up.id = auth.uid()));

drop policy if exists "bsuite programs tenant delete" on storage.objects;
create policy "bsuite programs tenant delete" on storage.objects for delete
  using (bucket_id = 'bsuite-programs'
         and (storage.foldername(name))[1] = (select up.tenant_id::text from user_profiles up where up.id = auth.uid()));
