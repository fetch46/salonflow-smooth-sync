import { useMemo, useState } from 'react'
import '../receipts.css'

export type ReceiptStatus = 'Paid' | 'Pending' | 'Refunded'

export interface ReceiptRecord {
  id: string
  receiptNumber: string
  customerName: string
  dateIso: string
  amountCents: number
  paymentMethod: 'Card' | 'Cash' | 'Bank Transfer' | 'PayPal'
  status: ReceiptStatus
}

const demoReceipts: ReceiptRecord[] = [
  { id: '1', receiptNumber: 'SR-1001', customerName: 'Acme Corp', dateIso: '2025-07-01', amountCents: 129900, paymentMethod: 'Card', status: 'Paid' },
  { id: '2', receiptNumber: 'SR-1002', customerName: 'Globex Ltd', dateIso: '2025-07-02', amountCents: 45900, paymentMethod: 'PayPal', status: 'Paid' },
  { id: '3', receiptNumber: 'SR-1003', customerName: 'Initech', dateIso: '2025-07-02', amountCents: 9900, paymentMethod: 'Cash', status: 'Refunded' },
  { id: '4', receiptNumber: 'SR-1004', customerName: 'Umbrella Co', dateIso: '2025-07-03', amountCents: 229900, paymentMethod: 'Bank Transfer', status: 'Pending' },
  { id: '5', receiptNumber: 'SR-1005', customerName: 'Stark Industries', dateIso: '2025-07-03', amountCents: 89900, paymentMethod: 'Card', status: 'Paid' },
  { id: '6', receiptNumber: 'SR-1006', customerName: 'Wayne Enterprises', dateIso: '2025-07-04', amountCents: 12900, paymentMethod: 'Card', status: 'Paid' },
  { id: '7', receiptNumber: 'SR-1007', customerName: 'Wonka LLC', dateIso: '2025-07-04', amountCents: 56900, paymentMethod: 'Cash', status: 'Pending' },
  { id: '8', receiptNumber: 'SR-1008', customerName: 'Black Mesa', dateIso: '2025-07-05', amountCents: 34900, paymentMethod: 'Card', status: 'Paid' },
  { id: '9', receiptNumber: 'SR-1009', customerName: 'Aperture Labs', dateIso: '2025-07-05', amountCents: 64900, paymentMethod: 'PayPal', status: 'Paid' },
  { id: '10', receiptNumber: 'SR-1010', customerName: 'Hooli', dateIso: '2025-07-06', amountCents: 21900, paymentMethod: 'Card', status: 'Refunded' },
  { id: '11', receiptNumber: 'SR-1011', customerName: 'Vandelay Industries', dateIso: '2025-07-06', amountCents: 149900, paymentMethod: 'Bank Transfer', status: 'Paid' },
  { id: '12', receiptNumber: 'SR-1012', customerName: 'Pied Piper', dateIso: '2025-07-06', amountCents: 49900, paymentMethod: 'Card', status: 'Pending' }
]

function formatCurrencyFromCents(amountCents: number, locale = navigator.language, currency = 'USD'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountCents / 100)
}

export default function SalesReceiptList() {
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<ReceiptStatus[] | null>(null) // null = All

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase()
    const from = fromDate ? new Date(fromDate) : null
    const to = toDate ? new Date(toDate) : null

    return demoReceipts.filter(r => {
      if (activeStatuses && activeStatuses.length > 0 && !activeStatuses.includes(r.status)) return false
      if (searchLower) {
        const target = `${r.receiptNumber} ${r.customerName}`.toLowerCase()
        if (!target.includes(searchLower)) return false
      }
      if (from && new Date(r.dateIso) < from) return false
      if (to && new Date(r.dateIso) > to) return false
      return true
    })
  }, [search, fromDate, toDate, activeStatuses])

  const stats = useMemo(() => {
    const total = filtered.length
    const revenueCents = filtered.filter(r => r.status === 'Paid').reduce((sum, r) => sum + r.amountCents, 0)
    const averageCents = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.amountCents, 0) / filtered.length) : 0
    const paidRate = filtered.length ? Math.round((filtered.filter(r => r.status === 'Paid').length / filtered.length) * 100) : 0
    return { total, revenueCents, averageCents, paidRate }
  }, [filtered])

  function toggleStatus(status: ReceiptStatus) {
    setActiveStatuses(prev => {
      if (!prev) return [status]
      if (prev.includes(status)) {
        const next = prev.filter(s => s !== status)
        return next.length ? next : null
      }
      return [...prev, status]
    })
  }

  function clearFilters() {
    setSearch('')
    setFromDate('')
    setToDate('')
    setActiveStatuses(null)
  }

  return (
    <main className="sr-page">
      <header className="sr-header">
        <div className="sr-header__content">
          <div>
            <h1>Sales Receipts</h1>
            <p className="sr-subtitle">Track, filter, and export your sales receipts at a glance.</p>
          </div>
          <div className="sr-actions">
            <button className="btn btn-primary">New Receipt</button>
            <button className="btn btn-ghost">Export</button>
          </div>
        </div>
      </header>

      <section className="sr-filters">
        <div className="sr-filters__row">
          <div className="input-group">
            <input
              type="search"
              placeholder="Search by receipt # or customer..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search receipts"
            />
          </div>
          <div className="date-group">
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} aria-label="From date" />
            <span className="date-sep">to</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} aria-label="To date" />
          </div>
          <div className="status-chips" role="group" aria-label="Filter by status">
            {(['Paid','Pending','Refunded'] as ReceiptStatus[]).map(s => (
              <button key={s} className={"chip " + (activeStatuses?.includes(s) ? 'chip-active' : '')} onClick={() => toggleStatus(s)}>
                <span className={`status-dot ${s.toLowerCase()}`}></span>
                {s}
              </button>
            ))}
          </div>
          <div className="filters-end">
            <button className="btn btn-ghost" onClick={clearFilters}>Clear</button>
          </div>
        </div>
      </section>

      <section className="sr-stats">
        <div className="stats-grid">
          <article className="stat-card">
            <div className="stat-label">Total Receipts</div>
            <div className="stat-value">{stats.total}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Revenue</div>
            <div className="stat-value">{formatCurrencyFromCents(stats.revenueCents)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Avg. Order Value</div>
            <div className="stat-value">{formatCurrencyFromCents(stats.averageCents)}</div>
          </article>
          <article className="stat-card">
            <div className="stat-label">Paid Rate</div>
            <div className="stat-value">{stats.paidRate}%</div>
          </article>
        </div>
      </section>

      <section className="sr-table-wrap">
        <div className="table-scroll">
          <table className="sr-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="num">Amount</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="mono">{r.receiptNumber}</td>
                  <td>{r.customerName}</td>
                  <td>{new Date(r.dateIso).toLocaleDateString()}</td>
                  <td className="num mono">{formatCurrencyFromCents(r.amountCents)}</td>
                  <td>{r.paymentMethod}</td>
                  <td>
                    <span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-small">View</button>
                    <button className="btn btn-small btn-ghost">Refund</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}