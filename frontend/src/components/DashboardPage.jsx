import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api.js'

const terminalStatuses = new Set(['Paid', 'Rejected'])

function formatAmount(value) {
  return `Rs ${Number(value || 0).toLocaleString()}`
}

function getClaimLabel(claim) {
  return `${claim.category?.name || 'Expense'} · ${formatAmount(claim.amount)}`
}

function DashboardPage({ token, user, refreshVersion, onNavigate }) {
  const [claims, setClaims] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const requests = [apiRequest('/claims', { token })]
    if (user.role === 'Admin') {
      requests.push(apiRequest('/admin/users', { token }), apiRequest('/categories', { token }))
    }

    Promise.all(requests)
      .then(([claimRows, userRows = [], categoryRows = []]) => {
        if (!active) return
        setClaims(claimRows)
        setUsers(userRows)
        setCategories(categoryRows)
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [refreshVersion, token, user.role])

  const counts = useMemo(() => claims.reduce((result, claim) => {
    result.total += 1
    result.amount += Number(claim.amount || 0)
    result[claim.status] = (result[claim.status] || 0) + 1
    return result
  }, { total: 0, amount: 0 }), [claims])

  if (loading) return <p className="empty-state">Loading your dashboard…</p>

  const role = ['Employee', 'Manager', 'Accounts', 'Admin'].includes(user.role)
    ? user.role
    : 'Employee'

  return (
    <section className={`dashboard-page dashboard-${role.toLowerCase()}`}>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {role === 'Employee' && (
        <EmployeeDashboard
          user={user}
          claims={claims}
          counts={counts}
          onNavigate={onNavigate}
        />
      )}
      {role === 'Manager' && (
        <ManagerDashboard claims={claims} counts={counts} onNavigate={onNavigate} />
      )}
      {role === 'Accounts' && (
        <AccountsDashboard claims={claims} counts={counts} onNavigate={onNavigate} />
      )}
      {role === 'Admin' && (
        <AdminDashboard
          claims={claims}
          counts={counts}
          users={users}
          categories={categories}
          onNavigate={onNavigate}
        />
      )}
    </section>
  )
}

function DashboardHero({ role, title, description, children }) {
  return (
    <header className="dashboard-hero">
      <div>
        <p className="eyebrow">{role.toUpperCase()} WORKSPACE</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="dashboard-actions">{children}</div>
    </header>
  )
}

function StatCards({ items }) {
  return (
    <div className="dashboard-stats">
      {items.map((item) => (
        <article className="dashboard-stat" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </article>
      ))}
    </div>
  )
}

function ClaimPreview({ claims, emptyMessage }) {
  if (!claims.length) return <p className="dashboard-empty">{emptyMessage}</p>

  return (
    <ul className="dashboard-claim-list">
      {claims.map((claim) => (
        <li key={claim._id}>
          <div>
            <strong>{getClaimLabel(claim)}</strong>
            <span>
              {claim.employee?.name ? `${claim.employee.name} · ` : ''}
              {new Date(claim.date).toLocaleDateString()}
            </span>
          </div>
          <span className={`status-pill status-${claim.status.toLowerCase().replaceAll(' ', '-')}`}>
            {claim.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

function EmployeeDashboard({ user, claims, counts, onNavigate }) {
  const activeClaims = claims.filter((claim) => !terminalStatuses.has(claim.status))
  const recentClaims = claims.slice(0, 4)

  return (
    <>
      <DashboardHero
        role="Employee"
        title={`Welcome, ${user.name}`}
        description="Submit a work expense and follow its approval and payment status."
      >
        <button type="button" className="primary-button" onClick={() => onNavigate('submit')}>
          Submit a claim
        </button>
        <button type="button" className="secondary-button" onClick={() => onNavigate('claims')}>
          View my claims
        </button>
      </DashboardHero>
      <StatCards items={[
        { label: 'All my claims', value: counts.total },
        { label: 'In approval', value: activeClaims.length },
        { label: 'Paid', value: counts.Paid || 0 },
        { label: 'Total claimed', value: formatAmount(counts.amount) }
      ]} />
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <h3>Recent claims</h3>
            <p>Your latest expenses and their current status.</p>
          </div>
          <button type="button" className="quiet-button" onClick={() => onNavigate('claims')}>All claims</button>
        </div>
        <ClaimPreview claims={recentClaims} emptyMessage="You haven't submitted a claim yet." />
      </section>
    </>
  )
}

function ManagerDashboard({ claims, counts, onNavigate }) {
  const awaitingReview = claims.filter((claim) => claim.status === 'Submitted')
  const recentReview = awaitingReview.slice(0, 4)

  return (
    <>
      <DashboardHero
        role="Manager"
        title="All employee claims"
        description="Review every employee claim. Approve valid claims or reject them with a reason."
      >
        <button type="button" className="primary-button" onClick={() => onNavigate('claims')}>
          Open approval queue
        </button>
      </DashboardHero>
      <StatCards items={[
        { label: 'Awaiting your review', value: awaitingReview.length },
        { label: 'Approved by you', value: counts['Manager Approved'] || 0 },
        { label: 'Rejected', value: counts.Rejected || 0 },
        { label: 'All employee claims', value: counts.total }
      ]} />
      <section className="dashboard-section">
        <div className="dashboard-section-heading">
          <div>
            <h3>Needs your decision</h3>
            <p>All submitted employee claims appear here.</p>
          </div>
        </div>
        <ClaimPreview claims={recentReview} emptyMessage="No claims are waiting for your review." />
      </section>
    </>
  )
}

function AccountsDashboard({ claims, counts, onNavigate }) {
  const awaitingApproval = claims.filter((claim) => claim.status === 'Manager Approved')
  const awaitingPayment = claims.filter((claim) => claim.status === 'Accounts Approved')
  const paidThisQueue = claims.filter((claim) => claim.status === 'Paid')

  return (
    <>
      <DashboardHero
        role="Accounts"
        title="Accounts and payments"
        description="Complete the final accounts review, then mark approved claims as paid."
      >
        <button type="button" className="primary-button" onClick={() => onNavigate('claims')}>
          Open accounts queue
        </button>
      </DashboardHero>
      <StatCards items={[
        { label: 'Awaiting accounts approval', value: awaitingApproval.length },
        { label: 'Ready to mark paid', value: awaitingPayment.length },
        { label: 'Paid claims', value: paidThisQueue.length },
        { label: 'Total claims', value: counts.total }
      ]} />
      <div className="dashboard-two-column">
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <h3>Final approval needed</h3>
              <p>Manager-approved claims waiting for Accounts.</p>
            </div>
          </div>
          <ClaimPreview claims={awaitingApproval.slice(0, 3)} emptyMessage="No claims need final approval." />
        </section>
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <h3>Ready for payment</h3>
              <p>Mark these accounts-approved claims as paid.</p>
            </div>
          </div>
          <ClaimPreview claims={awaitingPayment.slice(0, 3)} emptyMessage="No approved claims are waiting for payment." />
        </section>
      </div>
    </>
  )
}

function AdminDashboard({ claims, counts, users, categories, onNavigate }) {
  const roleCounts = users.reduce((result, user) => {
    const role = user.role === 'Accountant' ? 'Accounts' : user.role
    result[role] = (result[role] || 0) + 1
    return result
  }, {})
  const openClaims = claims.filter((claim) => !terminalStatuses.has(claim.status))

  return (
    <>
      <DashboardHero
        role="Admin"
        title="Portal overview"
        description="Monitor users, claim activity, and category setup across the organization."
      >
        <button type="button" className="primary-button" onClick={() => onNavigate('admin')}>
          Manage users and categories
        </button>
        <button type="button" className="secondary-button" onClick={() => onNavigate('reports')}>
          View monthly reports
        </button>
      </DashboardHero>
      <StatCards items={[
        { label: 'Users', value: users.length },
        { label: 'Active categories', value: categories.filter((category) => category.isActive).length },
        { label: 'Open claims', value: openClaims.length },
        { label: 'All claims', value: counts.total }
      ]} />
      <div className="dashboard-two-column">
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <h3>Users by role</h3>
              <p>Accounts currently registered in the portal.</p>
            </div>
          </div>
          <ul className="dashboard-role-list">
            {['Employee', 'Manager', 'Accounts', 'Admin'].map((role) => (
              <li key={role}><span>{role}</span><strong>{roleCounts[role] || 0}</strong></li>
            ))}
          </ul>
        </section>
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <h3>Claims by stage</h3>
              <p>Current approval and payment progress.</p>
            </div>
          </div>
          <ul className="dashboard-role-list">
            {['Submitted', 'Manager Approved', 'Accounts Approved', 'Paid', 'Rejected'].map((status) => (
              <li key={status}><span>{status}</span><strong>{counts[status] || 0}</strong></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

export default DashboardPage
