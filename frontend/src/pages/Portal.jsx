import { lazy, Suspense, useEffect, useState } from 'react'
import { apiRequest } from '../api.js'
import './Portal.css'

const ClaimsPage = lazy(() => import('../components/ClaimsPage.jsx'))
const DashboardPage = lazy(() => import('../components/DashboardPage.jsx'))
const AdminPage = lazy(() => import('../components/AdminPage.jsx'))
const ReportsPage = lazy(() => import('../components/ReportsPage.jsx'))

const pageByRole = {
  Employee: { dashboard: 'Employee dashboard', submit: 'New claim', claims: 'My claims' },
  Manager: { dashboard: 'Manager dashboard', claims: 'All employee claims' },
  Accounts: { dashboard: 'Accounts dashboard', claims: 'Accounts queue', reports: 'Monthly reports' },
  Admin: { dashboard: 'Admin overview', admin: 'Manage portal', reports: 'Monthly reports' }
}

function Portal({ session, onLogout, onUserUpdate }) {
  const { token, user } = session
  const pages = pageByRole[user.role] || pageByRole.Employee
  const [activePage, setActivePage] = useState(Object.keys(pages)[0])
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [notice, setNotice] = useState('')
  const currentPage = pages[activePage] ? activePage : Object.keys(pages)[0]

  const refresh = () => setRefreshVersion((version) => version + 1)

  useEffect(() => {
    let active = true
    apiRequest('/auth/me', { token })
      .then((profile) => {
        if (active) onUserUpdate(profile)
      })
      .catch((requestError) => {
        if (active) setNotice(requestError.message)
      })
    return () => { active = false }
  }, [onUserUpdate, token])

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <div className="portal-brand">
          <span className="brand-mark" aria-hidden="true">E</span>
          <div>
            <h1>Expense Claim Portal</h1>
            <p>Claims, approvals, and reimbursements in one place</p>
          </div>
        </div>
        <div className="account-summary">
          <span className="role-pill">{user.role}</span>
          <span className="account-name">{user.name}</span>
          <button type="button" className="quiet-button" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <nav className="portal-tabs" aria-label="Portal sections">
        {Object.entries(pages).map(([key, label]) => (
          <button
            type="button"
            className={currentPage === key ? 'portal-tab active' : 'portal-tab'}
            key={key}
            onClick={() => {
              setActivePage(key)
              setNotice('')
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="portal-content">
        {notice && <p className="portal-notice" role="status">{notice}</p>}
        <Suspense fallback={<p className="empty-state">Loading section…</p>}>
          {currentPage === 'dashboard' && (
            <DashboardPage
              token={token}
              user={user}
              refreshVersion={refreshVersion}
              onNavigate={setActivePage}
            />
          )}
          {currentPage === 'claims' && (
            <ClaimsPage
              token={token}
              user={user}
              mode="claims"
              refreshVersion={refreshVersion}
              onRefresh={refresh}
              onNotice={setNotice}
            />
          )}
          {currentPage === 'submit' && (
            <ClaimsPage
              token={token}
              user={user}
              mode="submit"
              refreshVersion={refreshVersion}
              onRefresh={refresh}
              onNotice={setNotice}
            />
          )}
          {currentPage === 'admin' && (
            <AdminPage token={token} refreshVersion={refreshVersion} onNotice={setNotice} />
          )}
          {currentPage === 'reports' && (
            <ReportsPage token={token} refreshVersion={refreshVersion} onNotice={setNotice} />
          )}
        </Suspense>
      </section>
    </main>
  )
}

export default Portal
