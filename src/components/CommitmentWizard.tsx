// =====================================================================
// CommitmentWizard.tsx
// Drop into src/components/.
// Requires: react, lucide-react, @supabase/supabase-js, tailwindcss.
// Assumes a configured Supabase client at src/lib/supabase.ts.
// =====================================================================

import { useState } from "react";
import { ArrowLeft, ArrowRight, X, Check, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { CADENCE_OPTIONS, type Cadence } from "../types/commitment.types";

type CommitmentWizardProps = {
  /** The user_id who will own this commitment.
   *  Pass the current user's id when self-coaching, or a client's id when
   *  a coach is creating a commitment on their behalf. */
  clientId: string;

  /** Optional named pillars the client is working on. If omitted, the
   *  final step shows a free-text input. */
  pillarOptions?: string[];

  /** Called with the new commitment id after a successful insert. */
  onComplete: (commitmentId: string) => void;

  /** Called when the user dismisses the wizard without committing. */
  onCancel: () => void;
};

type FormState = {
  what: string;
  why: string;
  cue: string;
  definition_of_done: string;
  confidence: number | null;
  importance: number;
  obstacle: string;
  if_then: string;
  pillar: string;
  cadence: Cadence;
};

const INITIAL_FORM: FormState = {
  what: "",
  why: "",
  cue: "",
  definition_of_done: "",
  confidence: null,
  importance: 8,
  obstacle: "",
  if_then: "",
  pillar: "",
  cadence: "Weekly",
};

type StepDef =
  | {
      kind: "input";
      field: "what" | "why" | "cue" | "definition_of_done" | "obstacle" | "if_then";
      title: string;
      subtitle: string;
      placeholder: string;
      multiline?: boolean;
    }
  | { kind: "confidence"; title: string; subtitle: string }
  | { kind: "meta"; title: string; subtitle: string };

const STEPS: StepDef[] = [
  {
    kind: "input",
    field: "what",
    title: "What's the commitment?",
    subtitle: "An action, not a feeling. Something you can finish.",
    placeholder: "e.g. Send 3 outreach emails to product folks",
  },
  {
    kind: "input",
    field: "why",
    title: "Why does this matter?",
    subtitle: "This becomes the anchor when motivation dips.",
    placeholder: "e.g. Building a network ahead of my Q3 job search",
    multiline: true,
  },
  {
    kind: "input",
    field: "cue",
    title: "When exactly will you do it?",
    subtitle:
      'Naming the cue ("after my morning coffee") sharply outperforms vague timing ("in the morning") in follow-through research.',
    placeholder: "e.g. Tuesday & Thursday mornings, right after coffee",
  },
  {
    kind: "input",
    field: "definition_of_done",
    title: "What counts as done?",
    subtitle: "Something you can answer yes or no to. No wiggle room.",
    placeholder: "e.g. 3 personalised emails sent by 10am",
  },
  {
    kind: "confidence",
    title: "How confident are you, 1 to 10, that you'll actually do this?",
    subtitle:
      "Be honest. This number predicts whether the commitment survives the week.",
  },
  {
    kind: "input",
    field: "obstacle",
    title: "What could get in the way?",
    subtitle: "Not the worst case — the realistic, likely thing.",
    placeholder: "e.g. Imposter syndrome before hitting send",
  },
  {
    kind: "input",
    field: "if_then",
    title: "If that happens, then what?",
    subtitle:
      "Plan the response now, so you don't have to decide in the moment.",
    placeholder: "e.g. If I freeze, send the draft from yesterday without rewriting",
    multiline: true,
  },
  {
    kind: "meta",
    title: "One last thing.",
    subtitle: "Tag it so you can see patterns over time.",
  },
];

export function CommitmentWizard({
  clientId,
  pillarOptions = [],
  onComplete,
  onCancel,
}: CommitmentWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const showLowConfidenceNudge =
    current.kind === "confidence" &&
    form.confidence !== null &&
    form.confidence < 7;

  function canAdvance(): boolean {
    if (current.kind === "input") {
      return form[current.field].trim().length > 0;
    }
    if (current.kind === "confidence") {
      return form.confidence !== null;
    }
    if (current.kind === "meta") {
      return form.cadence.length > 0;
    }
    return false;
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function commit() {
    setSaving(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("commitments")
      .insert({
        user_id: clientId,
        what: form.what.trim(),
        why: form.why.trim() || null,
        cue: form.cue.trim() || null,
        definition_of_done: form.definition_of_done.trim() || null,
        confidence: form.confidence,
        importance: form.importance,
        obstacle: form.obstacle.trim() || null,
        if_then: form.if_then.trim() || null,
        pillar: form.pillar.trim() || null,
        cadence: form.cadence,
        status: "active",
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Could not save commitment.");
      return;
    }
    onComplete(data.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-stone-50 border border-stone-200 rounded-2xl p-6 md:p-8 shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500 font-medium">
            New commitment
          </p>
          <button
            onClick={onCancel}
            className="text-stone-400 hover:text-stone-900 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-7">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-[3px] rounded-full transition-colors ${
                i <= step ? "bg-stone-900" : "bg-stone-200"
              }`}
            />
          ))}
        </div>

        {/* Step body */}
        <div key={step}>
          <h2 className="text-xl md:text-2xl font-medium text-stone-900 mb-2 leading-snug">
            {current.title}
          </h2>
          <p className="text-sm text-stone-500 mb-5 leading-relaxed">
            {current.subtitle}
          </p>

          {current.kind === "input" &&
            (current.multiline ? (
              <textarea
                value={form[current.field]}
                onChange={(e) => set(current.field, e.target.value)}
                placeholder={current.placeholder}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-700 min-h-[80px] resize-y"
                autoFocus
              />
            ) : (
              <input
                value={form[current.field]}
                onChange={(e) => set(current.field, e.target.value)}
                placeholder={current.placeholder}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-700"
                autoFocus
              />
            ))}

          {current.kind === "confidence" && (
            <div className="space-y-4">
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                  const active = form.confidence === n;
                  const activeClass =
                    n <= 4
                      ? "bg-orange-700 border-orange-700 text-white"
                      : n <= 6
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "bg-emerald-700 border-emerald-700 text-white";
                  return (
                    <button
                      key={n}
                      onClick={() => set("confidence", n)}
                      className={`w-9 h-9 rounded-lg border text-base font-medium transition-all ${
                        active
                          ? activeClass
                          : "bg-white border-stone-200 text-stone-900 hover:border-stone-900"
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {showLowConfidenceNudge && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm text-amber-900 leading-relaxed">
                    <strong>A coach's instinct here:</strong> under 7 is a sign
                    the commitment is too big. The fix isn't more willpower —
                    it's shrinking it until you're at 9. Want to revise it?
                  </p>
                  <button
                    onClick={() => setStep(0)}
                    className="mt-3 px-4 py-2 rounded-full border border-amber-700 text-amber-900 text-sm hover:bg-amber-100 transition-colors"
                  >
                    Shrink it
                  </button>
                </div>
              )}
            </div>
          )}

          {current.kind === "meta" && (
            <div className="space-y-5">
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-stone-500 font-medium block mb-2">
                  Pillar
                </label>
                {pillarOptions.length > 0 ? (
                  <div className="flex gap-2 flex-wrap">
                    {pillarOptions.map((p) => (
                      <button
                        key={p}
                        onClick={() => set("pillar", p)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          form.pillar === p
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-white text-stone-700 border-stone-200 hover:border-stone-900"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={form.pillar}
                    onChange={(e) => set("pillar", e.target.value)}
                    placeholder="e.g. Career, Wellbeing, Boundaries"
                    className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-700"
                  />
                )}
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.16em] text-stone-500 font-medium block mb-2">
                  Cadence
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CADENCE_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => set("cadence", c)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        form.cadence === c
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-700 border-stone-200 hover:border-stone-900"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-orange-700">{error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-7">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 transition-colors disabled:opacity-30 disabled:hover:text-stone-500"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-xs text-stone-400">
            {step + 1} of {STEPS.length}
          </span>
          {isLast ? (
            <button
              onClick={commit}
              disabled={!canAdvance() || saving}
              className="flex items-center gap-1.5 bg-stone-900 text-stone-50 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-orange-700 transition-colors disabled:bg-stone-400 disabled:hover:bg-stone-400"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving
                </>
              ) : (
                <>
                  Commit <Check size={14} />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => canAdvance() && setStep(step + 1)}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 bg-stone-900 text-stone-50 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-orange-700 transition-colors disabled:bg-stone-400 disabled:hover:bg-stone-400"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
