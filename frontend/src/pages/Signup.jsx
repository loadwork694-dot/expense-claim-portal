import { useState } from 'react'
import { sendAuthRequest } from './authApi.js'

function Signup({ onAuthenticated }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('Employee')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await sendAuthRequest(
        '/auth/register',
        { name, email, password, role },
        { allowMessageOnly: true }
      )
      if (result.token && result.user) {
        onAuthenticated(result)
      } else {
        setNotice(result.message)
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-title">
        <h1 className="portal-title">Expense Claim Portal</h1>
        <div className="card-divider" />
        {error && <div className="auth-error" role="alert"><span aria-hidden="true">×</span>{error}</div>}
        {notice && <p className="portal-notice" role="status">{notice}</p>}
        <h2 id="signup-title">Create Your Account</h2>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="signup-name">Name</label>
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            minLength="2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="signup-role">Role</label>
          <select
            id="signup-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="Employee">Employee</option>
            <option value="Manager">Manager</option>
            <option value="Accounts">Accountant (Accounts)</option>
            <option value="Admin">Admin</option>
          </select>
          <p className="auth-help">Every signup needs Admin approval before you can sign in.</p>
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength="6"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <label htmlFor="signup-confirm-password">Confirm Password</label>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <button className="auth-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <a href="/login">Log in</a>
        </p>
      </section>
    </main>
  )
}

export default Signup
