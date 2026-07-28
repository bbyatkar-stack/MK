import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { Profile } from '../types'

export function useProfile(session: Session | null) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!session) {
      setProfile(null)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select()
      .eq('id', session.user.id)
      .single()
    setProfile(data as Profile | null)
    setLoading(false)
  }, [session])

  useEffect(() => {
    reload()
  }, [reload])

  return { profile, loading, reload }
}
