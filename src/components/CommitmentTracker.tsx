import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Commitment } from '../supabase'
import CommitmentItem from './CommitmentItem'
import { CommitmentWizard } from './CommitmentWizard'

type Props = {
  userId: string
}

export default function CommitmentTracker({ userId }: Props) {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set())
  const [showWizard, setShowWizard] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCommitments()
  }, [userId])

  async function fetchCommitments() {
    const today = new Date().toISOString().slice(0, 10)

    const [{ data: comms }, { data: checkIns }] = await Promise.all([
      supabase
        .from('commitments')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
      supabase
        .from('commitment_check_ins')
        .select('commitment_id')
        .eq('date', today)
        .eq('status', 'done'),
    ])

    if (comms) setCommitments(comms)
    if (checkIns) setCompletedToday(new Set(checkIns.map((c) => c.commitment_id)))
    setLoading(false)
  }

  async function completeCommitment(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    await supabase.from('commitment_check_ins').upsert(
      { commitment_id: id, date: today, status: 'done' },
      { onConflict: 'commitment_id,date' }
    )
    setCompletedToday((prev) => new Set([...prev, id]))
  }

  const active = commitments.filter((c) => !completedToday.has(c.id))
  const doneToday = commitments.filter((c) => completedToday.has(c.id))

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
          Active commitments
        </h2>

        {active.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 px-6 py-10 text-center">
            <div className="text-2xl mb-2">✨</div>
            <p className="text-stone-500 text-sm">Nothing here yet — add your first commitment below.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((commitment) => (
              <CommitmentItem
                key={commitment.id}
                commitment={commitment}
                onComplete={completeCommitment}
              />
            ))}
          </ul>
        )}
      </section>

      <button
        onClick={() => setShowWizard(true)}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400 text-sm hover:border-stone-400 hover:text-stone-600 transition-colors"
      >
        + New commitment
      </button>

      {doneToday.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
            Completed today
          </h2>
          <ul className="space-y-1">
            {doneToday.map((commitment) => (
              <li
                key={commitment.id}
                className="flex items-start gap-3 px-4 py-3 bg-white rounded-xl border border-stone-100 opacity-50"
              >
                <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <p className="text-sm text-stone-400 line-through">{commitment.what}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showWizard && (
        <CommitmentWizard
          clientId={userId}
          pillarOptions={['Career', 'Wellbeing', 'Relationships']}
          onComplete={() => {
            setShowWizard(false)
            fetchCommitments()
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
