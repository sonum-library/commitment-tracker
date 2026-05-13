import { useState } from 'react'

type Props = {
  onAdd: (text: string, dueDate: string | null) => Promise<void>
}

export default function AddCommitment({ onAdd }: Props) {
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || saving) return

    setSaving(true)
    await onAdd(trimmed, dueDate || null)
    setText('')
    setDueDate('')
    setSaving(false)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <section>
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">
        Add commitment
      </h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="What are you committing to?"
          rows={2}
          className="w-full resize-none text-sm text-stone-700 placeholder-stone-300 border-none outline-none bg-transparent leading-relaxed"
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e as unknown as React.FormEvent)
            }
          }}
        />
        <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
          <div className="flex items-center gap-1.5 flex-1">
            <svg className="w-3.5 h-3.5 text-stone-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <input
              type="date"
              value={dueDate}
              min={today}
              onChange={e => setDueDate(e.target.value)}
              className="text-xs text-stone-500 border-none outline-none bg-transparent cursor-pointer"
              aria-label="Optional due date"
            />
          </div>
          <button
            type="submit"
            disabled={!text.trim() || saving}
            className="px-4 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-semibold hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
      <p className="text-xs text-stone-400 mt-2 text-center">Press Enter to add quickly</p>
    </section>
  )
}
