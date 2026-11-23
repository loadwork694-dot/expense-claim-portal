import { useEffect, useMemo, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { apiRequest } from '../api.js'

const maxReceiptSize = 5 * 1024 * 1024
const allowedReceiptTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

function localDateValue() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function ClaimsPage({ token, user, mode, refreshVersion, onRefresh, onNotice }) {
  const [claims, setClaims] = useState([])
  const [categories, setCategories] = useState([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(localDateValue)
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [error, setError] = useState('')
  const [loadedRefreshVersion, setLoadedRefreshVersion] = useState(-1)
  const [submitting, setSubmitting] = useState(false)
  const [rejectingClaim, setRejectingClaim] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const loading = mode === 'claims' && loadedRefreshVersion !== refreshVersion

  useEffect(() => () => {
    if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url)
  }, [receiptPreview])

  useEffect(() => {
    let active = true
    apiRequest('/categories', { token })
      .then((result) => {
        if (active) {
          const categoryRows = Array.isArray(result) ? result : []
          setCategories(categoryRows)
          if (categoryRows.length) setCategory(categoryRows[0]._id)
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setCategoriesLoaded(true)
      })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (mode !== 'claims') return undefined
    let active = true
    apiRequest('/claims', { token })
      .then((result) => {
        if (active) setClaims(result || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoadedRefreshVersion(refreshVersion)
      })
    return () => { active = false }
  }, [mode, refreshVersion, token])

  const selectedCategory = useMemo(
    () => categories.find((item) => item._id === category),
    [categories, category]
  )

  const handleReceiptChange = async (event) => {
    const file = event.target.files?.[0]
    setReceipt(null)
    setReceiptPreview(null)
    setError('')
    if (!file) return

    try {
      if (!allowedReceiptTypes.has(file.type)) {
        throw new Error('Choose a JPEG, PNG, WebP image, or PDF receipt.')
      }
      let prepared = file
      if (file.type.startsWith('image/')) {
        prepared = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true
        })
        if (prepared.type !== file.type) {
          const extension = prepared.type === 'image/png' ? 'png' : 'jpg'
          prepared = new File([prepared], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, {
            type: prepared.type
          })
        }
      }
      if (prepared.size >= maxReceiptSize) {
        throw new Error('The receipt must be smaller than 5 MB after compression.')
      }
      setReceipt(prepared)
      if (prepared.type.startsWith('image/')) {
        setReceiptPreview({ file: prepared, url: URL.createObjectURL(prepared) })
      }
    } catch (requestError) {
      setError(requestError.message || 'Unable to prepare this receipt.')
      event.target.value = ''
    }
  }

  const submitClaim = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    onNotice('')
    try {
      if (!receipt) throw new Error('Upload a receipt image or PDF.')
      const formData = new FormData()
      formData.append('receipt', receipt)
      const uploaded = await apiRequest('/claims/receipt', {
        token,
        method: 'POST',
        body: formData
      })
      const result = await apiRequest('/claims', {
        token,
        method: 'POST',
        body: {
          category,
          amount: Number(amount),
          date,
          note,
          receiptUrl: uploaded.url,
          receiptPublicId: uploaded.publicId
        }
      })
      setAmount('')
      setDate(localDateValue())
      setNote('')
      setReceipt(null)
      const fileInput = document.getElementById('claim-receipt')
      if (fileInput) fileInput.value = ''
      onNotice(result.notification?.sent === false
        ? `Claim submitted, but the email alert was not sent: ${result.notification.message}`
        : 'Claim submitted. A status email was sent to you.')
      onRefresh()
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit the claim.')
    } finally {
      setSubmitting(false)
    }
  }

  const transitionClaim = async (claimId, action, comment = '') => {
    setError('')
    onNotice('')
    try {
      const result = await apiRequest(`/claims/${claimId}/transition`, {
        token,
        method: 'POST',
        body: { action, comment, reason: comment }
      })
      if (result.notification?.sent === false) {
        onNotice(`Status updated, but email alert was not sent: ${result.notification.message}`)
      } else {
        onNotice(`Claim status updated to ${result.claim.status}.`)
      }
      onRefresh()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (mode === 'submit') {
    return (
      <section className="portal-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EMPLOYEE CLAIM</p>
            <h2>Submit an expense</h2>
            <p>Photograph your receipt and keep a clear record of the expense.</p>
          </div>
        </div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {categoriesLoaded && !categories.length && !error && (
          <p className="dashboard-warning" role="status">
            No active expense categories are available. Ask an Admin to add or reactivate a category before submitting.
          </p>
        )}
        <form className="claim-form" onSubmit={submitClaim}>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)} required>
              <option value="" disabled>Select a category</option>
              {categories.filter((item) => item.isActive).map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name} · Rs {item.limitPerClaim.toLocaleString()} limit
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount (Rs)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          {selectedCategory && Number(amount) > selectedCategory.limitPerClaim && (
            <p className="limit-warning">
              This is above the {selectedCategory.name} limit of Rs {selectedCategory.limitPerClaim.toLocaleString()}.
              You can still submit it; the reviewer will see the warning.
            </p>
          )}
          <label>
            Expense date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label className="full-field">
            Note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength="500"
              rows="3"
              placeholder="What was this expense for?"
            />
          </label>
          <label className="full-field">
            Receipt photo or PDF (maximum 5 MB)
            <input
              id="claim-receipt"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
              onChange={handleReceiptChange}
              required
            />
          </label>
          {receipt && (
            <div className="receipt-tools full-field">
              <span>{receipt.name} · {(receipt.size / 1024).toFixed(0)} KB</span>
              {receiptPreview?.file === receipt && (
                <img className="receipt-preview" src={receiptPreview.url} alt="Selected receipt preview" />
              )}
            </div>
          )}
          <button
            type="submit"
            className="primary-button full-field"
            disabled={submitting || !categories.length}
          >
            {submitting ? 'Submitting claim…' : 'Submit claim'}
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="portal-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{user.role === 'Employee' ? 'YOUR EXPENSES' : 'REVIEW QUEUE'}</p>
          <h2>{user.role === 'Employee' ? 'My claims' : user.role === 'Manager' ? 'All employee claims' : 'Accounts queue'}</h2>
          <p>
            {user.role === 'Employee'
              ? 'Follow each claim through manager approval, accounts, and payment.'
              : 'Review claims at the stage assigned to your role. Every decision is recorded.'}
          </p>
        </div>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? <p className="empty-state">Loading claims…</p> : claims.length === 0 ? (
        <p className="empty-state">No claims to show yet.</p>
      ) : (
        <div className="claim-list">
          {claims.map((claim) => (
            <ClaimCard
              key={claim._id}
              claim={claim}
              user={user}
              rejecting={rejectingClaim === claim._id}
              rejectReason={rejectReason}
              onRejectReasonChange={setRejectReason}
              onStartReject={() => {
                setRejectingClaim(claim._id)
                setRejectReason('')
              }}
              onCancelReject={() => setRejectingClaim('')}
              onTransition={transitionClaim}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function ClaimCard({
  claim,
  user,
  rejecting,
  rejectReason,
  onRejectReasonChange,
  onStartReject,
  onCancelReject,
  onTransition
}) {
  const employee = claim.employee || {}
  const category = claim.category || {}
  const canManagerReview = user.role === 'Manager' && claim.status === 'Submitted'
  const canAccountsReview = user.role === 'Accounts' && claim.status === 'Manager Approved'
  const canMarkPaid = user.role === 'Accounts' && claim.status === 'Accounts Approved'

  return (
    <article className="claim-card">
      <div className="claim-card-top">
        <div>
          <span className={`status-pill status-${claim.status.toLowerCase().replaceAll(' ', '-')}`}>
            {claim.status}
          </span>
          <h3>{category.name || 'Expense'} · Rs {Number(claim.amount).toLocaleString()}</h3>
          <p>{new Date(claim.date).toLocaleDateString()} · {employee.name || 'Employee'} · {employee.department || claim.department}</p>
        </div>
        {claim.receiptUrl && (
          <a className="receipt-link" href={claim.receiptUrl} target="_blank" rel="noreferrer">
            View receipt
          </a>
        )}
      </div>
      {claim.note && <p className="claim-note">{claim.note}</p>}
      {claim.limitExceeded && (
        <p className="limit-warning">This claim is over the category limit and requires review.</p>
      )}
      {claim.rejectReason && <p className="reject-reason"><strong>Rejection reason:</strong> {claim.rejectReason}</p>}

      {(canManagerReview || canAccountsReview || canMarkPaid) && (
        <div className="claim-actions">
          {canMarkPaid ? (
            <button type="button" className="primary-button" onClick={() => onTransition(claim._id, 'paid')}>
              Mark as paid
            </button>
          ) : (
            <>
              <button
                type="button"
                className="primary-button"
                onClick={() => onTransition(claim._id, 'approve')}
              >
                {user.role === 'Manager' ? 'Approve as manager' : 'Approve for payment'}
              </button>
              {!rejecting ? (
                <button type="button" className="danger-button" onClick={onStartReject}>Reject</button>
              ) : (
                <div className="reject-form">
                  <label>
                    Rejection reason
                    <textarea
                      rows="2"
                      maxLength="500"
                      value={rejectReason}
                      onChange={(event) => onRejectReasonChange(event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={rejectReason.trim().length < 3}
                    onClick={() => {
                      onTransition(claim._id, 'reject', rejectReason.trim())
                      onCancelReject()
                    }}
                  >
                    Confirm rejection
                  </button>
                  <button type="button" className="quiet-button" onClick={onCancelReject}>Cancel</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <details className="claim-history">
        <summary>History ({claim.history?.length || 0} steps)</summary>
        <ol>
          {(claim.history || []).map((entry, index) => (
            <li key={`${entry.action}-${entry.at}-${index}`}>
              <span className="history-action">{entry.action}</span>
              <span>{entry.byName} · {entry.role}</span>
              <time dateTime={entry.at}>{new Date(entry.at).toLocaleString()}</time>
              {entry.comment && <p>{entry.comment}</p>}
            </li>
          ))}
        </ol>
      </details>
    </article>
  )
}

export default ClaimsPage
