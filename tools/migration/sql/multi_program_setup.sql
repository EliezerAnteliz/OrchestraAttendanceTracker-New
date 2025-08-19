-- Multi-program (multi-sede) setup for Ascend: Stafford + Japhet
-- Safe to run multiple times (idempotent-ish). Review before applying to production.

begin;

-- UUID helper
create extension if not exists pgcrypto;

-- 1) Ensure base organization exists (Ascend)
--    If your org has a different name, adjust the WHERE clause accordingly.
--    This will not create an organization; it only tries to find it.
with org as (
  select id from organizations where lower(name) = 'ascend' limit 1
)
-- 2) Seed Programs (Sedes): Stafford, Japhet
-- Insert only if not exists (per name+organization).
insert into programs (id, organization_id, name, type, is_active, created_at, updated_at)
select gen_random_uuid(), org.id, 'Stafford', 'site', true, now(), now()
from org
where org.id is not null
  and not exists (
    select 1 from programs p where p.organization_id = org.id and p.name = 'Stafford'
  );

with org as (
  select id from organizations where lower(name) = 'ascend' limit 1
)
insert into programs (id, organization_id, name, type, is_active, created_at, updated_at)
select gen_random_uuid(), org.id, 'Japhet', 'site', true, now(), now()
from org
where org.id is not null
  and not exists (
    select 1 from programs p where p.organization_id = org.id and p.name = 'Japhet'
  );

-- 3) Memberships table: which users can access which program
create table if not exists user_program_memberships (
  user_id uuid not null,
  program_id uuid not null references programs(id) on delete cascade,
  role text not null check (role in ('admin','staff','viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, program_id)
);

-- 4) Add program_id to core tables (if not exists)
-- Adjust this list if you have more tables that belong to a sede
alter table if exists students add column if not exists program_id uuid references programs(id);
alter table if exists attendance add column if not exists program_id uuid references programs(id);
alter table if exists parents add column if not exists program_id uuid references programs(id);
alter table if exists student_parents add column if not exists program_id uuid references programs(id);

-- 5) Helpful indexes
create index if not exists idx_students_program_id on students(program_id);
create index if not exists idx_attendance_program_id on attendance(program_id);
create index if not exists idx_parents_program_id on parents(program_id);
create index if not exists idx_student_parents_program_id on student_parents(program_id);

-- 6) Backfill existing rows to Stafford by default
with stafford as (
  select id from programs where name = 'Stafford' limit 1
)
update students set program_id = (select id from stafford) where program_id is null;

with stafford as (
  select id from programs where name = 'Stafford' limit 1
)
update attendance set program_id = (select id from stafford) where program_id is null;

with stafford as (
  select id from programs where name = 'Stafford' limit 1
)
update parents set program_id = (select id from stafford) where program_id is null;

with stafford as (
  select id from programs where name = 'Stafford' limit 1
)
update student_parents set program_id = (select id from stafford) where program_id is null;

-- 7) Enable RLS and add policies (idempotent via DO blocks)
-- NOTE: Adjust table list as needed. Policies rely on auth.uid() being present.

-- Students
alter table if exists students enable row level security;

do $$
begin
  execute 'create policy students_select_by_program on students
    for select using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = students.program_id
      )
    )';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'create policy students_insert_by_program on students
    for insert with check (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = students.program_id
      )
    )';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'create policy students_update_by_program on students
    for update using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = students.program_id
      )
    ) with check (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = students.program_id
      )
    )';
exception when duplicate_object then null; end $$;

-- Attendance
alter table if exists attendance enable row level security;

do $$
begin
  execute 'create policy attendance_select_by_program on attendance
    for select using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
    )';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'create policy attendance_insert_by_program on attendance
    for insert with check (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
    )';
exception when duplicate_object then null; end $$;

do $$
begin
  execute 'create policy attendance_update_by_program on attendance
    for update using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
    ) with check (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = attendance.program_id
      )
    )';
exception when duplicate_object then null; end $$;

-- Parents
alter table if exists parents enable row level security;

do $$
begin
  execute 'create policy parents_select_by_program on parents
    for select using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = parents.program_id
      )
    )';
exception when duplicate_object then null; end $$;

-- Student-Parents
alter table if exists student_parents enable row level security;

do $$
begin
  execute 'create policy sp_select_by_program on student_parents
    for select using (
      exists (
        select 1 from user_program_memberships m
        where m.user_id = auth.uid() and m.program_id = student_parents.program_id
      )
    )';
exception when duplicate_object then null; end $$;

commit;

-- POST-APPLY ACTIONS (manual):
-- 1) Insert memberships for your users, e.g.:
--    insert into user_program_memberships(user_id, program_id, role)
--    values ('<USER_UUID>', (select id from programs where name='Stafford'), 'admin');
--    insert into user_program_memberships(user_id, program_id, role)
--    values ('<USER_UUID>', (select id from programs where name='Japhet'), 'staff');
-- 2) Update the app to pass/filter by program_id and add a selector (ProgramContext).
