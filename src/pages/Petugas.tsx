import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { officerPriorities } from '../lib/api'
import type { PriorityItem } from '../lib/types'
import { useAuth } from '../context/Auth'
import { useToast } from '../context/Toast'

export default function Petugas() {
  const { profile } = useAuth()
  const [items, setItems] = useState<PriorityItem[]>([])
  const [busy, setBusy] = useState(true)
  const toast = useToast()

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setBusy(false)
      return
    }
    officerPriorities()
      .then(setItems)
      .catch((err) => toast.showToast(err instanceof Error ? err.message : 'Gagal memuat prioritas', 'error'))
      .finally(() => setBusy(false))
  }, [])

  if (profile?.role !== 'petugas' && profile?.role !== 'admin') {
    return (
      <>
        <h1>🛡️ Dashboard Petugas</h1>
        <div className="card">
          <p>Halaman ini khusus petugas dan admin.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Dashboard Petugas 🛡️</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Prioritas verifikasi otomatis — sistem menunjukkan keluarga mana yang
        harus dicek lebih dulu.
      </p>

      <div className="card table-wrap">
        {busy ? (
          <p>Memuat prioritas…</p>
        ) : items.length === 0 ? (
          <p>Belum ada keluarga untuk diverifikasi.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Keluarga</th>
                <th>Welfare</th>
                <th>Confidence</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.household_id}>
                  <td>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {it.household_id.slice(0, 8)}…
                  </td>
                  <td>{it.welfare ?? '-'}</td>
                  <td>{it.confidence ?? '-'}</td>
                  <td style={{ fontSize: 13 }}>
                    {it.alasan}
                    {it.held > 0 && <span className="chip" style={{ marginLeft: 6 }}>HELD ×{it.held}</span>}
                    {it.disputes > 0 && <span className="chip" style={{ marginLeft: 6 }}>laporan ×{it.disputes}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}