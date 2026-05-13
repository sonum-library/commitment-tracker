// =====================================================================
// commitment.types.ts
// Shared types for the v2 schema. Drop into src/types/.
// =====================================================================

export type CommitmentStatus = "active" | "paused" | "archived";
export type CheckInStatus    = "done" | "partial" | "missed";
export type RelationshipStatus = "active" | "paused" | "ended";

export type Commitment = {
  id: string;
  user_id: string;

  // The behaviour-change primitives
  what: string;
  why: string | null;
  cue: string | null;                 // implementation intention ("after X, I will…")
  definition_of_done: string | null;  // binary yes/no completion criterion
  cadence: string | null;             // "Daily" | "Weekdays" | "Twice weekly" | "Weekly" | "One-time"
  confidence: number | null;          // 1–10 at commit time
  importance: number | null;          // 1–10 at commit time
  obstacle: string | null;
  if_then: string | null;
  pillar: string | null;              // client-chosen theme/goal area

  status: CommitmentStatus;
  due_date: string | null;            // ISO date — only for one-shot deadlines
  start_date: string | null;
  end_date: string | null;

  created_at: string;
  updated_at: string;
};

export type CommitmentCheckIn = {
  id: string;
  commitment_id: string;
  date: string;                       // ISO date — one row per (commitment, date)
  status: CheckInStatus;
  reflection: string | null;
  created_at: string;
};

export type CoachingRelationship = {
  coach_id: string;
  client_id: string;
  status: RelationshipStatus;
  created_at: string;
};

export type CoachNote = {
  id: string;
  coach_id: string;
  client_id: string;
  commitment_id: string | null;
  text: string;
  visible_to_client: boolean;
  created_at: string;
};

export type ClientFlag = {
  id: string;
  client_id: string;
  text: string;
  resolved_at: string | null;
  created_at: string;
};

// Convenience view model used by client/coach UIs
export type CommitmentWithCheckIns = Commitment & {
  check_ins: CommitmentCheckIn[];
};

// Cadence helper used by both UI and the daily-nudge edge function
export const CADENCE_OPTIONS = [
  "Daily",
  "Weekdays",
  "Twice weekly",
  "Weekly",
  "One-time",
] as const;
export type Cadence = (typeof CADENCE_OPTIONS)[number];
