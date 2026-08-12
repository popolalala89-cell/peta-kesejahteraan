import { useEffect, useState } from 'react'
import { useAuth } from '../context/Auth'
import { useToast } from '../context/Toast'
import {
  getConfigValue,
  nearbyHouseholds,
  submitVerification,
  type NearbyHousehold,
} from '../lib/api'

interface Question {
  key: string
  tipe: string[]
  label: string
  opsi: string[]
}

const PESAN_ERROR: Record<string, string> = {
  SELF_VOTE: 'Anda tidak bisa memverifikasi keluarga sendiri',
  OUT_OF_RANGE: 'Terlalu jauh dari lokasi keluarga ini (maks 2 km)',
  VERIFIER_NOT_VERIFIED: 'Akun belum disetujui petugas — belum bisa ikut verifikasi',
  LOCATION_REQUIRED: 'Lokasi wajib terdeteksi — izinkan akses lokasi',
  LOCATION_MISSING: 'Lokasi tidak terdeteksi — coba lagi',
  HOUSEHOLD_LOCATION_MISSING: 'Keluarga ini belum punya titik lokasi',
  HOUSEHOLD_NOT_OPEN: 'Keluarga ini sedang tidak terbuka untuk verifikasi',
  PROFILE_NOT_FOUND: 'Profil belum lengkap — hubungi admin',
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Menunggu verifikasi',
  COMMUNITY_VERIFICATION: 'Verifikasi komunitas',
  DOCUMENT_VERIFICATION: 'Verifikasi dokumen',
  FIELD_VERIFICATION: 'Verifikasi lapangan',
  VERIFIED: 'Terverifikasi',
  MONITORING: 'Pemantauan',
  NEED_REVISION: 'Perlu revisi',
  REJECTED: 'Ditolak',
}

export default function Verifikasi() {
  const { profile } = useAuth()
  const toast = useToast()

  const [gps, setGps] = useState<{ lat: number | null; lon: number | null; status: string }>({
    lat: null, lon: null, status: 'meminta',
  })
  const [list, setList] = useState<NearbyHousehold[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [selected, setSelected] = useState<NearbyHousehold | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [komentar, setKomentar] = useState('')
  const [busy, setBusy] = useState(false)

  // GPS sekali saat halaman dibuka
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps((g) => ({ ...g, status: 'gagal' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, status: 'ok' }),
      () => setGps((g) => ({ ...g, status: 'gagal' })),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  // Muat pertanyaan + daftar keluarga di sekitar
  useEffect(() => {
    if (gps.status !== 'ok' || !gps.lat || !gps.lon) return
    const lat = gps.lat
    const lon = gps.lon
    void (async () => {
      try {
        const q = (await getConfigValue('verification_questions')) as Question[] | null
        setQuestions((q ?? []).filter((x) => x.tipe.includes('KOMUNITAS')))
        const n = await nearbyHouseholds(lat, lon)
        setList(n)
      } catch {
        setList([])
      }
    })()
  }, [gps])

  const kirim = async () => {
    if (!selected || !gps.lat || !gps.lon) return
    const belum = questions.filter((q) => !answers[q.key])
    if (belum.length > 0) {
      toast.showToast(`Masih ada ${belum.length} pertanyaan belum dijawab`, 'warning')
      return
    }
    setBusy(true)
    try {
      let adaHeld = false
      for (const q of questions) {
        const res = await submitVerification(
          selected.id, 'KOMUNITAS', q.key, answers[q.key],
          komentar.trim() || undefined, gps.lat, gps.lon,
        )
        if (res.status === 'HELD') adaHeld = true
      }
      if (adaHeld) {
        toast.showToast('Suara ditahan sementara — petugas akan periksa dulu', 'warning')
      } else {
        toast.showToast(`Verifikasi untuk ${selected.kode} terkirim`, 'success')
      }
      setSelected(null)
      setAnswers({})
      setKomentar('')
      const n = await nearbyHouseholds(gps.lat, gps.lon)
      setList(n)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim'
      toast.showToast(PESAN_ERROR[msg] ?? msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!profile?.is_verified) {
    return (
      <>
        <h1>Verifikasi Komunitas 🗳️</h1>
        <div className="card">
          <h3>Akun belum aktif sebagai verifikator</h3>
          <p>
            Akun yang belum disetujui petugas belum bisa ikut verifikasi/voting.
            Status akun Anda saat ini: <b>menunggu verifikasi petugas</b>.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Verifikasi Komunitas 🗳️</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Lokasi Anda: {gps.status === 'ok' ? '✓ terdeteksi' : gps.status === 'gagal' ? '⚠ tidak terdeteksi' : 'meminta izin…'}
      </p>

      {gps.status !== 'ok' && (
        <div className="card">
          <p>
            Izinkan akses lokasi di browser — verifikasi hanya berlaku untuk
            keluarga di sekitar Anda (radius 2 km), sesuai prinsip komunitas.
          </p>
        </div>
      )}

      {gps.status === 'ok' && list.length === 0 && (
        <div className="card">
          <h3>Belum ada keluarga di sekitar</h3>
          <p>
            Tidak ada keluarga yang sedang menunggu verifikasi dalam radius 2 km
            dari lokasi Anda saat ini. Coba lagi nanti, atau arahkan tetangga
            untuk mendaftar.
          </p>
        </div>
      )}

      {list.length > 0 && !selected && (
        <div className="card">
          <h3>Keluarga di sekitar Anda ({list.length})</h3>
          {list.map((hh) => (
            <button
              key={hh.id}
              className="list-item"
              onClick={() => setSelected(hh)}
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>{hh.kode}</b>
                <span className="chip">📍 {hh.jarak_m} m</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                RT {hh.rt || '-'} RW {hh.rw || '-'} {hh.kelurahan ? `· ${hh.kelurahan}` : ''} ·{' '}
                {STATUS_LABEL[hh.status] ?? hh.status}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <span className="chip">Welfare: {hh.welfare_score ?? '-'}</span>
                <span className="chip">Confidence: {hh.confidence_score ?? '-'}</span>
                <span className="chip">{hh.jumlah_vote} vote</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Verifikasi {selected.kode}</h3>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>← Kembali</button>
          </div>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Jawaban Anda anonim untuk publik — hanya petugas yang bisa melihat identitas.
            Vote tidak mengubah skor kesejahteraan, hanya kepercayaan datanya.
          </p>
          {questions.map((q) => (
            <div key={q.key} style={{ marginBottom: 14 }}>
              <b>{q.label}</b>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {q.opsi.map((op) => (
                  <button
                    key={op}
                    className={`chip ${answers[q.key] === op ? 'chip-primary' : ''}`}
                    onClick={() => setAnswers({ ...answers, [q.key]: op })}
                  >
                    {op.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <label className="label">Komentar (opsional, akan dimoderasi petugas)</label>
          <textarea
            className="textarea"
            value={komentar}
            onChange={(e) => setKomentar(e.target.value)}
            placeholder="contoh: kondisi rumah terlihat sama seperti foto"
          />
          <button className="btn btn-block" disabled={busy} onClick={() => void kirim()}>
            {busy ? 'Mengirim…' : 'Kirim verifikasi'}
          </button>
        </div>
      )}
    </>
  )
}