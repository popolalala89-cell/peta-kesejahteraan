# CURRENT_STATE — Peta Kesejahteraan

Update terakhir: 12 Agustus 2026 (scaffold selesai)

## Status keseluruhan
- 🟢 Keputusan terbuka SUDAH dijawab (DEC-007..013).
- 🟢 supabase/seed.sql SELESAI ditulis (belum dijalankan — menunggu Supabase project).
- 🟢 Scaffold frontend SELESAI + build verified (tsc 0 error, vite build OK).
- 🔴 Blocker: belum ada Supabase project aktif. Butuh Pa: buat project → kirim Project URL + anon key → set secrets GH (SUPABASE_URL, ANON_KEY) → jalankan seed.sql.

## Sedang dikerjakan
- (menunggu Supabase project dari Pa)

## Yang sudah selesai
- [x] Konsep Pa — 12 Agu 2026
- [x] PRD v1.0 (termasuk perbaikan arah skala Welfare, DEC-013)
- [x] ai-context (7 file) + CHANGELOG
- [x] Repo GitHub: popolalala89-cell/peta-kesejahteraan (SSH, main)
- [x] 6 keputusan terbuka dijawab (DEC-007..012)
- [x] supabase/seed.sql: schema 12 tabel + config seed + trigger audit + guard status + RLS + 13 RPC + revoke akses langsung
- [x] Scaffold frontend: Vite 8 + React 19 + TS, tema MD3, layout sidebar/bottom-nav, auth login/daftar, halaman Beranda/Peta/Registrasi/Profil/Petugas, toast
- [x] Workflow GH Pages + README + .env.example + favicon
- [x] npm run build verified

## Langkah berikutnya (saat Supabase project siap)
1. Pa buat project Supabase baru → kirim Project URL + anon key.
2. Jalankan supabase/seed.sql di SQL Editor.
3. Matikan "Confirm email" di Authentication → Settings.
4. Buat bucket privat `evidence` di Storage.
5. Set secrets GH: SUPABASE_URL + ANON_KEY → CI deploy jalan otomatis.
6. Signup akun pertama → set role admin via set_user_role / update profiles.

## Catatan teknis penting
- Schema final: supabase/seed.sql (PRD §9 jadi referensi).
- Arah Welfare: tinggi = mampu (DEC-013). Bobot/threshold di tabel config (DEC-003).
- Voting: radius 100/500/2000m × reputasi verifier; suara mencurigakan → HELD.
- Akses langsung ke verifications/anomaly_flags/audit_log/config di-revoke — semua lewat RPC.