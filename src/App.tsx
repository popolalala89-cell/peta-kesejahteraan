import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/Auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Beranda from './pages/Beranda'
import Peta from './pages/Peta'
import Registrasi from './pages/Registrasi'
import Profil from './pages/Profil'
import Petugas from './pages/Petugas'

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Memuat…</div>
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Beranda />} />
        <Route path="/peta" element={<Peta />} />
        <Route path="/registrasi" element={<Registrasi />} />
        <Route path="/profil" element={<Profil />} />
        <Route path="/petugas" element={<Petugas />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}