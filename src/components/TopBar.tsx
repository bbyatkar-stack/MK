import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { POINT_PACKAGES } from '../types'
import type { Profile } from '../types'

interface TopBarProps {
  session: Session | null
  profile: Profile | null
  onProfileChanged: () => void
}

function TopBar({ session, profile, onProfileChanged }: TopBarProps) {
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [buying, setBuying] = useState<number | null>(null)

  async function handleTopUp(points: number) {
    if (!profile) return
    setBuying(points)
    const { error } = await supabase
      .from('profiles')
      .update({ balance: profile.balance + points })
      .eq('id', profile.id)
    setBuying(null)
    if (!error) {
      onProfileChanged()
      setTopUpOpen(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session || !profile) return null

  return (
    <div className="top-bar">
      <div className="top-balance-wrap">
        <div className="top-balance tnum">
          {profile.balance} <span>баллов</span>
        </div>
        <button type="button" className="secondary-button" onClick={() => setTopUpOpen((o) => !o)}>
          Пополнить
        </button>
        {topUpOpen && (
          <div className="topup-options topup-options-float">
            {POINT_PACKAGES.map((pkg) => (
              <button
                key={pkg.points}
                type="button"
                className="topup-option"
                disabled={buying !== null}
                onClick={() => handleTopUp(pkg.points)}
              >
                {buying === pkg.points ? 'Начисляем...' : `${pkg.label} (+${pkg.points})`}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="secondary-button" onClick={handleLogout}>
        Выйти
      </button>
    </div>
  )
}

export default TopBar
