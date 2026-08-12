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