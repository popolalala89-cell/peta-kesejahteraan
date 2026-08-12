const STEPS = [
  { no: 1, label: 'Identitas keluarga', done: false },
  { no: 2, label: 'Anggota keluarga', done: false },
  { no: 3, label: 'Kondisi pekerjaan', done: false },
  { no: 4, label: 'Aset', done: false },
  { no: 5, label: 'Kondisi rumah', done: false },
  { no: 6, label: 'Foto rumah (wajib)', done: false },
  { no: 7, label: 'Bukti dokumen', done: false },
  { no: 8, label: 'Review & kirim', done: false },
]

export default function Registrasi() {
  return (
    <>
      <h1>Pendaftaran Keluarga 📝</h1>
      <p style={{ color: 'var(--on-surface-variant)' }}>
        Form lengkap 8 langkah sedang dibangun. Kerangka langkahnya sudah
        ditetapkan sesuai PRD.
      </p>

      <div className="card">
        <h3>Alur pendaftaran</h3>
        {STEPS.map((s) => (
          <div key={s.no} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <span
              className="chip"
              style={{
                background: s.done ? 'var(--primary)' : 'var(--surface-container)',
                color: s.done ? '#fff' : 'var(--on-surface-variant)',
                minWidth: 32,
                justifyContent: 'center',
              }}
            >
              {s.done ? '✓' : s.no}
            </span>
            <span style={{ flex: 1 }}>{s.label}</span>
            {s.no === 6 && <span className="chip" style={{ fontSize: 11 }}>5 foto wajib</span>}
          </div>
        ))}
      </div>

      <div className="card" style={{ background: 'var(--surface-container)' }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          📌 Setelah form jadi: foto diberi timestamp + lokasi otomatis dari
          perangkat (anti foto lama), dan NIK disimpan terenkripsi — tidak pernah
          ditampilkan.
        </p>
      </div>
    </>
  )
}