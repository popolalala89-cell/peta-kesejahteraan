# TASK_BOARD — Peta Kesejahteraan

Urutan prioritas. Satu item in-progress maksimal.

## Sebelum koding (prasyarat)
- [x] Pa menjawab 6 keputusan terbuka (12 Agu 2026 — semua pakai rekomendasi, DEC-007..012)

## Fase 1 — MVP
- [x] `supabase/seed.sql`: schema (12 tabel) + extension PostGIS/pgcrypto + RLS + seed config + trigger audit + guard status + 13 RPC + revoke akses langsung (SELESAI ditulis — TINGGAL dijalankan Pa di SQL Editor)
- [~] Setup Supabase project: AKTIF (rfdbclvvcqdgdvsogynp.supabase.co, confirm email off) — tersisa: jalankan seed.sql + bucket privat `evidence`
- [x] Frontend scaffold: Vite + React + TS, routing, tema MD3 (design tokens PRD §11), layout responsive (sidebar/bottom-nav), auth shell, toast, halaman Beranda/Peta/Registrasi/Profil/Petugas — build verified
- [ ] GH Pages deploy: CI di-trigger (build job) — halaman publik aktif setelah seed.sql jalan
- [ ] Auth & profil: login, peran (warga/petugas/admin), lokasi GPS saat pendaftaran akun, status is_verified (shell sudah ada; lengkap saat Supabase aktif)
- [x] Registrasi keluarga multi-step (8 langkah: identitas → anggota → aset → rumah → foto → dokumen → review) + RPC register_household/get_my_household (migrate_01_registrasi.sql) — build verified, TINGGAL: Pa jalankan migrate_01 + buat bucket `evidence` + tes
- [x] RPC skor: recalc_scores (Welfare + Confidence) + score_snapshots (sudah di seed.sql, verified lewat submit_verification AUTH_REQUIRED)
- [ ] Pa jalankan `supabase/migrate_01_registrasi.sql` di SQL Editor + buat bucket privat `evidence` (Storage) + tes daftar keluarga dummy
- [ ] Verifikasi tetangga: request + jawaban 4 pilihan + komentar
- [x] Voting komunitas: halaman Verifikasi (radius 2km + reputasi + anomali → ACTIVE/HELD) + dashboard petugas (prioritas, verifikasi lapangan, review HELD, validasi dokumen) — build verified, TINGGAL: Pa jalankan migrate_02 + tes 2 akun
- [ ] Profil publik masked (#KD-xxxxx) + pemungutan suara + aggregasi RT
- [ ] Dispute: file_dispute + resolve_dispute + alur investigasi
- [ ] Audit log view (petugas/admin)

## Fase 2
- [ ] Reputasi verifier penuh (umpan balik dari verifikasi lapangan)
- [ ] Dashboard anomali (flag list + review)
- [ ] Moderasi komentar
- [ ] Notifikasi (WA gateway / web push)
- [ ] Peta interaktif (leaflet)

## Fase 3
- [ ] Integrasi data pemerintah (DTKS dll)
- [ ] Analytics & export laporan
- [ ] Kalibrasi threshold per daerah
- [ ] Aplikasi Android (Capacitor)