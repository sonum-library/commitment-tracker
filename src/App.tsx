import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import SignIn from './components/SignIn'
import Header from './components/Header'
import CommitmentTracker from './components/CommitmentTracker'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <SignIn />
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Header session={session} />
      <main className="max-w-xl mx-auto px-4 py-8">
        <CommitmentTracker userId={session.user.id} />
      </main>
    </div>
  )
}
