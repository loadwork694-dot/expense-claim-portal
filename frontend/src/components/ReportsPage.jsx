import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { apiRequest, downloadRequest } from '../api.js'

const colors = ['#27c998', '#49a6f5', '#efa74b', '#a88cf5', '#ed7c88', '#6cc5ce']
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const tooltipContentStyle = {
  backgroundColor: '#0b1c15',
  border: '1px solid #315343',
  borderRadius: '10px',
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
  color: '#eff8f3'
}
const tooltipLabelStyle = { color: '#eff8f3', fontWeight: 700, marginBottom: '4px' }
const tooltipItemStyle = { color: '#b8cbc1' }
const axisTickStyle = { fill: '#91a89b', fontSize: 11 }
const legendStyle = { color: '#b8cbc1', fontSize: 12 }
const currentMonth = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function ReportsPage({ token, refreshVersion, onNotice }) {
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loadedMonth, setLoadedMonth] = useState('')
  const loading = loadedMonth !== month

  useEffect(() => {
    let active = true
    apiRequest(`/reports/monthly?month=${month}`, { token })
      .then((result) => {
        if (active) {
          setReport(result)
          setError('')
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoadedMonth(month)
      })
    return () => { active = false }
  }, [month, refreshVersion, token])

  const exportWorkbook = async () => {
    if (!report) return
    try {
      const file = await downloadRequest(`/reports/monthly.xlsx?month=${month}`, token)
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = `expense-report-${report.month}.xlsx`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      onNotice('Excel report downloaded.')
    } catch (exportError) {
      setError(exportError.message || 'Unable to export the report.')
    }
  }

  return (
    <section className="portal-panel">
      <div className="section-heading report-heading">
        <div>
          <p className="eyebrow">REPORTING</p>
          <h2>Monthly expense summary</h2>
          <p>Review claims by category, employee, and department, then export to Excel.</p>
        </div>
        <div className="report-controls">
          <label>
            Report month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button type="button" className="primary-button" onClick={exportWorkbook} disabled={!report}>
            Export Excel
          </button>
        </div>
      </div>
      {!loading && error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? <p className="empty-state">Preparing report…</p> : report && (
        <>
          <div className="summary-cards">
            <SummaryCard label="Claims this month" value={report.claimCount} />
            <SummaryCard label="Total claimed" value={money(report.totalAmount)} />
            <SummaryCard label="Paid" value={money(report.paidAmount)} />
          </div>
          {report.claimCount === 0 ? (
            <p className="empty-state">No claims were submitted in this month.</p>
          ) : (
            <div className="report-chart-grid">
              <ChartPanel title="Spend by category">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={report.byCategory}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={94}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      stroke="#0e241a"
                      strokeWidth={2}
                    >
                      {report.byCategory.map((entry, index) => (
                        <Cell key={entry.name} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => money(value)}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                    />
                    <Legend wrapperStyle={legendStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>
              <ChartPanel title="Spend by department">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={report.byDepartment} margin={{ top: 8, right: 12, bottom: 20, left: 8 }}>
                    <CartesianGrid stroke="#294738" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-18}
                      textAnchor="end"
                      interval={0}
                      height={48}
                      tick={axisTickStyle}
                      axisLine={{ stroke: '#294738' }}
                      tickLine={{ stroke: '#294738' }}
                    />
                    <YAxis
                      tick={axisTickStyle}
                      axisLine={{ stroke: '#294738' }}
                      tickLine={{ stroke: '#294738' }}
                    />
                    <Tooltip
                      formatter={(value) => money(value)}
                      contentStyle={tooltipContentStyle}
                      labelStyle={tooltipLabelStyle}
                      itemStyle={tooltipItemStyle}
                      cursor={{ fill: '#183a2d', opacity: 0.42 }}
                    />
                    <Legend wrapperStyle={legendStyle} />
                    <Bar dataKey="amount" name="Claimed" fill="#a88cf5" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="paidAmount" name="Paid" fill="#49a6f5" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function SummaryCard({ label, value }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function ChartPanel({ title, children }) {
  return (
    <section className="chart-panel">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default ReportsPage
