import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/Auth'
import { useToast } from '../context/Toast'
import { verifyProfile } from '../lib/api'

export default function Beranda() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const verifikasiAkunSendiri = async () => {
    if (!profile) return
    setBusy(true)
    try {
      await verifyProfile(profile.id)
      toast.showToast('Akun terverifikasi. Selamat datang di komunitas verifikator!', 'success')
      await refreshProfile()
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Gagal verifikasi', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Halo, {profile?.nama ?? 'warga'} 👋</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Sistem Pemetaan Kesejahteraan &amp; Kerentanan Warga — berbasis bukti dan
        verifikasi komunitas.
      </p>

      <div className="card">
        <h3>Status akun</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span className="chip">Peran: {profile?.role}</span>
          <span className={`chip ${profile?.is_verified ? 'chip-primary' : ''}`}>
            {profile?.is_verified ? '✓ Akun terverifikasi' : '⏳ Menunggu verifikasi petugas'}
          </span>
          <span className="chip">Reputasi verifier: {profile?.verifier_reputation}</span>
        </div>
        {!profile?.is_verified && (
          <p style={{ fontSize: 13, marginTop: 10 }}>
            Akun yang belum disetujui petugas belum bisa ikut verifikasi/voting.
          </p>
        )}
        {!profile?.is_verified && profile?.role !== 'warga' && (
          <button
            className="btn"
            disabled={busy}
            style={{ marginTop: 10 }}
            onClick={() => void verifikasiAkunSendiri()}
          >
            {busy ? 'Memproses…' : '✔ Verifikasi akun ini (role petugas/admin)'}
          </button>
        )}
      </div>

      <div className="card">
        <h3>Mulai di sini</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link to="/registrasi" className="btn">📝 Daftarkan Keluarga</Link>
          <Link to="/peta" className="btn btn-ghost">🗺️ Lihat Peta</Link>
        </div>
      </div>

      <div className="card">
        <h3>Bagaimana sistem ini bekerja?</h3>
        <p>
          Setiap keluarga punya dua angka terpisah: <b>Welfare Score</b> (kondisi
          ekonomi, dari indikator terdata) dan <b>Confidence Score</b> (seberapa
          yakin sistem datanya benar, dari bukti &amp; verifikasi). Voting warga
          sekitar <b>tidak pernah</b> menentukan kondisi ekonomi — hanya menguatkan
          kepercayaan data.
        </p>
        <p style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>
          Prinsip: fakta, verifikasi, dan keputusan dipisahkan. Privasi warga
          dijaga — publik hanya melihat agregasi.
        </p>
      </div>
    </>
  )
}