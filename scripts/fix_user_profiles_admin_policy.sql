-- Fix admin RLS recursion by moving admin-check logic into a SECURITY DEFINER helper
-- and simplifying the user_profiles admin policy to call it.
-- Also expose public read of active programs so registration can load programs before login.

-- 1) Helper function: is_org_admin
-- Ensures we can check admin membership without triggering RLS recursion.
-- Make sure owner is a superuser/DB owner (e.g., postgres) after creation if needed.
drop function if exists public.is_org_admin(uuid);
create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
security definer
set search_path = public
language plpgsql stable
as $$
begin
  return exists (
    select 1
    from user_program_memberships upm
    join programs p on p.id = upm.program_id
    where upm.user_id = auth.uid()
      and upm.role = 'admin'
      and p.organization_id = target_org_id
  );
end;
$$;

revoke all on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to anon, authenticated;

-- 2) Replace admin policy on user_profiles to use the helper
alter table user_profiles enable row level security;

drop policy if exists "Admins can manage organization profiles" on user_profiles;
create policy "Admins can manage organization profiles" on user_profiles
  for all using (
    public.is_org_admin(user_profiles.organization_id)
  );

-- 3) Allow public (anon) to read active programs for registration
alter table programs enable row level security;

drop policy if exists "Public can view active programs" on programs;
create policy "Public can view active programs" on programs
  for select using (
    is_active = true
  );
