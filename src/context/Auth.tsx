import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthCtx {
  user: User | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  configured: false,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = async () => {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('profiles')
      .select('id, role, nama, no_hp, is_verified, verifier_reputation, tenure_days')
      .eq('id', user.id)
      .maybeSingle()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase!.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase!.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    void refreshProfile()
  }, [user])

  const signOut = async () => {
    await supabase?.auth.signOut()
    setProfile(null)
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, configured: isSupabaseConfigured, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  )
}