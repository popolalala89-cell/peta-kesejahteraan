import { useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  registerHousehold,
  uploadEvidence,
  type PhotoUpload,
} from '../lib/api'
import { useAuth } from '../context/Auth'
import { useToast } from '../context/Toast'

// ── Tipe state per langkah ────────────────────────────────────────────

interface MemberRow {
  nama: string
  hubungan: string
  tanggal_lahir: string
  jenis_kelamin: string
  status: string
  pekerjaan: string
  jenis_pekerjaan: string
  status_pekerjaan: string
  penghasilan_bulanan: string
  stabilitas_penghasilan: string
  lama_bekerja_months: string
  pendidikan: string
}

interface AssetRow {
  jenis: string
  deskripsi: string
  nilai_est: string
  produktif: boolean
  is_income_source: boolean
}

interface HouseRow {
  status: string
  luas_bangunan: string
  jumlah_kamar: string
  jenis_lantai: string
  jenis_dinding: string
  jenis_atap: string
  kondisi_bangunan: string
  sanitasi: string
  sumber_air: string
  sumber_listrik: string
  jumlah_penghuni: string
}

interface DocRow {
  jenis: string
  storage_path: string
}

const emptyMember = (): MemberRow => ({
  nama: '', hubungan: '', tanggal_lahir: '', jenis_kelamin: '',
  status: 'bekerja', pekerjaan: '', jenis_pekerjaan: '', status_pekerjaan: '',
  penghasilan_bulanan: '', stabilitas_penghasilan: '', lama_bekerja_months: '',
  pendidikan: '',
})

const emptyAsset = (): AssetRow => ({
  jenis: 'kendaraan', deskripsi: '', nilai_est: '', produktif: false, is_income_source: false,
})

const emptyHouse = (): HouseRow => ({
  status: '', luas_bangunan: '', jumlah_kamar: '', jenis_lantai: '', jenis_dinding: '',
  jenis_atap: '', kondisi_bangunan: '', sanitasi: '', sumber_air: '', sumber_listrik: '',
  jumlah_penghuni: '',
})

const STEPS = [
  'Identitas', 'Anggota keluarga', 'Aset', 'Kondisi rumah', 'Foto rumah', 'Dokumen', 'Review',
]

const FOTO_KATEGORI = [
  { key: 'tampak_depan', label: 'Tampak depan' },
  { key: 'ruang_utama', label: 'Ruang utama' },
  { key: 'dapur', label: 'Dapur' },
  { key: 'kamar_mandi', label: 'Kamar mandi' },
  { key: 'atap', label: 'Kondisi atap' },
]

const HUBUNGAN = ['Kepala keluarga', 'Istri', 'Anak', 'Orang tua', 'Cucu', 'Lainnya']
const STATUS_ANGGOTA = ['bekerja', 'tidak_bekerja', 'anak_sekolah', 'lansia', 'disabilitas', 'balita']
const STATUS_KERJA = [
  { v: 'tetap', l: 'Tetap / tetap bulanan' },
  { v: 'kontrak', l: 'Kontrak' },
  { v: 'harian', l: 'Harian / musiman' },
  { v: 'lepas', l: 'Lepas / tidak menentu' },
]
const JENIS_ASET = ['kendaraan', 'tanah', 'rumah_lain', 'usaha', 'mesin_peralatan', 'ternak', 'tabungan_investasi', 'lainnya']
const JENIS_DOKUMEN = ['SURAT_KETERANGAN', 'BUKTI_PENGHASILAN', 'BUKTI_PEKERJAAN', 'BUKTI_TANGGUNGAN', 'DOK_BANTUAN', 'DOK_KEPEMILIKAN', 'LAINNYA']

const n = (s: string) => (s.trim() === '' ? null : Number(s))
const t = (s: string) => (s.trim() === '' ? null : s.trim())

export default function Registrasi() {
  const { user } = useAuth()
  const toast = useToast()

  const [step, setStep] = useState(0)
  const [done, setDone] = useState<{ kode: string; status: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // GPS
  const [gps, setGps] = useState<{ lat: number | null; lon: number | null; status: string }>({
    lat: null, lon: null, status: 'meminta',
  })

  // Step 1: identitas
  const [ident, setIdent] = useState({
    nama_kepala: '', no_kartu_keluarga: '', alamat: '', rt: '', rw: '',
    kelurahan: '', kecamatan: '', telepon: '', status_tempat_tinggal: 'milik_sendiri',
  })

  // Step 2: anggota
  const [members, setMembers] = useState<MemberRow[]>([emptyMember()])

  // Step 3: aset
  const [assets, setAssets] = useState<AssetRow[]>([])

  // Step 4: rumah
  const [house, setHouse] = useState<HouseRow>(emptyHouse())

  // Step 5: foto
  const [photos, setPhotos] = useState<PhotoUpload[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})

  // Step 6: dokumen
  const [docs, setDocs] = useState<DocRow[]>([])

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // GPS diambil sekali saat halaman dibuka
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps((g) => ({ ...g, status: 'gagal' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude, status: 'ok' }),
      () => setGps((g) => ({ ...g, status: 'gagal' })),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])

  // ── Validasi per langkah ────────────────────────────────────────────

  const stepValid = (): boolean => {
    switch (step) {
      case 0:
        return ident.nama_kepala.trim() !== '' && ident.alamat.trim() !== ''
      case 1: {
        const valid = members.length > 0 && members.every((m) => m.nama.trim() !== '')
        if (!valid) { toast.showToast('Nama setiap anggota wajib diisi', 'warning'); return false }
        return true
      }
      case 4:
        return photos.length > 0
      default:
        return true
    }
  }

  const goNext = () => {
    if (!stepValid()) return
    if (step === 4 && gps.status === 'gagal') {
      toast.showToast('Lokasi tidak terdeteksi — izinkan akses lokasi untuk verifikasi foto', 'warning')
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  // ── Upload foto kamera ──────────────────────────────────────────────

  const onFotoPicked = async (kategori: string, file: File | undefined) => {
    if (!file) return
    if (!isSupabaseConfigured || !user) {
      toast.showToast('Login dan konfigurasi Supabase diperlukan', 'warning')
      return
    }
    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg'
    const path = `photos/${user.id}/${Date.now()}_${kategori}.${ext}`
    setUploading((u) => ({ ...u, [kategori]: true }))
    try {
      const p = await uploadEvidence(file, path)
      setPhotos((arr) => [
        ...arr.filter((x) => x.kategori !== kategori),
        {
          kategori,
          storage_path: p,
          taken_at: new Date().toISOString(),
          lat: gps.lat,
          lon: gps.lon,
        },
      ])
      setPreviews((pv) => ({ ...pv, [kategori]: URL.createObjectURL(file) }))
      toast.showToast(`Foto ${kategori} tersimpan`, 'success')
    } catch (err) {
      toast.showToast(
        err instanceof Error ? err.message : 'Upload foto gagal — cek bucket "evidence"',
        'error',
      )
    } finally {
      setUploading((u) => ({ ...u, [kategori]: false }))
    }
  }

  const onDokumenPicked = async (jenis: string, file: File | undefined) => {
    if (!file) return
    if (!isSupabaseConfigured || !user) {
      toast.showToast('Login dan konfigurasi Supabase diperlukan', 'warning')
      return
    }
    try {
      const path = `documents/${user.id}/${Date.now()}_${jenis}`
      const p = await uploadEvidence(file, path)
      setDocs((arr) => [...arr, { jenis, storage_path: p }])
      toast.showToast('Dokumen terunggah', 'success')
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Upload dokumen gagal', 'error')
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────

  const submit = async () => {
    if (!gps.lat || !gps.lon) {
      toast.showToast('Lokasi wajib terdeteksi sebelum mengirim', 'warning')
      return
    }
    setBusy(true)
    try {
      const res = await registerHousehold({
        household: {
          nama_kepala: ident.nama_kepala,
          no_kartu_keluarga: t(ident.no_kartu_keluarga) ?? undefined,
          alamat: ident.alamat,
          rt: t(ident.rt) ?? undefined,
          rw: t(ident.rw) ?? undefined,
          kelurahan: t(ident.kelurahan) ?? undefined,
          kecamatan: t(ident.kecamatan) ?? undefined,
          lat: gps.lat,
          lon: gps.lon,
          telepon: t(ident.telepon) ?? undefined,
          status_tempat_tinggal: t(ident.status_tempat_tinggal) ?? undefined,
          jumlah_anggota: members.length,
        },
        members: members.map((m) => ({
          nama: m.nama,
          hubungan: t(m.hubungan) ?? 'Lainnya',
          tanggal_lahir: t(m.tanggal_lahir) ?? undefined,
          jenis_kelamin: t(m.jenis_kelamin) ?? undefined,
          status: m.status,
          pekerjaan: t(m.pekerjaan) ?? undefined,
          jenis_pekerjaan: t(m.jenis_pekerjaan) ?? undefined,
          status_pekerjaan: t(m.status_pekerjaan) ?? undefined,
          penghasilan_bulanan: n(m.penghasilan_bulanan) ?? undefined,
          stabilitas_penghasilan: n(m.stabilitas_penghasilan) ?? undefined,
          lama_bekerja_months: n(m.lama_bekerja_months) ?? undefined,
          pendidikan: t(m.pendidikan) ?? undefined,
        })),
        house: {
          status: t(house.status) ?? 'milik_sendiri',
          luas_bangunan: n(house.luas_bangunan),
          jumlah_kamar: n(house.jumlah_kamar),
          jenis_lantai: t(house.jenis_lantai) ?? undefined,
          jenis_dinding: t(house.jenis_dinding) ?? undefined,
          jenis_atap: t(house.jenis_atap) ?? undefined,
          kondisi_bangunan: n(house.kondisi_bangunan),
          sanitasi: t(house.sanitasi) ?? undefined,
          sumber_air: t(house.sumber_air) ?? undefined,
          sumber_listrik: t(house.sumber_listrik) ?? undefined,
          jumlah_penghuni: n(house.jumlah_penghuni),
        },
        assets: assets.map((a) => ({
          jenis: a.jenis,
          deskripsi: t(a.deskripsi) ?? undefined,
          nilai_est: n(a.nilai_est),
          produktif: a.produktif,
          is_income_source: a.is_income_source,
        })),
        photos,
        documents: docs.map((d) => ({ jenis: d.jenis, storage_path: d.storage_path })),
      })
      setDone({ kode: `KD-${res.id.slice(-5).toUpperCase()}`, status: res.status })
      window.scrollTo(0, 0)
      toast.showToast('Keluarga berhasil didaftarkan!', 'success')
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Gagal menyimpan', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ── Render sukses ───────────────────────────────────────────────────

  if (done) {
    return (
      <>
        <h1>Berhasil didaftarkan! 🎉</h1>
        <div className="card">
          <h2 style={{ color: 'var(--primary)' }}>{done.kode}</h2>
          <p>
            Keluarga Anda masuk antrean verifikasi dengan status{' '}
            <b>{done.status}</b>. Petugas akan memeriksa data, lalu verifikasi
            tetangga di sekitar lokasi Anda.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="chip chip-primary">Welfare: dihitung otomatis</span>
            <span className="chip chip-primary">Confidence: dihitung otomatis</span>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => { setDone(null); setStep(0); setMembers([emptyMember()]); setAssets([]); setHouse(emptyHouse()); setPhotos([]); setPreviews({}); setDocs([]); }}>
          Daftarkan keluarga lain
        </button>
      </>
    )
  }

  // ── Tombol langkah ──────────────────────────────────────────────────

  const navBtn = (
    <>
      <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
        ← Kembali
      </button>
      <button className="btn" onClick={goNext}>
        {step === STEPS.length - 1 ? 'Kirim data' : 'Lanjut →'}
      </button>
    </>
  )

  return (
    <>
      <h1>Pendaftaran Keluarga 📝</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Lokasi rumah: {gps.status === 'ok' ? '✓ terdeteksi' : gps.status === 'gagal' ? '⚠ tidak terdeteksi' : 'meminta izin…'}
      </p>

      {/* Progress */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {STEPS.map((s, i) => (
          <button
            key={s}
            className={`chip ${i === step ? 'chip-primary' : ''}`}
            onClick={() => i < step && setStep(i)}
            style={{ cursor: i < step ? 'pointer' : 'default' }}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* STEP 0 — Identitas */}
      {step === 0 && (
        <div className="card">
          <h3>Identitas keluarga</h3>
          <label className="label">Nama kepala keluarga *</label>
          <input className="input" value={ident.nama_kepala} onChange={(e) => setIdent({ ...ident, nama_kepala: e.target.value })} placeholder="Nama sesuai KTP" />
          <label className="label">Nomor Kartu Keluarga</label>
          <input className="input" value={ident.no_kartu_keluarga} onChange={(e) => setIdent({ ...ident, no_kartu_keluarga: e.target.value })} placeholder="16 digit (opsional)" />
          <label className="label">Alamat lengkap *</label>
          <textarea className="textarea" value={ident.alamat} onChange={(e) => setIdent({ ...ident, alamat: e.target.value })} placeholder="Alamat rumah" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">RT</label><input className="input" value={ident.rt} onChange={(e) => setIdent({ ...ident, rt: e.target.value })} placeholder="03" /></div>
            <div style={{ flex: 1 }}><label className="label">RW</label><input className="input" value={ident.rw} onChange={(e) => setIdent({ ...ident, rw: e.target.value })} placeholder="02" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="label">Kelurahan</label><input className="input" value={ident.kelurahan} onChange={(e) => setIdent({ ...ident, kelurahan: e.target.value })} /></div>
            <div style={{ flex: 1 }}><label className="label">Kecamatan</label><input className="input" value={ident.kecamatan} onChange={(e) => setIdent({ ...ident, kecamatan: e.target.value })} /></div>
          </div>
          <label className="label">Nomor telepon</label>
          <input className="input" type="tel" value={ident.telepon} onChange={(e) => setIdent({ ...ident, telepon: e.target.value })} placeholder="08xx-xxxx-xxxx" />
          <label className="label">Status tempat tinggal</label>
          <select className="select" value={ident.status_tempat_tinggal} onChange={(e) => setIdent({ ...ident, status_tempat_tinggal: e.target.value })}>
            <option value="milik_sendiri">Milik sendiri</option>
            <option value="sewa">Sewa / kontrak</option>
            <option value="numpang">Numpang keluarga</option>
            <option value="dinas">Rumah dinas</option>
          </select>
        </div>
      )}

      {/* STEP 1 — Anggota */}
      {step === 1 && (
        <div className="card">
          <h3>Anggota keluarga</h3>
          {members.map((m, idx) => (
            <div key={idx} style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Anggota #{idx + 1}</b>
                {members.length > 1 && (
                  <button className="chip" style={{ background: 'var(--error)', color: '#fff' }} onClick={() => setMembers(members.filter((_, i) => i !== idx))}>
                    Hapus
                  </button>
                )}
              </div>
              <label className="label">Nama lengkap *</label>
              <input className="input" value={m.nama} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, nama: e.target.value } : x)))} />
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Hubungan</label>
                  <select className="select" value={m.hubungan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, hubungan: e.target.value } : x)))}>
                    <option value="">Pilih</option>
                    {HUBUNGAN.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Jenis kelamin</label>
                  <select className="select" value={m.jenis_kelamin} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, jenis_kelamin: e.target.value } : x)))}>
                    <option value="">Pilih</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
              </div>
              <label className="label">Tanggal lahir</label>
              <input className="input" type="date" value={m.tanggal_lahir} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, tanggal_lahir: e.target.value } : x)))} />
              <label className="label">Status anggota</label>
              <select className="select" value={m.status} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, status: e.target.value } : x)))}>
                {STATUS_ANGGOTA.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
              {m.status === 'bekerja' && (
                <>
                  <label className="label">Pekerjaan</label>
                  <input className="input" value={m.pekerjaan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, pekerjaan: e.target.value } : x)))} placeholder="contoh: Buruh harian" />
                  <label className="label">Jenis pekerjaan</label>
                  <input className="input" value={m.jenis_pekerjaan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, jenis_pekerjaan: e.target.value } : x)))} placeholder="contoh: konstruksi / pabrik / dagang" />
                  <label className="label">Status pekerjaan</label>
                  <select className="select" value={m.status_pekerjaan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, status_pekerjaan: e.target.value } : x)))}>
                    <option value="">Pilih</option>
                    {STATUS_KERJA.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label className="label">Penghasilan rata-rata (Rp/bulan)</label>
                      <input className="input" type="number" value={m.penghasilan_bulanan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, penghasilan_bulanan: e.target.value } : x)))} placeholder="1440000" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="label">Stabilitas (1-5)</label>
                      <input className="input" type="number" min={1} max={5} value={m.stabilitas_penghasilan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, stabilitas_penghasilan: e.target.value } : x)))} placeholder="3" />
                    </div>
                  </div>
                  <label className="label">Lama bekerja (bulan)</label>
                  <input className="input" type="number" value={m.lama_bekerja_months} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, lama_bekerja_months: e.target.value } : x)))} />
                </>
              )}
              <label className="label">Pendidikan</label>
              <input className="input" value={m.pendidikan} onChange={(e) => setMembers(members.map((x, i) => (i === idx ? { ...x, pendidikan: e.target.value } : x)))} placeholder="contoh: SD / SMP / SMA / S1" />
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => setMembers([...members, emptyMember()])}>
            + Tambah anggota
          </button>
        </div>
      )}

      {/* STEP 2 — Aset */}
      {step === 2 && (
        <div className="card">
          <h3>Aset keluarga</h3>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Aset produktif (misal motor untuk cari nafkah) dinilai lebih ringan.
          </p>
          {assets.map((a, idx) => (
            <div key={idx} style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Aset #{idx + 1}</b>
                <button className="chip" style={{ background: 'var(--error)', color: '#fff' }} onClick={() => setAssets(assets.filter((_, i) => i !== idx))}>
                  Hapus
                </button>
              </div>
              <label className="label">Jenis</label>
              <select className="select" value={a.jenis} onChange={(e) => setAssets(assets.map((x, i) => (i === idx ? { ...x, jenis: e.target.value } : x)))}>
                {JENIS_ASET.map((j) => <option key={j} value={j}>{j.replace('_', ' ')}</option>)}
              </select>
              <label className="label">Deskripsi</label>
              <input className="input" value={a.deskripsi} onChange={(e) => setAssets(assets.map((x, i) => (i === idx ? { ...x, deskripsi: e.target.value } : x)))} placeholder="contoh: motor 2015 untuk antar barang" />
              <label className="label">Perkiraan nilai (Rp)</label>
              <input className="input" type="number" value={a.nilai_est} onChange={(e) => setAssets(assets.map((x, i) => (i === idx ? { ...x, nilai_est: e.target.value } : x)))} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <input type="checkbox" checked={a.is_income_source} onChange={(e) => setAssets(assets.map((x, i) => (i === idx ? { ...x, is_income_source: e.target.checked } : x)))} />
                Dipakai untuk menambah penghasilan
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={a.produktif} onChange={(e) => setAssets(assets.map((x, i) => (i === idx ? { ...x, produktif: e.target.checked } : x)))} />
                Aset produktif (alat usaha)
              </label>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={() => setAssets([...assets, emptyAsset()])}>
            + Tambah aset
          </button>
        </div>
      )}

      {/* STEP 3 — Rumah */}
      {step === 3 && (
        <div className="card">
          <h3>Kondisi rumah</h3>
          <label className="label">Status rumah</label>
          <select className="select" value={house.status} onChange={(e) => setHouse({ ...house, status: e.target.value })}>
            <option value="milik_sendiri">Milik sendiri</option>
            <option value="sewa">Sewa / kontrak</option>
            <option value="numpang">Numpang</option>
            <option value="dinas">Rumah dinas</option>
          </select>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Luas bangunan (m²)</label>
              <input className="input" type="number" value={house.luas_bangunan} onChange={(e) => setHouse({ ...house, luas_bangunan: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Jumlah kamar</label>
              <input className="input" type="number" value={house.jumlah_kamar} onChange={(e) => setHouse({ ...house, jumlah_kamar: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Jenis lantai</label>
              <select className="select" value={house.jenis_lantai} onChange={(e) => setHouse({ ...house, jenis_lantai: e.target.value })}>
                <option value="">Pilih</option>
                <option value="tanah">Tanah</option>
                <option value="semen">Semen / plester</option>
                <option value="keramik">Keramik / granit</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Jenis dinding</label>
              <select className="select" value={house.jenis_dinding} onChange={(e) => setHouse({ ...house, jenis_dinding: e.target.value })}>
                <option value="">Pilih</option>
                <option value="bambu">Bambu / anyaman</option>
                <option value="papan">Papan / kayu</option>
                <option value="tembok">Tembok (sebagian/belum plester)</option>
                <option value="tembok_plester">Tembok plester</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Jenis atap</label>
              <select className="select" value={house.jenis_atap} onChange={(e) => setHouse({ ...house, jenis_atap: e.target.value })}>
                <option value="">Pilih</option>
                <option value="rumbia">Rumbia / ijuk</option>
                <option value="seng">Seng / asbes</option>
                <option value="genteng">Genteng</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Kondisi bangunan (1-5)</label>
              <input className="input" type="number" min={1} max={5} value={house.kondisi_bangunan} onChange={(e) => setHouse({ ...house, kondisi_bangunan: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Sanitasi</label>
              <select className="select" value={house.sanitasi} onChange={(e) => setHouse({ ...house, sanitasi: e.target.value })}>
                <option value="">Pilih</option>
                <option value="wc_own">WC sendiri (sehat)</option>
                <option value="wc_shared">WC bersama</option>
                <option value="none">Tidak ada WC</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Sumber air</label>
              <select className="select" value={house.sumber_air} onChange={(e) => setHouse({ ...house, sumber_air: e.target.value })}>
                <option value="">Pilih</option>
                <option value="pdam">PDAM / sumur bor</option>
                <option value="sumur">Sumur</option>
                <option value="sungai">Sungai / hujan</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="label">Listrik</label>
              <select className="select" value={house.sumber_listrik} onChange={(e) => setHouse({ ...house, sumber_listrik: e.target.value })}>
                <option value="">Pilih</option>
                <option value="pln">PLN</option>
                <option value="non_pln">Non-PLN (genset/aki)</option>
                <option value="none">Tidak ada</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="label">Jumlah penghuni</label>
              <input className="input" type="number" value={house.jumlah_penghuni} onChange={(e) => setHouse({ ...house, jumlah_penghuni: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 — Foto */}
      {step === 4 && (
        <div className="card">
          <h3>Foto rumah (wajib)</h3>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Foto diberi timestamp + lokasi otomatis. Setiap kategori: 1 foto.
          </p>
          {FOTO_KATEGORI.map((fk) => (
            <div key={fk.key} style={{ background: 'var(--surface-container)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <b>{fk.label}</b>
                {previews[fk.key] && <span className="chip chip-primary">✓ terunggah</span>}
              </div>
              {previews[fk.key] ? (
                <img src={previews[fk.key]} alt={fk.label} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10 }} />
              ) : (
                <button
                  className="btn btn-ghost"
                  disabled={uploading[fk.key]}
                  onClick={() => fileRefs.current[fk.key]?.click()}
                >
                  {uploading[fk.key] ? 'Mengunggah…' : '📷 Ambil foto'}
                </button>
              )}
              <input
                ref={(el) => { fileRefs.current[fk.key] = el }}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => void onFotoPicked(fk.key, e.target.files?.[0])}
              />
            </div>
          ))}
          <p style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
            Total tersimpan: {photos.length}/5 kategori.
          </p>
        </div>
      )}

      {/* STEP 5 — Dokumen */}
      {step === 5 && (
        <div className="card">
          <h3>Bukti dokumen (opsional)</h3>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Dokumen tidak ditampilkan publik — hanya badge "telah diverifikasi".
          </p>
          {docs.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {docs.map((d, i) => (
                <div key={i} className="chip" style={{ marginRight: 6, marginBottom: 6 }}>
                  ✓ {d.jenis.replaceAll('_', ' ')}
                </div>
              ))}
            </div>
          )}
          {JENIS_DOKUMEN.map((j) => (
            <div key={j} style={{ marginBottom: 8 }}>
              <button className="btn btn-ghost" onClick={() => void (fileRefs.current[j]?.click())}>
                + {j.replaceAll('_', ' ')}
              </button>
              <input
                ref={(el) => { fileRefs.current[j] = el }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={(e) => void onDokumenPicked(j, e.target.files?.[0])}
              />
            </div>
          ))}
        </div>
      )}

      {/* STEP 6 — Review */}
      {step === 6 && (
        <div className="card">
          <h3>Review sebelum dikirim</h3>
          <p><b>Kepala keluarga:</b> {ident.nama_kepala}</p>
          <p><b>Alamat:</b> {ident.alamat}, RT {ident.rt || '-'} RW {ident.rw || '-'}</p>
          <p><b>Anggota:</b> {members.length} orang</p>
          <p><b>Foto:</b> {photos.length}/5 kategori</p>
          <p><b>Dokumen:</b> {docs.length} berkas</p>
          <p><b>Aset:</b> {assets.length} item</p>
          <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
            Lokasi terdeteksi: {gps.status === 'ok' ? `${gps.lat?.toFixed(5)}, ${gps.lon?.toFixed(5)}` : '⚠ tidak terdeteksi'}
          </p>
          {gps.status !== 'ok' && (
            <p style={{ color: 'var(--error)', fontSize: 13 }}>
              Lokasi wajib terdeteksi sebelum mengirim — muat ulang halaman dan izinkan akses lokasi.
            </p>
          )}
          <button className="btn btn-block" disabled={busy || gps.status !== 'ok'} onClick={() => void submit()}>
            {busy ? 'Mengirim…' : 'Kirim data keluarga'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
        {navBtn}
      </div>
    </>
  )
}