-- Commitment Tracker — run this in the Supabase SQL editor once per project

create table if not exists commitment_tracker_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null check (char_length(text) > 0),
  due_date    date,
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Index for the main query (user's items, ordered by created_at)
create index if not exists commitment_tracker_items_user_id_idx
  on commitment_tracker_items (user_id, created_at);

-- Enable Row Level Security
alter table commitment_tracker_items enable row level security;

-- Each user can only see and modify their own rows
create policy "Users can read own items"
  on commitment_tracker_items for select
  using (auth.uid() = user_id);

create policy "Users can insert own items"
  on commitment_tracker_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update own items"
  on commitment_tracker_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No delete policy — items are kept for the completed history
