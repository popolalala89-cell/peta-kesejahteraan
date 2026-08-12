# CURRENT_STATE — Peta Kesejahteraan

Update terakhir: 12 Agustus 2026 (Supabase project aktif)

## Status keseluruhan
- 🟢 Supabase project AKTIF: https://rfdbclvvcqdgdvsogynp.supabase.co
- 🟢 Auth: confirm email sudah off (mailer_autoconfirm=true), signup terbuka — tidak perlu diubah.
- 🟢 GH secrets set (SUPABASE_URL + ANON_KEY), CI deploy pertama di-trigger (run 31564578786).
- 🟡 TERSISA (butuh Pa di dashboard):
  1. Import & jalankan `supabase/seed.sql` (file sudah di Download HP: seed_peta_kesejahteraan.sql)
  2. Storage → buat bucket privat `evidence` (bisa nanti saat upload foto dibangun)

## Yang sudah selesai
- [x] Konsep Pa → PRD v1.0 → ai-context → repo GitHub (SSH, main)
- [x] 6 keputusan terbuka (DEC-007..012) + arah Welfare (DEC-013)
- [x] supabase/seed.sql (schema + config + audit + guard + RLS + 13 RPC + revoke)
- [x] Scaffold frontend + build verified (lok al dan dengan env: 455KB bundle)
- [x] GH secrets + CI workflow + trigger deploy

## Langkah berikutnya
1. Pa jalankan seed.sql (instruksi ada di pesan chat) → konfirmasi ke assistan
2. Assist verifikasi: anon REST ke tabel config (harus 200) → signup akun admin
3. Lanjut koding: form registrasi 8 langkah, verifikasi tetangga, upload foto/dokumen

## Catatan teknis penting
- Schema final: supabase/seed.sql (PRD §9 referensi).
- Arah Welfare: tinggi = mampu (DEC-013). Bobot/threshold di tabel config (DEC-003).
- Voting: radius 100/500/2000m × reputasi; suara mencurigakan → HELD.
- Akses langsung ke verifications/anomaly_flags/audit_log/config di-revoke — semua lewat RPC.
- .env lokal TIDAK di-commit (gitignored). CI pakai secrets GH.