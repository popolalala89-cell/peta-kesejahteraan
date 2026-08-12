import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  fieldVerify,
  heldVotes,
  officerPriorities,
  officerReliability,
  reviewDocument,
  reviewHeldVote,
  unreviewedDocuments,
  uploadEvidence,
  type HeldVote,
  type OfficerReliabilityItem,
  type UnreviewedDoc,
} from '../lib/api'
import type { PriorityItem } from '../lib/types'
import { useToast } from '../context/Toast'

interface VerifyTarget {
  householdId: string
  kode: string
}

export default function Petugas() {
  const [prioritas, setPrioritas] = useState<PriorityItem[]>([])
  const [held, setHeld] = useState<HeldVote[]>([])
  const [docs, setDocs] = useState<UnreviewedDoc[]>([])
  const [reliability, setReliability] = useState<OfficerReliabilityItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [target, setTarget] = useState<VerifyTarget | null>(null)
  const [catatan, setCatatan] = useState('')
  const [fotoPath, setFotoPath] = useState<string | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const startedAt = useRef<number>(0)
  const toast = useToast()

  const muat = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const [p, h, d, r] = await Promise.all([
        officerPriorities(),
        heldVotes(),
        unreviewedDocuments(),
        officerReliability().catch(() => null), // admin only — petugas biasa tak melihat
      ])
      setPrioritas(p)
      setHeld(h)
      setDocs(d)
      setReliability(r)
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

  const bukaVerify = (p: PriorityItem) => {
    setTarget({ householdId: p.household_id, kode: `KD-${String(p.household_id).slice(-5).toUpperCase()}` })
    setCatatan('')
    setFotoPath(null)
    setFotoPreview(null)
    startedAt.current = Date.now()
  }

  const tutupVerify = () => {
    setTarget(null)
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(null)
  }

  const onFotoPicked = async (file: File | undefined) => {
    if (!file || !target) return
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
      const path = `${target.householdId}/lapangan_${Date.now()}.${ext}`
      const p = await uploadEvidence(file, path)
      setFotoPath(p)
      toast.showToast('Foto bukti terunggah', 'success')
    } catch (err) {
      setFotoPath(null)
      toast.showToast(err instanceof Error ? err.message : 'Upload gagal', 'error')
    } finally {
      setUploading(false)
    }
  }

  const kirimVerify = async (hasil: boolean) => {
    if (!target) return
    setBusy('verify')
    try {
      const res = await fieldVerify(
        target.householdId,
        hasil,
        catatan.trim() || undefined,
        hasil ? (fotoPath ? [fotoPath] : []) : [],
        new Date(startedAt.current).toISOString(),
      )
      if (res === 'QUORUM_1') {
        toast.showToast('Petugas pertama menyetujui — menunggu petugas ke-2 (quorum)', 'success')
      } else if (res === 'VERIFIED_QUORUM') {
        toast.showToast('Terverifikasi oleh 2 petugas (quorum) ✓', 'success')
      } else if (res === 'VERIFIED') {
        toast.showToast('Terverifikasi ✓ — skor & reputasi diperbarui', 'success')
      } else if (res === 'NEED_REVISION') {
        toast.showToast('Data dikirim ke revisi pemilik', 'success')
      }
      tutupVerify()
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
              background: p.quorum_pending ? 'var(--secondary-container)' : 'var(--surface-container)',
              borderRadius: 12, padding: 12, marginBottom: 10,
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
              {p.quorum_pending && (
                <span className="chip chip-alert">
                  ⏳ Menunggu petugas ke-2{typeof p.verifier1_nama === 'string' ? ` (${p.verifier1_nama})` : ''}
                </span>
              )}
              {p.disputes > 0 && <span className="chip chip-alert">⚖️ {p.disputes} laporan</span>}
              {p.held > 0 && <span className="chip chip-alert">⏸ {p.held} suara ditahan</span>}
              {p.flags > 0 && <span className="chip chip-alert">🚩 {p.flags} flag</span>}
              {p.days_stale > 0 && <span className="chip">⏱ belum dicek {p.days_stale} hari</span>}
              {Number(p.delta) > 0 && <span className="chip">📉 delta {p.delta}</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '6px 0 0' }}>{p.alasan}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                className="btn"
                disabled={busy !== null}
                onClick={() => bukaVerify(p)}
              >
                📸 Verifikasi lapangan
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Keandalan petugas — khusus admin */}
      {reliability !== null && (
        <div className="card">
          <h3>Keandalan petugas ({reliability.length})</h3>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Kesesuaian keputusan lapangan vs konsensus komunitas. Skor rendah + sering
            terlalu cepat = tanda asal validasi.
          </p>
          {reliability.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              Belum ada aktivitas verifikasi lapangan.
            </p>
          )}
          {reliability.map((r) => (
            <div key={r.officer_id} style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <b>{r.nama}</b>
                <span className={r.skor < 70 ? 'chip chip-alert' : 'chip'}>
                  Skor {Number(r.skor).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <span className="chip">✅ {r.setuju_dgn_komunitas}/{r.verifikasi_lapangan} cocok komunitas</span>
                {r.verifikasi_cepat > 0 && (
                  <span className="chip chip-alert">⚡ {r.verifikasi_cepat}x terlalu cepat</span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', margin: '6px 0 0' }}>
                Terakhir {new Date(r.updated_at).toLocaleString('id-ID')}
              </p>
            </div>
          ))}
        </div>
      )}

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

      {/* Modal verifikasi lapangan */}
      {target && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 16,
          }}
          onClick={tutupVerify}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 420, margin: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Verifikasi lapangan — {target.kode}</h3>
            <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
              Setujui wajib lampirkan foto bukti. Kasus sensitif butuh 2 petugas berbeda.
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => void onFotoPicked(e.target.files?.[0])}
            />
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginBottom: 8 }}
              disabled={uploading || busy !== null}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? 'Mengunggah…' : fotoPath ? '📸 Ganti foto bukti' : '📸 Ambil / pilih foto bukti'}
            </button>
            {fotoPreview && (
              <img
                src={fotoPreview}
                alt="Bukti verifikasi"
                style={{ width: '100%', borderRadius: 12, marginBottom: 8, maxHeight: 200, objectFit: 'cover' }}
              />
            )}

            <textarea
              className="input"
              rows={2}
              placeholder="Catatan (opsional) — mis. kondisi rumah, temuan lapangan…"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              style={{ marginBottom: 12, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn"
                disabled={busy !== null || uploading || !fotoPath}
                onClick={() => void kirimVerify(true)}
              >
                ✓ Setujui (wajib foto)
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy !== null || uploading}
                onClick={() => void kirimVerify(false)}
              >
                ✗ Tidak sesuai
              </button>
              <button
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={tutupVerify}
                style={{ marginLeft: 'auto' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
