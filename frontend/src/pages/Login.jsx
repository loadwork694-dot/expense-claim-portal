import { useState } from 'react'
import { sendAuthRequest } from './authApi.js'

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const result = await sendAuthRequest('/auth/login', { email, password })
      onAuthenticated(result)
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 className="portal-title">Expense Claim Portal</h1>
        <div className="card-divider" />
        {error && <div className="auth-error" role="alert"><span aria-hidden="true">×</span>{error}</div>}
        <h2 id="login-title">Please Login First</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="auth-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Login to Continue'}
          </button>
        </form>
        <p className="auth-switch login-switch">
          Don&apos;t have an account? <a href="/signup">Sign up</a>
        </p>
      </section>
    </main>
  )
}

export default Login
