import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api.js'

const roles = ['Employee', 'Manager', 'Accounts', 'Admin']

function AdminPage({ token, refreshVersion, onNotice }) {
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [passwordResets, setPasswordResets] = useState({})
  const [newCategory, setNewCategory] = useState({ name: '', limitPerClaim: '' })
  const activeManager = users.find((user) => user.role === 'Manager' && user.isActive)

  const loadAdminData = useCallback(async () => {
    const [userRows, categoryRows] = await Promise.all([
      apiRequest('/admin/users', { token }),
      apiRequest('/categories', { token })
    ])
    setUsers(userRows)
    setCategories(categoryRows)
  }, [token])

  useEffect(() => {
    let active = true
    Promise.all([
      apiRequest('/admin/users', { token }),
      apiRequest('/categories', { token })
    ]).then(([userRows, categoryRows]) => {
      if (active) {
        setUsers(userRows)
        setCategories(categoryRows)
      }
    }).catch((requestError) => {
      if (active) setError(requestError.message)
    })
    return () => { active = false }
  }, [token, refreshVersion])

  const createCategory = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiRequest('/categories', {
        token,
        method: 'POST',
        body: { name: newCategory.name, limitPerClaim: Number(newCategory.limitPerClaim) }
      })
      setNewCategory({ name: '', limitPerClaim: '' })
      await loadAdminData()
      onNotice('Category added.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const updateCategory = async (category) => {
    setError('')
    try {
      await apiRequest(`/categories/${category._id}`, {
        token,
        method: 'PATCH',
        body: {
          name: category.name,
          limitPerClaim: Number(category.limitPerClaim),
          isActive: category.isActive
        }
      })
      await loadAdminData()
      onNotice('Category updated.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const deactivateCategory = async (category) => {
    setError('')
    try {
      await apiRequest(`/categories/${category._id}`, { token, method: 'DELETE' })
      await loadAdminData()
      onNotice(`${category.name} deactivated.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const reactivateCategory = async (category) => {
    setError('')
    try {
      await apiRequest(`/categories/${category._id}`, {
        token,
        method: 'PATCH',
        body: { isActive: true }
      })
      await loadAdminData()
      onNotice(`${category.name} reactivated.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const updateUser = async (user) => {
    setError('')
    try {
      const role = user.role === 'Accountant' ? 'Accounts' : user.role
      await apiRequest(`/admin/users/${user._id}`, {
        token,
        method: 'PATCH',
        body: {
          role,
          department: user.department,
          isActive: user.isActive,
          ...(passwordResets[user._id] ? { password: passwordResets[user._id] } : {})
        }
      })
      setPasswordResets((current) => ({ ...current, [user._id]: '' }))
      await loadAdminData()
      onNotice(role !== user.role
        ? `${user.name}'s role was updated to ${role}. Ask them to sign in again to open the new dashboard.`
        : `${user.name} updated.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const deleteUser = async (user) => {
    const confirmed = window.confirm(`Delete ${user.name}? This will remove their portal account and any employee claims tied to it.`)
    if (!confirmed) return

    setError('')
    try {
      await apiRequest(`/admin/users/${user._id}`, {
        token,
        method: 'DELETE'
      })
      await loadAdminData()
      onNotice(`${user.name} was deleted.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const approveRoleRequest = async (user) => {
    setError('')
    try {
      const result = await apiRequest(`/admin/users/${user._id}/approve-role`, {
        token,
        method: 'POST'
      })
      await loadAdminData()
      onNotice(result.notification?.sent === false
        ? `${user.name}'s ${user.requestedRole} request was approved, but the email was not sent: ${result.notification.message}`
        : `${user.name}'s ${user.requestedRole} role request was approved and an email was sent.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const rejectRoleRequest = async (user) => {
    const confirmed = window.confirm(`Reject ${user.name}'s ${user.requestedRole} role request and remove this signup?`)
    if (!confirmed) return

    setError('')
    try {
      const result = await apiRequest(`/admin/users/${user._id}/reject-role`, {
        token,
        method: 'POST'
      })
      await loadAdminData()
      onNotice(result.notification?.sent === false
        ? `${user.name}'s request was rejected, but the email was not sent: ${result.notification.message}`
        : `${user.name}'s request was rejected and an email was sent.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="portal-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Manage people and limits</h2>
          <p>Review signup requests, manage roles, and maintain claim categories.</p>
        </div>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}

      <div className="admin-grid">
        <section className="admin-section">
          <h3>Categories and claim limits</h3>
          <form className="admin-form category-create-form" onSubmit={createCategory}>
            <label>
              Category name
              <input
                value={newCategory.name}
                onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
                minLength="2"
                required
              />
            </label>
            <label>
              Limit per claim (Rs)
              <input
                type="number"
                min="1"
                step="0.01"
                value={newCategory.limitPerClaim}
                onChange={(event) => setNewCategory({ ...newCategory, limitPerClaim: event.target.value })}
                required
              />
            </label>
            <button type="submit" className="primary-button" disabled={saving}>Add category</button>
          </form>
          <div className="admin-list">
            {categories.map((category) => (
              <div className={`category-row${category.isActive ? '' : ' inactive-row'}`} key={category._id}>
                <input
                  aria-label={`${category.name} category name`}
                  value={category.name}
                  onChange={(event) => setCategories(categories.map((item) => (
                    item._id === category._id ? { ...item, name: event.target.value } : item
                  )))}
                />
                <input
                  aria-label={`${category.name} limit`}
                  type="number"
                  min="1"
                  value={category.limitPerClaim}
                  onChange={(event) => setCategories(categories.map((item) => (
                    item._id === category._id ? { ...item, limitPerClaim: event.target.value } : item
                  )))}
                />
                <button type="button" className="secondary-button" onClick={() => updateCategory(category)}>Save</button>
                {category.isActive
                  ? <button type="button" className="quiet-button" onClick={() => deactivateCategory(category)}>Deactivate</button>
                  : <button type="button" className="quiet-button" onClick={() => reactivateCategory(category)}>Reactivate</button>}
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <h3>Users and roles</h3>
          <p className="admin-help">
            Only one active Manager can review all employee claims.
          </p>
          {users.some((user) => user.requestedRole) && (
            <section className="role-requests" aria-labelledby="role-requests-title">
              <h4 id="role-requests-title">Pending role requests</h4>
              <div className="admin-list">
                {users.filter((user) => user.requestedRole).map((user) => (
                  <div className="role-request-row" key={user._id}>
                    <div className="user-row-identity">
                      <strong>{user.name} · {user.requestedRole === 'Accounts' ? 'Accountant' : user.requestedRole}</strong>
                      <span>{user.email}</span>
                    </div>
                    <div className="role-request-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => approveRoleRequest(user)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => rejectRoleRequest(user)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="admin-list user-list">
            {users.filter((user) => !user.requestedRole).map((user) => (
              <div className="user-row" key={user._id}>
                <div className="user-row-identity">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </div>
                <select
                  aria-label={`${user.name} role`}
                  value={user.role === 'Accountant' ? 'Accounts' : user.role}
                  onChange={(event) => setUsers(users.map((item) => (
                    item._id === user._id ? { ...item, role: event.target.value } : item
                  )))}
                >
                  {roles.map((role) => (
                    <option
                      key={role}
                      disabled={role === 'Manager' && activeManager && user._id !== activeManager._id}
                    >
                      {role}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`${user.name} department`}
                  value={user.department || 'General'}
                  onChange={(event) => setUsers(users.map((item) => (
                    item._id === user._id ? { ...item, department: event.target.value } : item
                  )))}
                />
                <input
                  type="password"
                  aria-label={`${user.name} password reset`}
                  autoComplete="new-password"
                  minLength="8"
                  placeholder="Reset password"
                  value={passwordResets[user._id] || ''}
                  onChange={(event) => setPasswordResets({
                    ...passwordResets,
                    [user._id]: event.target.value
                  })}
                />
                <div className="user-actions">
                  <button type="button" className="secondary-button" onClick={() => updateUser(user)}>Save</button>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => updateUser({ ...user, isActive: !user.isActive })}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => deleteUser(user)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

export default AdminPage
