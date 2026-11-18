import { useCallback, useState } from 'react'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Portal from './pages/Portal.jsx'
import './App.css'

function App() {
  const [session, setSession] = useState(() => {
    try {
      const token = localStorage.getItem('expense-token')
      const user = JSON.parse(localStorage.getItem('expense-user') || 'null')
      if (!token || !user) return null
      if (user.role === 'Accountant') user.role = 'Accounts'
      return { token, user }
    } catch {
      return null
    }
  })

  const handleAuthenticated = (result) => {
    localStorage.setItem('expense-token', result.token)
    localStorage.setItem('expense-user', JSON.stringify(result.user))
    window.history.replaceState(null, '', '/')
    setSession({ token: result.token, user: result.user })
  }

  const handleUserUpdate = useCallback((user) => {
    localStorage.setItem('expense-user', JSON.stringify(user))
    setSession((current) => current ? { ...current, user } : current)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('expense-token')
    localStorage.removeItem('expense-user')
    setSession(null)
    window.history.replaceState(null, '', '/login')
  }

  if (session) {
    return <Portal session={session} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
  }

  return window.location.pathname === '/signup'
    ? <Signup onAuthenticated={handleAuthenticated} />
    : <Login onAuthenticated={handleAuthenticated} />
}

export default App
