# PROJECT_MEMORY — Peta Kesejahteraan

Kronologi & latar belakang proyek.

- **12 Agu 2026 — Awal ide.** Pa membawa konsep "database warga miskin"; dikembangkan jadi sistem berbasis bukti & verifikasi komunitas dengan dua skor terpisah (Welfare vs Confidence). Dokumen konsep 25 poin dari Pa menjadi dasar PRD.
- **12 Agu 2026 — PRD v1.0.** PRD.md ditulis sesuai standar documentation-first-development: 17 seksi + schema PostgreSQL + RPC inventory + design system MD3 + Konstanta + 6 keputusan terbuka.
- **12 Agu 2026 — ai-context setup.** 7 file konteks + CHANGELOG dibuat.

## Keputusan inti (ringkas)
- Dua skor terpisah: Welfare Score (kondisi ekonomi) & Confidence Score (kualitas data) — lihat DEC-001.
- Voting komunitas dibatasi radius (100m/500m/2km) dengan bobot menurun × reputasi verifier; suara mencurigakan ditahan (HELD).
- Welfare Score TIDAK pernah dipengaruhi suara.
- NIK di-hash; dokumen/foto privat; publik hanya lihat agregasi & badge.

## Konteks lingkungan
- Dev di Termux/Android (browser tool tidak support — verifikasi via hash bundle + grep marker).
- Internet kerja Pa terbatas: google.com + drive.google.com jalan; asset web wajib lokal (no CDN).
- Repo GH: popolalala89-cell; push pakai SSH id_ed25519.