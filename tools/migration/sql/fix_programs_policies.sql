-- Fix recursive RLS policies causing "infinite recursion detected in policy for relation 'programs'"
-- Run this in Supabase SQL editor against your database.

begin;

-- Ensure RLS is enabled
alter table if exists programs enable row level security;
alter table if exists attendance enable row level security;

-- Drop problematic/legacy policies if present (adjust names if yours differ)
-- List existing policies first if needed:
--   select * from pg_policies where schemaname = 'public' and tablename in ('programs','attendance');

do $$
begin
  execute 'drop policy if exists programs_select_by_membership on programs';
  execute 'drop policy if exists programs_insert_by_membership on programs';
  execute 'drop policy if exists programs_update_by_membership on programs';
  -- Drop any generic policies that may reference programs from programs
  execute 'drop policy if exists programs_select on programs';
  execute 'drop policy if exists programs_insert on programs';
  execute 'drop policy if exists programs_update on programs';
exception when others then null; end $$;

-- Re-create safe, non-recursive policies using ONLY user_program_memberships

do $$
begin
  execute 'create policy programs_select_by_membership on programs
    for select using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = programs.id
      )
    )';
exception when duplicate_object then null; end $$;


do $$
begin
  execute 'create policy programs_insert_by_membership on programs
    for insert with check (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = programs.id
      )
    )';
exception when duplicate_object then null; end $$;


do $$
begin
  execute 'create policy programs_update_by_membership on programs
    for update using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = programs.id
      )
    ) with check (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = programs.id
      )
    )';
exception when duplicate_object then null; end $$;

-- Ensure attendance policies do not reference programs indirectly in a recursive way

do $$
begin
  execute 'drop policy if exists attendance_select_problematic on attendance';
  execute 'drop policy if exists attendance_update_problematic on attendance';
exception when others then null; end $$;

-- Idempotent create of good policies (may already exist from multi_program_setup.sql)

do $$
begin
  execute 'create policy if not exists attendance_select_by_program on attendance
    for select using (
      exists (select 1 from public.user_admins ua where ua.user_id = auth.uid())
      or exists (
        select 1 from public.user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
      or exists (
        select 1 from public.users_programs up
        where up.user_id = auth.uid() and up.program_id = attendance.program_id
      )
    )';
exception when others then null; end $$;


-- Allow INSERTs when the user belongs to the target program
do $$
begin
  execute 'create policy if not exists attendance_insert_by_program on attendance
    for insert with check (
      exists (select 1 from public.user_admins ua where ua.user_id = auth.uid())
      or exists (
        select 1 from public.user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
      or exists (
        select 1 from public.users_programs up
        where up.user_id = auth.uid() and up.program_id = attendance.program_id
      )
    )';
exception when others then null; end $$;


do $$
begin
  execute 'create policy if not exists attendance_update_by_program on attendance
    for update using (
      exists (select 1 from public.user_admins ua where ua.user_id = auth.uid())
      or exists (
        select 1 from public.user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
      or exists (
        select 1 from public.users_programs up
        where up.user_id = auth.uid() and up.program_id = attendance.program_id
      )
    ) with check (
      exists (select 1 from public.user_admins ua where ua.user_id = auth.uid())
      or exists (
        select 1 from public.user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
      or exists (
        select 1 from public.users_programs up
        where up.user_id = auth.uid() and up.program_id = attendance.program_id
      )
    )';
exception when others then null; end $$;

commit;
