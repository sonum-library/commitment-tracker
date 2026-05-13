import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Commitment = {
  id: string
  user_id: string
  what: string
  due_date: string | null
  status: 'active' | 'paused' | 'archived'
  pillar: string | null
  cadence: string | null
  created_at: string
  updated_at: string
}
