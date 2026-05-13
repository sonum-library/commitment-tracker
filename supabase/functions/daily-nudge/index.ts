// =====================================================================
// supabase/functions/daily-nudge/index.ts
// Daily check-in nudges via Resend.
//
// Deploy:
//   supabase functions deploy daily-nudge --no-verify-jwt
//
// Set secrets:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set FROM_EMAIL="Sonum <hi@yourdomain.com>"
//   supabase secrets set APP_URL=https://commitment-tracker.so-samra.workers.dev
//
// Schedule (run every morning at 7am in client's timezone — simplest is
// UTC and tune later). In the Supabase SQL editor:
//
//   select cron.schedule(
//     'daily-nudge',
//     '0 12 * * *',  -- 12:00 UTC = ~7am EST
--     $$ select net.http_post(
--          url := 'https://<project-ref>.functions.supabase.co/daily-nudge',
--          headers := jsonb_build_object(
--            'Authorization','Bearer ' || current_setting('app.settings.service_role_key')
--          )
--        ) $$
//   );
//
// (Enable extensions first: create extension if not exists pg_cron;
//  create extension if not exists pg_net;)
// =====================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "commitments@example.com";
const APP_URL        = Deno.env.get("APP_URL") ?? "https://example.com";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// --- cadence → is this commitment due today? -------------------------
function dueToday(cadence: string | null, due_date: string | null, today: string): boolean {
  if (due_date && due_date === today) return true;

  const day = new Date(today + "T12:00:00Z").getUTCDay(); // 0 Sun … 6 Sat
  const isWeekday = day >= 1 && day <= 5;

  switch ((cadence ?? "").toLowerCase()) {
    case "daily":        return true;
    case "weekdays":     return isWeekday;
    case "twice weekly": return day === 2 || day === 4;  // Tue / Thu by default
    case "weekly":       return day === 1;               // Mon by default
    case "one-time":     return false;                   // handled by due_date above
    default:             return true;
  }
}

// --- escape user content for HTML email ------------------------------
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!)
  );
}

// --- render the email body -------------------------------------------
function renderEmail(
  firstName: string,
  items: { what: string; cue: string | null }[]
): { subject: string; html: string } {
  const itemsHtml = items
    .map(
      (c) => `
        <tr><td style="padding:14px 0; border-bottom:1px solid #E3DAC7;">
          <div style="font-family:Georgia,serif; font-size:17px; color:#1F1B16; line-height:1.35;">
            ${escapeHtml(c.what)}
          </div>
          ${
            c.cue
              ? `<div style="color:#847A6C; font-size:13px; margin-top:4px;">
                   ${escapeHtml(c.cue)}
                 </div>`
              : ""
          }
        </td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#F2EDE3; padding:32px;">
      <div style="max-width:520px; margin:0 auto; background:#FBF7EE; border:1px solid #E3DAC7; border-radius:14px; padding:32px;">
        <p style="font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color:#847A6C; margin:0 0 8px;">Today</p>
        <h1 style="font-family:Georgia,serif; font-size:26px; color:#1F1B16; margin:0 0 8px; font-weight:500; letter-spacing:-0.01em;">
          Good morning, ${escapeHtml(firstName)}.
        </h1>
        <p style="color:#3D362E; font-size:15px; margin:0 0 24px;">
          Here's what you committed to.
        </p>
        <table style="width:100%; border-collapse:collapse;">${itemsHtml}</table>
        <a href="${APP_URL}"
           style="display:inline-block; margin-top:24px; background:#1F1B16; color:#FBF7EE; padding:11px 20px; border-radius:999px; text-decoration:none; font-size:14px; font-weight:500;">
          Check in →
        </a>
        <p style="color:#847A6C; font-size:11px; margin-top:32px; letter-spacing:0.04em;">
          You're getting this because you set commitments with your coach. Reply STOP to pause.
        </p>
      </div>
    </div>`;

  const subject =
    items.length === 1
      ? `Today: ${items[0].what.slice(0, 50)}${items[0].what.length > 50 ? "…" : ""}`
      : `${items.length} commitments today`;

  return { subject, html };
}

// --- send via Resend -------------------------------------------------
async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!r.ok) {
    console.error("Resend error", await r.text());
  }
}

// --- main handler ----------------------------------------------------
serve(async () => {
  const today = new Date().toISOString().slice(0, 10);

  // 1. all active commitments
  const { data: commitments, error } = await admin
    .from("commitments")
    .select("id, user_id, what, cue, cadence, due_date")
    .eq("status", "active");

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  // 2. group commitments due today by user
  const byUser = new Map<string, { id: string; what: string; cue: string | null }[]>();
  for (const c of commitments ?? []) {
    if (!dueToday(c.cadence, c.due_date, today)) continue;
    const list = byUser.get(c.user_id) ?? [];
    list.push({ id: c.id, what: c.what, cue: c.cue });
    byUser.set(c.user_id, list);
  }

  // 3. for each user, skip commitments already checked in today
  let sent = 0;
  for (const [userId, items] of byUser) {
    const ids = items.map((i) => i.id);
    const { data: alreadyCheckedIn } = await admin
      .from("commitment_check_ins")
      .select("commitment_id")
      .in("commitment_id", ids)
      .eq("date", today);

    const done = new Set((alreadyCheckedIn ?? []).map((c) => c.commitment_id));
    const remaining = items.filter((i) => !done.has(i.id));
    if (remaining.length === 0) continue;

    // 4. resolve email + first name
    const { data: userRow } = await admin.auth.admin.getUserById(userId);
    const email = userRow?.user?.email;
    if (!email) continue;

    const fullName =
      (userRow?.user?.user_metadata as { full_name?: string } | undefined)
        ?.full_name ?? "";
    const firstName = fullName.split(" ")[0] || "there";

    const { subject, html } = renderEmail(firstName, remaining);
    await sendEmail(email, subject, html);
    sent++;
  }

  return new Response(JSON.stringify({ sent, scanned: byUser.size }), {
    headers: { "Content-Type": "application/json" },
  });
});
