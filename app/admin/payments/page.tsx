'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { StatCards } from './_components/stat-cards'
import { ReferenceLookup } from './_components/reference-lookup'
import { PaymentsTable } from './_components/payments-table'
import { PaystackReconcile } from './_components/paystack-reconcile'
import { toast } from 'sonner'
import type { StatsResponse, PendingRow, PaymentSource } from './types'

const SOURCES: { key: PaymentSource | 'all'; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'main', label: 'Main' },
  { key: 'shop', label: 'Shop' }, { key: 'results_checker', label: 'Results checker' },
]
const RANGES = [ { key: 'today', label: 'Today' }, { key: '7d', label: 'Last 7 days' }, { key: '30d', label: 'Last 30 days' }, { key: 'all', label: 'All' } ]

export default function AdminPaymentsPage() {
  const [range, setRange] = useState('today')
  const [source, setSource] = useState<PaymentSource | 'all'>('all')
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [rows, setRows] = useState<PendingRow[]>([])
  const [loadingRows, setLoadingRows] = useState(true)
  const [q, setQ] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const statsSeq = useRef(0)
  const rowsSeq = useRef(0)

  const loadStats = useCallback(async () => {
    const seq = ++statsSeq.current
    try {
      const res = await fetch(`/api/admin/payments/stats?range=${range}`)
      const json = await res.json()
      if (seq !== statsSeq.current) return
      if (json.success) setStats(json.data)
      else setLoadFailed(true)
    } catch { if (seq === statsSeq.current) setLoadFailed(true) }
  }, [range])

  const loadRows = useCallback(async () => {
    const seq = ++rowsSeq.current
    setLoadingRows(true)
    try {
      const res = await fetch(`/api/admin/payments/pending?source=${source}&q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (seq !== rowsSeq.current) return
      if (json.success) { setRows(json.data); setLoadFailed(false) }
      else setLoadFailed(true)
    } catch { if (seq === rowsSeq.current) setLoadFailed(true) }
    finally { if (seq === rowsSeq.current) setLoadingRows(false) }
  }, [source, q])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { const t = setTimeout(loadRows, 250); return () => clearTimeout(t) }, [loadRows])

  const refreshAll = useCallback(() => { loadStats(); loadRows() }, [loadStats, loadRows])

  const [running, setRunning] = useState(false)
  const runCheck = useCallback(async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/admin/payments/run-check', { method: 'POST' })
      const json = await res.json()
      if (json.success) {
        const d = json.data
        toast.success(`Checked ${d.processed}: ${d.verified} settled, ${d.failed} failed, ${d.agedOut} too old, ${d.stillPending} still pending`)
        refreshAll()
      } else {
        toast.error(json.error || 'The check did not run. Try again.')
      }
    } catch {
      toast.error('Could not reach the server. Try again.')
    } finally {
      setRunning(false)
    }
  }, [refreshAll])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Payments</h1>
          <p className="text-muted-foreground text-sm">Find Paystack payments that are stuck and settle them here.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                type="button" aria-pressed={range === r.key}
                className={`text-xs px-3 py-2 rounded-full border ${range === r.key ? 'clay-black border-transparent' : 'neu-raised-sm border-transparent'}`}>{r.label}</button>
            ))}
          </div>
          <button onClick={runCheck} disabled={running}
            className="clay-silver text-xs px-4 py-2 rounded-full disabled:opacity-50">
            {running ? 'Checking…' : 'Check pending payments'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap">
        {SOURCES.map(s => (
          <button key={s.key} onClick={() => setSource(s.key)}
            type="button" aria-pressed={source === s.key}
            className={`text-xs px-3 py-2 rounded-full border ${source === s.key ? 'clay-black border-transparent' : 'neu-raised-sm border-transparent'}`}>{s.label}</button>
        ))}
      </div>

      {loadFailed && (
        <div role="alert" className="neu-raised-sm rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Could not load the payments. The numbers and list below may be out of date.</p>
          <button type="button" onClick={refreshAll} className="clay-silver text-xs px-4 py-2 rounded-full">Try again</button>
        </div>
      )}

      <StatCards stats={stats} source={source} />
      <ReferenceLookup onResolved={refreshAll} />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending payments</TabsTrigger>
          <TabsTrigger value="reconcile">Paystack check</TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-3 space-y-3">
              <Input aria-label="Search payments" placeholder="Search by reference, phone or email…" value={q} onChange={e => setQ(e.target.value)} className="md:w-96" />
              <PaymentsTable rows={rows} loading={loadingRows} onChanged={refreshAll} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reconcile">
          <Card><CardContent className="p-3"><PaystackReconcile /></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
