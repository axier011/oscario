import { useEffect, useState } from 'react'
import { apiLogin } from '../api'
import { isWebAuthnAvailable, loginBiometric } from '../lib/webauthn'

interface Props {
  onLogin: (token: string) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [bioAvail, setBioAvail] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)

  useEffect(() => {
    setBioAvail(isWebAuthnAvailable())
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const token = await apiLogin(username, password)
      localStorage.setItem('oscario-token', token)
      onLogin(token)
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  async function handleBiometric() {
    setBioLoading(true)
    setError('')
    try {
      const token = await loginBiometric()
      localStorage.setItem('oscario-token', token)
      onLogin(token)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Sin credenciales')) {
        setError('No hay biometría registrada. Inicia sesión con contraseña y registírala desde Ajustes.')
      } else {
        setError('Verificación biométrica fallida')
      }
    } finally {
      setBioLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">🐠</div>
        <h1 className="login-title">Oscario</h1>
        <p className="login-subtitle">Control de acuario</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            className="login-input"
            type="text"
            placeholder="Usuario"
            autoComplete="username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Contraseña"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading || bioLoading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        {bioAvail && (
          <button
            className="login-bio-btn"
            onClick={handleBiometric}
            disabled={loading || bioLoading}
          >
            {bioLoading
              ? <><i className="fa-solid fa-spinner fa-spin" /> Verificando...</>
              : <><i className="fa-solid fa-fingerprint" /> Face ID / Windows Hello</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
