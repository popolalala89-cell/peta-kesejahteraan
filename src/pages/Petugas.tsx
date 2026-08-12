import { useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  fieldVerify,
  heldVotes,
  officerPriorities,
  reviewDocument,
  reviewHeldVote,
  unreviewedDocuments,
  type HeldVote,
  type UnreviewedDoc,
} from '../lib/api'
import type { PriorityItem } from '../lib/types'
import { useToast } from '../context/Toast'

export default function Petugas() {
  const [prioritas, setPrioritas] = useState<PriorityItem[]>([])
  const [held, setHeld] = useState<HeldVote[]>([])
  const [docs, setDocs] = useState<UnreviewedDoc[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const toast = useToast()

  const muat = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const [p, h, d] = await Promise.all([
        officerPriorities(),
        heldVotes(),
        unreviewedDocuments(),
      ])
      setPrioritas(p)
      setHeld(h)
      setDocs(d)
    } catch {
      /* role tidak cocok / belum siap — biarkan kosong */
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const aksi = async (key: string, fn: () => Promise<unknown>, sukses: string) => {
    setBusy(key)
    try {
      await fn()
      toast.showToast(sukses, 'success')
      await muat()
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Gagal', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <h1>Dashboard Petugas 🛡️</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Urutan otomatis: yang paling butuh dicek dulu — bukan semuanya sekaligus.
      </p>

      {/* Prioritas */}
      <div className="card">
        <h3>Prioritas verifikasi ({prioritas.length})</h3>
        {prioritas.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Belum ada keluarga yang masuk antrean prioritas.
          </p>
        )}
        {prioritas.map((p) => (
          <div
            key={p.household_id}
            style={{
              background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <b>KD-{String(p.household_id).slice(-5).toUpperCase()}</b>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="chip">Welfare {p.welfare ?? '-'}</span>
                <span className="chip">Confidence {p.confidence ?? '-'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {p.disputes > 0 && <span className="chip chip-alert">⚖️ {p.disputes} laporan</span>}
              {p.held > 0 && <span className="chip chip-alert">⏸ {p.held} suara ditahan</span>}
              {p.flags > 0 && <span className="chip chip-alert">🚩 {p.flags} flag</span>}
              {p.days_stale > 0 && <span className="chip">⏱ belum dicek {p.days_stale} hari</span>}
              {Number(p.delta) > 0 && <span className="chip">📉 delta {p.delta}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                className="btn"
                disabled={busy !== null}
                onClick={() => void aksi(
                  `fv-${p.household_id}`,
                  () => fieldVerify(p.household_id, true, 'verifikasi lapangan ok'),
                  'Verifikasi lapangan selesai — skor & reputasi diperbarui',
                )}
              >
                ✓ Verifikasi lapangan
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => void aksi(
                  `fvn-${p.household_id}`,
                  () => fieldVerify(p.household_id, false, 'data tidak sesuai'),
                  'Ditandai tidak sesuai',
                )}
              >
                ✗ Tidak sesuai
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Suara ditahan */}
      <div className="card">
        <h3>Suara ditahan ({held.length})</h3>
        {held.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Tidak ada suara yang ditahan sistem.
          </p>
        )}
        {held.map((v) => (
          <div key={v.id} style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <b>{v.kode}</b>
              <span className="chip chip-alert">{v.alasan || 'SUSPICIOUS_VOTE'}</span>
            </div>
            <p style={{ fontSize: 13, margin: '6px 0' }}>
              {v.verifier_nama} · {v.tipe} · <b>{v.jawaban}</b> ·{' '}
              {v.pertanyaan}
              {v.komentar ? ` — "${v.komentar}"` : ''}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                disabled={busy !== null}
                onClick={() => void aksi(
                  `hv-${v.id}`, () => reviewHeldVote(v.id, 'ACTIVE'),
                  'Suara diaktifkan',
                )}
              >
                ✓ Sahkan suara
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => void aksi(
                  `hd-${v.id}`, () => reviewHeldVote(v.id, 'DISCARDED'),
                  'Suara dibuang',
                )}
              >
                ✗ Buang
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Dokumen menunggu */}
      <div className="card">
        <h3>Dokumen menunggu validasi ({docs.length})</h3>
        {docs.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Tidak ada dokumen yang menunggu.
          </p>
        )}
        {docs.map((d) => (
          <div key={d.id} style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <b>{d.kode}</b>
              <span className="chip">{d.jenis.replaceAll('_', ' ')}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)', margin: '6px 0' }}>
              Diunggah {new Date(d.uploaded_at).toLocaleString('id-ID')}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                disabled={busy !== null}
                onClick={() => void aksi(
                  `dv-${d.id}`, () => reviewDocument(d.id, 'VERIFIED'),
                  'Dokumen disahkan',
                )}
              >
                ✓ Sahkan
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => void aksi(
                  `dr-${d.id}`, () => reviewDocument(d.id, 'REJECTED'),
                  'Dokumen ditolak',
                )}
              >
                ✗ Tolak
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}