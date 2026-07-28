import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'

type Mode = 'sign-in' | 'sign-up' | 'reset'

interface AuthPanelProps {
  session: Session | null
}

function AuthPanel({ session }: AuthPanelProps) {
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function resetFields() {
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setMessage(null)
  }

  function switchMode(next: Mode) {
    setMode(next)
    resetFields()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (mode === 'sign-up' && password !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setSubmitting(true)

    if (mode === 'sign-in') {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) setError(signInError.message)
    } else if (mode === 'sign-up') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) {
        setError(signUpError.message)
      } else if (!data.session) {
        setMessage('Проверьте почту — мы отправили письмо для подтверждения регистрации.')
      }
    } else {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setMessage('Если такой email зарегистрирован — на него отправлена ссылка для сброса пароля.')
      }
    }

    setSubmitting(false)
  }

  // Вошедшие пользователи видят баланс и выход в сайдбаре — здесь показываем
  // только форму входа/регистрации для тех, кто ещё не вошёл.
  if (session) return null

  return (
    <div className="auth-panel">
      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-input"
          required
        />

        {mode !== 'reset' && (
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="text-input"
            required
            minLength={6}
          />
        )}

        {mode === 'sign-up' && (
          <input
            type="password"
            placeholder="Повторите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="text-input"
            required
            minLength={6}
          />
        )}

        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-message">{message}</p>}

        <button type="submit" className="primary-button" disabled={submitting}>
          {mode === 'sign-in' && (submitting ? 'Входим...' : 'Войти')}
          {mode === 'sign-up' && (submitting ? 'Регистрируем...' : 'Зарегистрироваться')}
          {mode === 'reset' && (submitting ? 'Отправляем...' : 'Отправить ссылку для сброса')}
        </button>

        <div className="auth-links">
          {mode === 'sign-in' && (
            <>
              <button type="button" className="link-button" onClick={() => switchMode('sign-up')}>
                Нет аккаунта? Зарегистрироваться
              </button>
              <button type="button" className="link-button" onClick={() => switchMode('reset')}>
                Забыли пароль?
              </button>
            </>
          )}
          {mode === 'sign-up' && (
            <button type="button" className="link-button" onClick={() => switchMode('sign-in')}>
              Уже есть аккаунт? Войти
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" className="link-button" onClick={() => switchMode('sign-in')}>
              Вспомнили пароль? Войти
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default AuthPanel
