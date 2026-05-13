import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

type Props = {
  session: Session
}

export default function Header({ session }: Props) {
  const user = session.user
  const name = user.user_metadata?.full_name ?? user.email ?? 'You'
  const avatar = user.user_metadata?.avatar_url as string | undefined

  const handleSignOut = () => supabase.auth.signOut()

  return (
    <header className="bg-white border-b border-stone-200">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-teal-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-stone-700">Commitments</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {avatar ? (
              <img src={avatar} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-teal-200 flex items-center justify-center text-teal-700 text-xs font-semibold">
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm text-stone-600 hidden sm:block">{name.split(' ')[0]}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
