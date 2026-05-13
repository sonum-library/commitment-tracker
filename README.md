# Commitment Tracker v2 — coaching upgrade

This package upgrades your existing commitment-tracker repo from a single-user to-do list into a coaching tool. The architecture lets you, the coach, actually see and act on your clients' between-session work.

## What's in the box

```
01-migration.sql          → run once in Supabase SQL editor
02-types.ts               → src/types/commitment.types.ts
03-CommitmentWizard.tsx   → src/components/CommitmentWizard.tsx
04-daily-nudge.ts         → supabase/functions/daily-nudge/index.ts
```

## What changes, conceptually

Your v1 table treated each row as `{ text, due_date, completed_at }` and locked every user to their own data via RLS. That works for a personal tracker — but it makes coaching impossible, because the schema has no concept of a coach, and the access policy actively prevents you from seeing your clients.

v2 introduces five tables: `commitments` (the old one, expanded), `commitment_check_ins`, `coaching_relationships`, `coach_notes`, and `client_flags`. Access is governed by a single `is_coach_of(client_id)` helper that lets a coach read and write data for any client they have an active relationship with. Clients keep full read-write access to their own data; nothing they could do before is taken away.

The other shift is in what a commitment actually *contains*. v1 stored "what" and "by when." v2 stores what, *why*, *the cue* (implementation intention), *definition of done*, *confidence*, *anticipated obstacle*, and *if-then plan*. These aren't decorative fields — they're the ones that the behavior-change literature consistently links to follow-through. The wizard makes them the path of least resistance at commitment time, so check-ins can stay one-tap.

## Deploy order

**1. Run the migration.** Paste `01-migration.sql` into the Supabase SQL editor and run it. It's idempotent — safe to re-run. It renames `commitment_tracker_items` to `commitments`, adds the new columns, creates the four new tables, migrates your existing `completed_at` data into `commitment_check_ins`, drops the old single-user RLS policies, and installs the new coach-aware ones.

**2. Drop in the TypeScript types.** Copy `02-types.ts` to `src/types/commitment.types.ts`. The wizard and any future components import from here, so a single rename later updates everywhere.

**3. Drop in the wizard.** Copy `03-CommitmentWizard.tsx` to `src/components/CommitmentWizard.tsx`. Wire it into your existing app:

```tsx
import { useState } from "react";
import { CommitmentWizard } from "./components/CommitmentWizard";
import { supabase } from "./lib/supabase";

function App() {
  const [showWizard, setShowWizard] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // get current user once
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  return (
    <>
      <button onClick={() => setShowWizard(true)}>+ New commitment</button>

      {showWizard && userId && (
        <CommitmentWizard
          clientId={userId}
          pillarOptions={["Career", "Wellbeing", "Relationships"]}
          onComplete={(id) => {
            console.log("created", id);
            setShowWizard(false);
            // refresh your list here
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </>
  );
}
```

When *you*, as coach, create a commitment for a client, pass the *client's* `user_id` to `clientId` instead. The RLS policy `Coach inserts for client` will allow the insert as long as you have an active `coaching_relationships` row with them.

**4. Add your first coaching relationship.** Until you have at least one row in `coaching_relationships`, the coach view is empty. Once your client has signed in once (so they exist in `auth.users`), run this in the SQL editor with both UUIDs:

```sql
insert into coaching_relationships (coach_id, client_id)
values (
  '<your-auth-user-id>',
  '<client-auth-user-id>'
);
```

You can find UUIDs in **Authentication → Users** in Supabase. Long-term you'll want a UI for inviting clients (magic link email, a join code, etc) — for now manual rows are fine.

**5. Deploy the daily-nudge edge function.** Save `04-daily-nudge.ts` as `supabase/functions/daily-nudge/index.ts` in your repo, then:

```bash
# one-time
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set FROM_EMAIL="Sonum <hi@yourdomain.com>"
supabase secrets set APP_URL=https://commitment-tracker.so-samra.workers.dev

# every deploy
supabase functions deploy daily-nudge
```

Then enable the cron extensions and schedule it (in the SQL editor):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-nudge',
  '0 12 * * *',  -- 12:00 UTC ≈ 8am EST / 1pm UK
  $$ select net.http_post(
       url := 'https://<your-project-ref>.functions.supabase.co/daily-nudge',
       headers := jsonb_build_object(
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
       )
     ) $$
);
```

For Resend, the free tier is 100 emails/day on the `resend.dev` domain — plenty for the first wave of clients. Add a verified custom domain once you're past five clients.

## The bits I didn't put in standalone files

These are short enough to live inline. Drop them next to the wizard.

**Coach note composer.** A textarea + send button that writes to `coach_notes`. The RLS policy `Coach inserts notes for own clients` checks `is_coach_of(client_id)` automatically:

```tsx
async function sendNote(clientId: string, text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("coach_notes").insert({
    coach_id: user.id,
    client_id: clientId,
    text,
    visible_to_client: true,
  });
}
```

**Client flag ("I'm stuck, talk Monday").** Same pattern, even simpler:

```tsx
async function flag(text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("client_flags").insert({
    client_id: user.id,
    text,
  });
}
```

**Check-in submit.** When a client taps a commitment as done/partial/missed:

```tsx
async function checkIn(
  commitmentId: string,
  status: "done" | "partial" | "missed",
  reflection?: string
) {
  await supabase.from("commitment_check_ins").upsert(
    {
      commitment_id: commitmentId,
      date: new Date().toISOString().slice(0, 10),
      status,
      reflection: reflection || null,
    },
    { onConflict: "commitment_id,date" }
  );
}
```

The `upsert` on the `(commitment_id, date)` unique constraint means a client can update their check-in throughout the day without creating duplicates.

## Gotchas worth flagging

The `is_coach_of()` function is `SECURITY DEFINER` with `search_path = public`. This is intentional — it lets a policy on `commitments` query `coaching_relationships` even though the calling user's own RLS might restrict their view of relationships they're not in. The function is only granted to authenticated users, never to anon. Don't loosen this.

The migration drops `completed_at` after copying its data into check-ins. If you've shipped anywhere that still reads `completed_at`, update those reads before running the migration. There's exactly one such read in your current src — the file is small enough that grep'ing for `completed_at` will catch it in seconds.

The wizard's eight-step flow is deliberately long. Resist the urge to shorten it — every step earns its place by capturing something the literature says matters for follow-through. The friction is the feature. If you want to add a "quick add" path for trivial commitments later, do it as a separate component, not by trimming this one.

Email cadence will need a kill switch eventually — store an `email_pref` on a per-user table or in `user_metadata`, and check it in the edge function before sending. For ten or twenty clients you can wait; past that, build it.

## One thing I'd add next

Once this is live and you have two or three clients running real commitments through it, add a `coaching_sessions` table:

```sql
create table coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references auth.users(id),
  client_id uuid references auth.users(id),
  scheduled_at timestamptz not null,
  agenda_notes text,
  session_notes text,
  created_at timestamptz default now()
);
```

…and a "next session" prep view that joins the last seven days of check-ins + flags + unread coach notes per client. That becomes your pre-session ritual — open the app, see what's been happening, walk into the session prepared. That's the loop that turns this from a tracker into a practice tool.
