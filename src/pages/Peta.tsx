import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { mapAggregate } from '../lib/api'
import { BAND_META, type MapAggregate } from '../lib/types'
import { useToast } from '../context/Toast'

const ORDER = ['sangat_rentan', 'rentan', 'menengah_bawah', 'menengah', 'relatif_mampu'] as const

export default function Peta() {
  const [rt, setRt] = useState('')
  const [rw, setRw] = useState('')
  const [data, setData] = useState<MapAggregate | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const load = async (rtV: string, rwV: string) => {
    if (!isSupabaseConfigured) {
      toast.showToast('Supabase belum dikonfigurasi', 'warning')
      return
    }
    setBusy(true)
    try {
      setData(await mapAggregate(rtV || undefined, rwV || undefined))
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Gagal memuat peta', 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void load('', '')
  }, [])

  const rows = ORDER.map((k) => ({
    key: k,
    ...BAND_META[k],
    jumlah: data?.rincian.find((r) => r.band === k)?.jumlah ?? 0,
  }))

  return (
    <>
      <h1>Peta Kesejahteraan 🗺️</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Agregasi per RT/RW — tanpa nama dan detail pribadi warga.
      </p>

      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="label">RT</label>
          <input className="input" value={rt} onChange={(e) => setRt(e.target.value)} placeholder="contoh: 03" style={{ marginBottom: 0 }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="label">RW</label>
          <input className="input" value={rw} onChange={(e) => setRw(e.target.value)} placeholder="contoh: 02" style={{ marginBottom: 0 }} />
        </div>
        <button className="btn" disabled={busy} onClick={() => void load(rt, rw)}>
          {busy ? 'Memuat…' : 'Tampilkan'}
        </button>
      </div>

      <div className="card">
        <h3>
          {data ? `${data.total} keluarga terpetakan` : 'Belum ada data'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="band-dot" style={{ background: r.warna }} />
              <span style={{ flex: 1 }}>{r.label}</span>
              <span className="chip">{r.jumlah} keluarga</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 12 }}>
          Hanya keluarga berstatus VERIFIED / MONITORING yang ditampilkan.
        </p>
      </div>
    </>
  )
}