-- Copyright (c) 2026 Skylon Development Ltd. All rights reserved.
--
-- This file is proprietary and confidential. Unauthorised copying,
-- modification, distribution or use of this file, in whole or in part,
-- by any means including automated tools and AI systems, is strictly
-- prohibited without prior written permission from Skylon Development Ltd.

-- Settings save, a per-path write of settings.constants (doors v3 tura, 09.10.2026, owner box item 20).
--
-- NOT DEPLOYED, NOTHING CALLS IT YET. The app ships the client merge (windowProfileStore: only the paths
-- changed since the last cloud load are laid over the current cloud copy). What the client merge cannot
-- close: settings.constants is ONE jsonb row read, merged and written by the browser, so two different
-- keys saved at the same moment by two tabs (window profiles and material assignments, say) can still
-- lose one of them. This function writes ONE path inside constants in a single UPDATE, so concurrent
-- writes to different paths never overwrite each other.
--
-- Run ONCE in the Supabase SQL editor, then switch cloudSync.saveWindowProfiles / saveAssignments to
-- `supabase.rpc('settings_constants_set_path', { p_tenant: tenantId, p_path: ['windowProfiles', 'casement',
-- 'bsuite'], p_value: ... })` per dirty path. Idempotent. SECURITY INVOKER: the existing tenant-scoped RLS
-- policies on `settings` decide which row the caller may change, exactly as for the upserts today.

create or replace function public.settings_constants_set_path(p_tenant uuid, p_path text[], p_value jsonb)
returns void
language plpgsql
security invoker
as $$
declare
  i int;
begin
  if p_path is null or array_length(p_path, 1) is null then
    raise exception 'settings_constants_set_path: empty path';
  end if;
  -- the tenant's row exists (company / constants empty until the first save)
  insert into public.settings (tenant_id, company, constants)
  values (p_tenant, '{}'::jsonb, '{}'::jsonb)
  on conflict (tenant_id) do nothing;
  -- every parent object on the path exists (jsonb_set creates only the last key)
  for i in 1 .. array_length(p_path, 1) - 1 loop
    update public.settings
       set constants = jsonb_set(coalesce(constants, '{}'::jsonb), p_path[1:i], '{}'::jsonb, true)
     where tenant_id = p_tenant
       and jsonb_typeof(coalesce(constants, '{}'::jsonb) #> p_path[1:i]) is distinct from 'object';
  end loop;
  update public.settings
     set constants = jsonb_set(coalesce(constants, '{}'::jsonb), p_path, coalesce(p_value, 'null'::jsonb), true)
   where tenant_id = p_tenant;
end;
$$;

comment on function public.settings_constants_set_path(uuid, text[], jsonb) is
  'Writes one path inside settings.constants in a single UPDATE (doors v3 tura, 09.10.2026): concurrent saves of different paths never overwrite each other.';
