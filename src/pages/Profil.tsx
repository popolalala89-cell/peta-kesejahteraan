import { useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { getPublicHousehold } from '../lib/api'
import type { PublicHousehold } from '../lib/types'
import { useToast } from '../context/Toast'

const INDIKATOR_LABEL: Record<string, string> = {
  pendapatan: 'Pendapatan',
  pekerjaan: 'Pekerjaan',
  tanggungan: 'Tanggungan',
  aset: 'Aset',
  hunian: 'Hunian',
  akses_dasar: 'Akses dasar',
}

export default function Profil() {
  const [id, setId] = useState('')
  const [hh, setHh] = useState<PublicHousehold | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const cari = async () => {
    if (!isSupabaseConfigured) {
      toast.showToast('Supabase belum dikonfigurasi', 'warning')
      return
    }
    if (!id.trim()) {
      toast.showToast('Masukkan ID keluarga', 'warning')
      return
    }
    setBusy(true)
    try {
      const data = await getPublicHousehold(id.trim())
      setHh(data)
      if (!data) toast.showToast('Keluarga tidak ditemukan', 'warning')
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Gagal memuat profil', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Profil Publik Keluarga 👤</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Informasi ditampilkan ter-masking — identitas pribadi tidak dipublikasikan.
      </p>

      <div className="card" style={{ display: 'flex', gap: 10 }}>
        <input
          className="input"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="ID keluarga (uuid)"
          style={{ marginBottom: 0 }}
        />
        <button className="btn" disabled={busy} onClick={() => void cari()}>
          Cari
        </button>
      </div>

      {hh && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{hh.kode}</h2>
            {hh.band && (
              <span className="chip" style={{ background: hh.band.warna, color: '#fff' }}>
                {hh.band.label}
              </span>
            )}
          </div>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
            RT {hh.rt ?? '-'} / RW {hh.rw ?? '-'} · Status: {hh.status}
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0 16px' }}>
            <span className="chip chip-primary">Welfare: {hh.welfare_score ?? '-'}</span>
            <span className="chip chip-primary">Confidence: {hh.confidence_score ?? '-'}</span>
            <span className="chip">{hh.eligible_voters} warga berhak verifikasi</span>
          </div>

          <h3>Indikator</h3>
          {Object.entries(hh.indikator).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ flex: 1 }}>{INDIKATOR_LABEL[k] ?? k}</span>
              <div style={{ flex: 2, background: 'var(--surface-container)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
                <div style={{ width: `${v}%`, background: 'var(--primary)', height: '100%' }} />
              </div>
              <span style={{ width: 36, textAlign: 'right', fontSize: 13 }}>{v}</span>
            </div>
          ))}

          <h3 style={{ marginTop: 16 }}>Verifikasi komunitas</h3>
          <p style={{ margin: 0 }}>
            {hh.verifikasi.total} verifier · 🟢 {hh.verifikasi.sesuai} sesuai ·
            🟡 {hh.verifikasi.sebagian} sebagian · 🔴 {hh.verifikasi.tidak} tidak
          </p>
        </div>
      )}
    </>
  )
}