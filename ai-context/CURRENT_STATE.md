# CURRENT_STATE — Peta Kesejahteraan

Update terakhir: 12 Agustus 2026

## Status keseluruhan
- 🟡 Fase perencanaan — BELUM ada kode.
- PRD v1.0 selesai dan disetujui sebagai kontrak.
- ai-context dibuat (7 file + CHANGELOG).

## Blocker (wajib dijawab sebelum eksekusi)
1. Cakupan pilot: RT/RW mana? Berapa keluarga?
2. Siapa petugasnya (RT/RW/kelurahan/karang taruna)?
3. NIK: cukup hash + cek manual petugas di Fase 1?
4. Kalibrasi threshold Welfare Score — pakai bobot default PRD §5.1?
5. Moderasi komentar: petugas atau admin?
6. Butuh mode offline (sinyal di lokasi pilot)?

## Sedang dikerjakan
- (tidak ada — menunggu jawaban keputusan terbuka)

## Yang sudah selesai
- [x] Konsep Pa (database warga → sistem bukti + verifikasi komunitas) — 12 Agu 2026
- [x] PRD v1.0 (PRD.md)
- [x] ai-context setup (AGENTS, CURRENT_STATE, PROJECT_MEMORY, TASK_BOARD, DECISIONS, ERROR_HISTORY, LESSONS_LEARNED)
- [x] CHANGELOG.md

## Catatan teknis penting
- Stack: React + TS + Vite + Supabase (Postgres/Auth/Storage/RLS), PostGIS untuk radius, deploy GH Pages (pola sekolah-sma: secrets SUPABASE_URL + ANON_KEY).
- Schema SQL ada di PRD §9 — nanti dipindah ke supabase/seed.sql saat eksekusi.