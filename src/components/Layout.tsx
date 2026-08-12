import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/Auth'
import { useToast } from '../context/Toast'

const MENU = [
  { to: '/', label: 'Beranda', ico: '🏠' },
  { to: '/peta', label: 'Peta', ico: '🗺️' },
  { to: '/registrasi', label: 'Daftar Keluarga', ico: '📝' },
  { to: '/profil', label: 'Profil', ico: '👤' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const menu = [...MENU]
  if (profile?.role === 'petugas' || profile?.role === 'admin') {
    menu.push({ to: '/petugas', label: 'Petugas', ico: '🛡️' })
  }

  const handleSignOut = async () => {
    await signOut()
    toast.showToast('Berhasil keluar', 'warning')
    navigate('/login')
  }

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `nav-item ${isActive ? 'active' : ''}`

  return (
    <div className="app-shell">
      <aside className="side-nav">
        <div className="brand">🌾 Peta Kesejahteraan</div>
        {menu.map((m) => (
          <NavLink key={m.to} to={m.to} className={itemClass} end={m.to === '/'}>
            <span className="nav-ico">{m.ico}</span> {m.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        {profile && (
          <div className="nav-item" style={{ pointerEvents: 'none' }}>
            <span className="nav-ico">👤</span>
            <div style={{ fontSize: 12, lineHeight: 1.3 }}>
              {profile.nama}
              <br />
              <span style={{ opacity: 0.7 }}>
                {profile.role} · Reputasi {profile.verifier_reputation}
              </span>
            </div>
          </div>
        )}
        <button className="nav-item" onClick={handleSignOut}>
          <span className="nav-ico">🚪</span> Keluar
        </button>
      </aside>

      <main className="main-content">{children}</main>

      <nav className="bottom-nav">
        {menu.map((m) => (
          <NavLink key={m.to} to={m.to} className={itemClass} end={m.to === '/'}>
            <span className="nav-ico">{m.ico}</span> {m.label}
          </NavLink>
        ))}
        <button className="nav-item" onClick={handleSignOut}>
          <span className="nav-ico">🚪</span> Keluar
        </button>
      </nav>
    </div>
  )
}