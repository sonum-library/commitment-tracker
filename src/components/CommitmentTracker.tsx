import { useEffect, useState } from 'react'
import { supabase, type Commitment } from '../supabase'
import CommitmentItem from './CommitmentItem'
import AddCommitment from './AddCommitment'

type Props = {
  userId: string
}

export default function CommitmentTracker({ userId }: Props) {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCommitments()
  }, [userId])

  async function fetchCommitments() {
    const { data } = await supabase
      .from('commitment_tracker_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (data) setCommitments(data)
    setLoading(false)
  }

  async function addCommitment(text: string, dueDate: string | null) {
    const { data } = await supabase
      .from('commitment_tracker_items')
      .insert({ user_id: userId, text, due_date: dueDate })
      .select()
      .single()
    if (data) setCommitments(prev => [...prev, data])
  }

  async function completeCommitment(id: string) {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('commitment_tracker_items')
      .update({ completed_at: now })
      .eq('id', id)
      .select()
      .single()
    if (data) {
      setCommitments(prev => prev.map(c => c.id === id ? data : c))
    }
  }

  const active = commitments.filter(c => !c.completed_at)
  const recentlyCompleted = commitments
    .filter(c => c.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 10)

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
            {active.map(commitment => (
              <CommitmentItem
                key={commitment.id}
                commitment={commitment}
                onComplete={completeCommitment}
              />
            ))}
          </ul>
        )}
      </section>

      <AddCommitment onAdd={addCommitment} />

      {recentlyCompleted.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
            Recently completed
          </h2>
          <ul className="space-y-1">
            {recentlyCompleted.map(commitment => (
              <li
                key={commitment.id}
                className="flex items-start gap-3 px-4 py-3 bg-white rounded-xl border border-stone-100 opacity-50"
              >
                <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-400 line-through">{commitment.text}</p>
                  {commitment.completed_at && (
                    <p className="text-xs text-stone-300 mt-0.5">
                      {formatDate(commitment.completed_at)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
