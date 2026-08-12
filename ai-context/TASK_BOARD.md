# TASK_BOARD — Peta Kesejahteraan

Urutan prioritas. Satu item in-progress maksimal.

## Sebelum koding (prasyarat)
- [ ] Pa menjawab 6 keputusan terbuka (lihat CURRENT_STATE → Blocker)

## Fase 1 — MVP
- [ ] `supabase/seed.sql`: schema (12 tabel) + extension PostGIS/pgcrypto + RLS + seed config (weights, radius_buckets, threshold_bands, anomaly_rules) + trigger audit_log
- [ ] Setup Supabase project: Auth (email+password, confirm email off), Storage bucket privat `evidence`
- [ ] Frontend scaffold: Vite + React + TS, routing, tema MD3 (design tokens PRD §11), layout responsive (sidebar/bottom-nav)
- [ ] Auth & profil: login, peran (warga/petugas/admin), lokasi GPS saat pendaftaran akun, status is_verified
- [ ] Registrasi keluarga multi-step (8 langkah: identitas → anggota → pekerjaan → aset → rumah → foto → dokumen → review)
- [ ] RPC skor: recalc_scores (Welfare + Confidence) + score_snapshots
- [ ] Verifikasi tetangga: request + jawaban 4 pilihan + komentar
- [ ] Voting komunitas: validasi radius + reputasi + anomali → ACTIVE/HELD
- [ ] Dashboard petugas: officer_dashboard_priorities() + verifikasi lapangan + review dokumen + review HELD
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