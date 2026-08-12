# CHANGELOG — Peta Kesejahteraan

## [1.0.0] — 2026-08-12

### Added
- PRD.md v1.0 (17 seksi: visi, skor ganda, RBAC, schema SQL, RPC inventory, design system MD3, konstanta, roadmap, 6 keputusan terbuka).
- ai-context/ — 7 file: AGENTS.md (rules + Completion Gate), CURRENT_STATE.md, PROJECT_MEMORY.md, TASK_BOARD.md, DECISIONS.md (DEC-001..006), ERROR_HISTORY.md, LESSONS_LEARNED.md.
- CHANGELOG.md ini.

### Notes
- Repo GitHub dibuat & push: https://github.com/popolalala89-cell/peta-kesejahteraan (SSH, branch main).
- Belum ada kode. Menunggu jawaban 6 keputusan terbuka (CURRENT_STATE → Blocker) sebelum eksekusi MVP.

## [1.1.0] — 2026-08-12

### Changed
- 6 keputusan terbuka dijawab (semua pakai rekomendasi): pilot 1 RT, petugas RT/RW, NIK hash + manual, bobot default + kalibrasi menyusul, moderasi petugas, online tanpa offline. Tercatat DEC-007..012.

### Added
- supabase/seed.sql (sedang disusun): schema + config + trigger + RLS + RPC.
- Scaffold frontend Vite + React + TS (sedang disusun).

## [1.4.0] — 2026-08-12

### Added
- `supabase/migrate_02_verifikasi.sql`: submit_verification v2 (GPS live per-vote + kolom `voter_lokasi` + larang SELF_VOTE) + RPC `get_nearby_households` (daftar keluarga radius 2 km) + `get_held_votes` + `get_unreviewed_documents`.
- Halaman Verifikasi (warga): daftar keluarga di sekitar, jawab pertanyaan komunitas (dari config), komentar, hasil ACTIVE/HELD + pesan error ramah.
- Dashboard Petugas lengkap: prioritas otomatis + tombol verifikasi lapangan (update reputasi verifier) + sahkan/buang suara HELD + validasi dokumen.
- Menu "Verifikasi" di navigasi.

### Notes
- Wajib dijalankan Pa: `supabase/migrate_02_verifikasi.sql` (submit_verification v2 + 3 RPC baru).
- Tes voting butuh ≥2 akun (owner tidak bisa vote rumah sendiri — SELF_VOTE by design).

## [1.3.0] — 2026-08-12

### Added
- `supabase/migrate_01_registrasi.sql`: RPC `register_household` (transaksi atomik: households + members + house_conditions + assets + evidence_photos + evidence_documents → status SUBMITTED → recalc_scores; anti duplikat keluarga aktif) + RPC `get_my_household`.
- Form registrasi keluarga 8 langkah (Registrasi.tsx): identitas, anggota dinamis, aset, kondisi rumah, foto kamera wajib 5 kategori (upload ke bucket `evidence`, timestamp + GPS otomatis), dokumen opsional, review & kirim.
- Halaman Profil: card "Keluarga Anda" (kode KD-xxxxx, status, welfare/confidence, jumlah anggota) dari get_my_household.

### Notes
- Wajib dijalankan Pa di SQL Editor: `supabase/migrate_01_registrasi.sql` (2 fungsi).
- Bucket Storage privat `evidence` wajib dibuat sebelum upload foto jalan.

## [1.2.0] — 2026-08-12

### Added
- `supabase/seed.sql` v1.0: schema 12 tabel + index, config seed (bobot, radius, band, anomali, pertanyaan), trigger audit_log + guard transisi status, RLS lengkap, 13 RPC (recalc_scores, submit_verification dengan validasi radius/reputasi/anomali, dashboard prioritas, dispute, moderasi, dll), revoke akses langsung tabel sensitif.
- Scaffold frontend: Vite 8 + React 19 + TS, tema MD3 (design tokens PRD §11), layout sidebar/bottom-nav, auth login/daftar, toast system, halaman Beranda / Peta / Registrasi / Profil / Petugas.
- Workflow GH Pages (`.github/workflows/deploy.yml`, secrets `SUPABASE_URL` + `ANON_KEY`), README.md, .env.example, favicon custom.

### Changed
- PRD §5.4 & §8.3 + DEC-013: arah skala Welfare diseragamkan — semakin tinggi = semakin mampu; prioritas dashboard = welfare rendah + confidence rendah.

### Verified
- `npm run build` sukses: tsc -b 0 error, vite build 291ms.
- seed.sql BELUM dijalankan — menunggu Supabase project dari Pa.