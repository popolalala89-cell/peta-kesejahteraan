# CURRENT_STATE — Peta Kesejahteraan

Update terakhir: 12 Agustus 2026 (DEPLOYED 🎉)

## Status keseluruhan
- 🟢 Halaman LIVE: https://popolalala89-cell.github.io/peta-kesejahteraan/ (HTTP 200, bundle CI verified)
- 🟢 Supabase project AKTIF: https://rfdbclvvcqdgdvsogynp.supabase.co — seed.sql SUDAH dijalankan (config kebaca, RPC map_aggregate & submit_verification verified)
- 🟢 Auth: confirm email off, signup terbuka, GH secrets set, CI deploy success (run 31564930380)
- 🟡 TERSISA (langkah manual Pa):
  1. Daftar akun (email popolalala89@gmail.com) di halaman live → jalankan kueri admin (di pesan chat) → role admin
  2. Bucket privat `evidence` di Storage (saat fitur upload foto dibangun)

## Yang sudah selesai
- [x] Konsep Pa → PRD v1.0 → ai-context → repo GitHub (SSH, main)
- [x] 6 keputusan terbuka (DEC-007..012) + arah Welfare (DEC-013)
- [x] supabase/seed.sql (schema + config + audit + guard + RLS + 13 RPC + revoke)
- [x] Scaffold frontend + build verified (lok al dan dengan env: 455KB bundle)
- [x] GH secrets + CI workflow + trigger deploy

## Langkah berikutnya
1. Pa daftar akun di halaman live → jalankan kueri set admin (SQL Editor) → verifikasi role
2. Lanjut koding: form registrasi 8 langkah, verifikasi tetangga, upload foto/dokumen (bucket `evidence` dibuat saat itu)

## Catatan teknis penting
- Schema final: supabase/seed.sql (PRD §9 referensi).
- Arah Welfare: tinggi = mampu (DEC-013). Bobot/threshold di tabel config (DEC-003).
- Voting: radius 100/500/2000m × reputasi; suara mencurigakan → HELD.
- Akses langsung ke verifications/anomaly_flags/audit_log/config di-revoke — semua lewat RPC.
- .env lokal TIDAK di-commit (gitignored). CI pakai secrets GH.