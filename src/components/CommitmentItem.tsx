import { useState } from 'react'
import type { Commitment } from '../supabase'

type Props = {
  commitment: Commitment
  onComplete: (id: string) => Promise<void>
}

export default function CommitmentItem({ commitment, onComplete }: Props) {
  const [checking, setChecking] = useState(false)

  const handleCheck = async () => {
    if (checking) return
    setChecking(true)
    await onComplete(commitment.id)
  }

  const isOverdue = commitment.due_date && new Date(commitment.due_date) < new Date()

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 bg-white rounded-xl border border-stone-200 shadow-xs group">
      <button
        onClick={handleCheck}
        disabled={checking}
        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-stone-300 hover:border-teal-400 hover:bg-teal-50 transition-colors cursor-pointer flex items-center justify-center disabled:opacity-50"
        aria-label={`Mark "${commitment.what}" as complete`}
      >
        {checking && (
          <div className="w-2.5 h-2.5 rounded-full border border-teal-500 border-t-transparent animate-spin" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-700 leading-snug">{commitment.what}</p>
        {commitment.due_date && (
          <p className={`text-xs mt-1 ${isOverdue ? 'text-rose-400' : 'text-stone-400'}`}>
            {isOverdue ? 'Overdue · ' : 'Due '}
            {formatDueDate(commitment.due_date)}
          </p>
        )}
      </div>
    </li>
  )
}

function formatDueDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1 && diff < 7) return `in ${diff} days`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
