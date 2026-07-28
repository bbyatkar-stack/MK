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
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordFormOpen, setPasswordFormOpen] = useState(false)
  const [buying, setBuying] = useState<number | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

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
    }
  }

  async function handleChangePassword() {
    setPasswordError(null)

    if (newPassword.length < 6) {
      setPasswordError('Пароль должен быть не короче 6 символов')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают')
      return
    }

    setPasswordSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })

      if (error) {
        setPasswordError(error.message)
        return
      }

      setNewPassword('')
      setConfirmPassword('')
      setPasswordFormOpen(false)
      setProfileOpen(false)
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Не удалось сменить пароль')
    } finally {
      setPasswordSubmitting(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (!session || !profile) return null

  return (
    <div className="top-bar">
      <div className="top-balance tnum">
        {profile.balance} <span>баллов</span>
      </div>

      <div className="top-profile-wrap">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setProfileOpen((o) => !o)}
        >
          Профиль
        </button>
        {profileOpen && (
          <div className="profile-dropdown">
            <div className="profile-section">
              <p className="topup-label">Логин</p>
              <p className="profile-email">{session.user.email}</p>
            </div>

            <div className="profile-section">
              {!passwordFormOpen ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPasswordFormOpen(true)}
                >
                  Сменить пароль
                </button>
              ) : (
                <>
                  <p className="topup-label">Новый пароль</p>
                  <input
                    type="password"
                    placeholder="Новый пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="text-input"
                    minLength={6}
                  />
                  <input
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-input"
                    minLength={6}
                  />
                  {passwordError && <p className="form-error">{passwordError}</p>}
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={passwordSubmitting}
                    onClick={handleChangePassword}
                  >
                    {passwordSubmitting ? 'Сохраняем...' : 'Сохранить пароль'}
                  </button>
                </>
              )}
            </div>

            <div className="profile-section">
              <p className="topup-label">Пополнить баланс</p>
              <div className="topup-options">
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
            </div>
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
