-- =====================================================================
-- Commitment Tracker — v1 → v2 migration
-- =====================================================================
-- Turns the single-user to-do list into a coaching tool:
--   • coach<->client relationships (with visibility via RLS)
--   • commitments grow the fields that actually predict follow-through
--     (why / cue / definition-of-done / confidence / obstacle / if-then)
--   • check-ins move to their own table so we have history
--   • coach notes + client flags get first-class storage
--
-- Safe to re-run: every statement is guarded.
-- Run once in the Supabase SQL editor.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. coaching_relationships
-- ---------------------------------------------------------------------
create table if not exists coaching_relationships (
  coach_id   uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'active'
             check (status in ('active','paused','ended')),
  created_at timestamptz not null default now(),
  primary key (coach_id, client_id)
);

create index if not exists coaching_relationships_client_idx
  on coaching_relationships (client_id, status);


-- ---------------------------------------------------------------------
-- 2. commitments — rename the v1 table and grow the schema
-- ---------------------------------------------------------------------
do $$
begin
  -- rename commitment_tracker_items -> commitments if needed
  if exists (select 1 from information_schema.tables
             where table_name = 'commitment_tracker_items')
     and not exists (select 1 from information_schema.tables
                     where table_name = 'commitments')
  then
    alter table commitment_tracker_items rename to commitments;
  end if;

  -- rename text -> what if needed
  if exists (select 1 from information_schema.columns
             where table_name = 'commitments' and column_name = 'text')
     and not exists (select 1 from information_schema.columns
                     where table_name = 'commitments' and column_name = 'what')
  then
    alter table commitments rename column text to what;
  end if;
end$$;

-- Idempotent column additions
alter table commitments
  add column if not exists why                 text,
  add column if not exists cue                 text,
  add column if not exists definition_of_done  text,
  add column if not exists cadence             text,
  add column if not exists confidence          smallint check (confidence between 1 and 10),
  add column if not exists importance          smallint check (importance between 1 and 10),
  add column if not exists obstacle            text,
  add column if not exists if_then             text,
  add column if not exists pillar              text,
  add column if not exists status              text not null default 'active'
                                               check (status in ('active','paused','archived')),
  add column if not exists start_date          date,
  add column if not exists end_date            date,
  add column if not exists updated_at          timestamptz not null default now();


-- ---------------------------------------------------------------------
-- 3. commitment_check_ins
-- ---------------------------------------------------------------------
create table if not exists commitment_check_ins (
  id            uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references commitments(id) on delete cascade,
  date          date not null default current_date,
  status        text not null check (status in ('done','partial','missed')),
  reflection    text,
  created_at    timestamptz not null default now(),
  unique (commitment_id, date)
);

create index if not exists commitment_check_ins_commitment_idx
  on commitment_check_ins (commitment_id, date desc);


-- ---------------------------------------------------------------------
-- 4. Migrate v1 completed_at into the new check-ins table, then drop it
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'commitments' and column_name = 'completed_at')
  then
    insert into commitment_check_ins (commitment_id, date, status, created_at)
      select id, completed_at::date, 'done', completed_at
      from commitments
      where completed_at is not null
    on conflict (commitment_id, date) do nothing;

    alter table commitments drop column completed_at;
  end if;
end$$;


-- ---------------------------------------------------------------------
-- 5. coach_notes
-- ---------------------------------------------------------------------
create table if not exists coach_notes (
  id                uuid primary key default gen_random_uuid(),
  coach_id          uuid not null references auth.users(id) on delete cascade,
  client_id         uuid not null references auth.users(id) on delete cascade,
  commitment_id     uuid references commitments(id) on delete set null,
  text              text not null check (char_length(text) > 0),
  visible_to_client boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists coach_notes_client_idx
  on coach_notes (client_id, created_at desc);


-- ---------------------------------------------------------------------
-- 6. client_flags — "I'm stuck, talk about this next session"
-- ---------------------------------------------------------------------
create table if not exists client_flags (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references auth.users(id) on delete cascade,
  text        text not null check (char_length(text) > 0),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists client_flags_client_idx
  on client_flags (client_id, resolved_at, created_at desc);


-- ---------------------------------------------------------------------
-- 7. Enable RLS on everything
-- ---------------------------------------------------------------------
alter table coaching_relationships enable row level security;
alter table commitments            enable row level security;
alter table commitment_check_ins   enable row level security;
alter table coach_notes            enable row level security;
alter table client_flags           enable row level security;


-- ---------------------------------------------------------------------
-- 8. Helper: is the current user a coach of the given client?
--    SECURITY DEFINER so it can read coaching_relationships
--    even when called from a policy that scopes other tables.
-- ---------------------------------------------------------------------
create or replace function is_coach_of(target_client uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from coaching_relationships
    where coach_id  = auth.uid()
      and client_id = target_client
      and status    = 'active'
  );
$$;

revoke all on function is_coach_of(uuid) from public;
grant execute on function is_coach_of(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 9. RLS policies
-- ---------------------------------------------------------------------

-- Drop legacy v1 policies if they still exist
drop policy if exists "Users can read own items"   on commitments;
drop policy if exists "Users can insert own items" on commitments;
drop policy if exists "Users can update own items" on commitments;

-- coaching_relationships
create policy "Either party reads own relationships"
  on coaching_relationships for select
  using (auth.uid() = coach_id or auth.uid() = client_id);

create policy "Coach creates relationship"
  on coaching_relationships for insert
  with check (auth.uid() = coach_id);

create policy "Coach updates relationship"
  on coaching_relationships for update
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

-- commitments
create policy "Client reads own commitments"
  on commitments for select
  using (auth.uid() = user_id);

create policy "Coach reads client commitments"
  on commitments for select
  using (is_coach_of(user_id));

create policy "Client inserts own commitments"
  on commitments for insert
  with check (auth.uid() = user_id);

create policy "Coach inserts for client"
  on commitments for insert
  with check (is_coach_of(user_id));

create policy "Client updates own commitments"
  on commitments for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Coach updates client commitments"
  on commitments for update
  using (is_coach_of(user_id)) with check (is_coach_of(user_id));

-- commitment_check_ins (access flows through parent commitment)
create policy "Read check-ins via commitment access"
  on commitment_check_ins for select
  using (
    exists (
      select 1 from commitments c
      where c.id = commitment_check_ins.commitment_id
        and (c.user_id = auth.uid() or is_coach_of(c.user_id))
    )
  );

create policy "Client creates own check-ins"
  on commitment_check_ins for insert
  with check (
    exists (
      select 1 from commitments c
      where c.id = commitment_check_ins.commitment_id
        and c.user_id = auth.uid()
    )
  );

-- coach_notes
create policy "Coach reads own notes"
  on coach_notes for select
  using (auth.uid() = coach_id);

create policy "Client reads notes visible to them"
  on coach_notes for select
  using (auth.uid() = client_id and visible_to_client = true);

create policy "Coach inserts notes for own clients"
  on coach_notes for insert
  with check (auth.uid() = coach_id and is_coach_of(client_id));

create policy "Coach updates own notes"
  on coach_notes for update
  using (auth.uid() = coach_id) with check (auth.uid() = coach_id);

-- client_flags
create policy "Client reads own flags"
  on client_flags for select
  using (auth.uid() = client_id);

create policy "Coach reads client flags"
  on client_flags for select
  using (is_coach_of(client_id));

create policy "Client creates own flags"
  on client_flags for insert
  with check (auth.uid() = client_id);

create policy "Either party resolves flag"
  on client_flags for update
  using  (auth.uid() = client_id or is_coach_of(client_id))
  with check (auth.uid() = client_id or is_coach_of(client_id));


-- ---------------------------------------------------------------------
-- 10. Auto-bump commitments.updated_at on edit
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists commitments_set_updated_at on commitments;
create trigger commitments_set_updated_at
  before update on commitments
  for each row execute function set_updated_at();


-- =====================================================================
-- Done. Old data has been migrated, RLS is rewritten, and coaches can
-- now see and act on data for their active clients.
-- =====================================================================
