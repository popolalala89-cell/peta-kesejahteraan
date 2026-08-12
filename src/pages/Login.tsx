import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../context/Auth'
import { useToast } from '../context/Toast'

export default function Login() {
  const [mode, setMode] = useState<'login' | 'daftar'>('login')
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.showToast('Supabase belum dikonfigurasi', 'warning')
      return
    }
    if (!email || password.length < 6) {
      toast.showToast('Isi email dan password minimal 6 karakter', 'warning')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
        await refreshProfile()
        toast.showToast('Selamat datang kembali!')
        navigate('/')
      } else {
        if (!nama.trim()) {
          toast.showToast('Nama wajib diisi', 'warning')
          return
        }
        const { data, error } = await supabase!.auth.signUp({ email, password })
        if (error) throw error
        if (!data.user) throw new Error('Pendaftaran gagal')
        const { error: pErr } = await supabase!
          .from('profiles')
          .insert({ id: data.user.id, role: 'warga', nama: nama.trim() })
        if (pErr) throw pErr
        toast.showToast('Akun berhasil dibuat!')
        setMode('login')
      }
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Terjadi kesalahan', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 style={{ color: 'var(--primary)' }}>🌾 Peta Kesejahteraan</h1>
        <p style={{ color: 'var(--on-surface-variant)' }}>
          Pemetaan kesejahteraan berbasis bukti &amp; verifikasi komunitas.
        </p>

        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <button
            className={`chip ${mode === 'login' ? 'chip-primary' : ''}`}
            onClick={() => setMode('login')}
          >
            Masuk
          </button>
          <button
            className={`chip ${mode === 'daftar' ? 'chip-primary' : ''}`}
            onClick={() => setMode('daftar')}
          >
            Daftar
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'daftar' && (
            <>
              <label className="label">Nama lengkap</label>
              <input className="input" value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama sesuai KTP" />
            </>
          )}
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" />
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" />

          {mode === 'daftar' && (
            <p style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
              Lokasi rumah akan diminta saat pendaftaran keluarga. Akun baru harus
              disetujui petugas sebelum bisa ikut verifikasi.
            </p>
          )}

          <button className="btn btn-block" disabled={busy}>
            {busy ? 'Memproses…' : mode === 'login' ? 'Masuk' : 'Buat Akun'}
          </button>
        </form>
      </div>
    </div>
  )
}