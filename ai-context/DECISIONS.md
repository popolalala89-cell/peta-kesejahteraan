# DECISIONS — Peta Kesejahteraan

Format: DEC-XXX. Tambahkan entri baru saat ada keputusan arsitektur.

## DEC-001 — Dua skor terpisah (Welfare + Confidence)

- **Date:** 2026-08-12
- **Decision:** Sistem menghasilkan dua skor berbeda: Welfare Score (kondisi ekonomi, dari indikator) dan Confidence Score (kualitas data, dari verifikasi). Tidak pernah digabung jadi satu angka.
- **Context:** Konsep Pa menekankan anti "lomba popularitas" — suara warga tidak boleh menentukan kemiskinan.
- **Alternatives considered:** Satu skor gabungan; status biner "miskin/tidak".
- **Consequences:** UI & dashboard menampilkan dua angka + band status; petugas bisa memilah "welfare tinggi + confidence rendah" → prioritas verifikasi.

## DEC-002 — Stack React + Vite + Supabase, deploy GH Pages

- **Date:** 2026-08-12
- **Decision:** Frontend React + TS + Vite di GH Pages (CI pakai secrets SUPABASE_URL + ANON_KEY, pola sekolah-sma). Backend Supabase: Postgres + Auth + Storage + RLS + RPC.
- **Context:** Konsisten dengan proyek Pa sebelumnya (RumahKita, sekolah-sma); free tier cukup untuk skala desa/RT; PostGIS tersedia.
- **Alternatives considered:** GAS (sheet tidak cocok untuk geografi/RLS); Flask LAN (butuh internet publik agar warga bisa akses).
- **Consequences:** Verifikasi-voting butuh internet (dicatat sebagai pertanyaan offline di keputusan terbuka); tidak ada biaya server.

## DEC-003 — Bobot & threshold di tabel config, bukan hardcode

- **Date:** 2026-08-12
- **Decision:** Semua bobot (welfare_weights, confidence_weights), radius_buckets, threshold_bands, dan anomaly_rules hidup di tabel `config` (jsonb). Kode membaca dari sana.
- **Context:** Prinsip P8 PRD — threshold harus bisa dikalibrasi per daerah, bukan angka sakti.
- **Alternatives considered:** Konstanta di kode frontend/backend.
- **Consequences:** Perubahan aturan = UPDATE config (admin), tanpa deploy; RPC skor harus cache/refetch config.

## DEC-004 — NIK di-hash (pgcrypto), tidak pernah plaintext

- **Date:** 2026-08-12
- **Decision:** Kolom `nik_hash` menyimpan hash NIK. Dipakai dedupe + verifikasi manual petugas. Tidak ada kolom NIK plaintext.
- **Context:** Privasi warga (P7). NIK = data paling sensitif.
- **Alternatives considered:** Enkripsi reversible (kunci di server), plaintext dengan RLS.
- **Consequences:** Tidak bisa verifikasi otomatis ke sumber eksternal tanpa plaintext — konsekuensi dicatat di keputusan terbuka #3.

## DEC-005 — Voting tidak pernah mengubah Welfare Score

- **Date:** 2026-08-12
- **Decision:** Verifikasi/voting hanya memengaruhi Confidence Score dan bisa memicu review (HELD/anomaly/dispute). Welfare Score murni dari indikator ekonomi terdata.
- **Context:** Prinsip P1 & P2 — mencegah sistem jadi alat konflik antarwarga.
- **Alternatives considered:** Skor gabungan dengan bobot suara.
- **Consequences:** Formulir data ekonomi harus lengkap dan akurat; pengaruh suara terlihat di Confidence saja.

## DEC-006 — Foto: taken_at dipaksa dari metadata perangkat, petugas garda terakhir

- **Date:** 2026-08-12
- **Decision:** Input waktu foto tidak menerima teks bebas; `taken_at` diambil dari EXIF/device saat upload. Tetap diasumsikan bisa dipalsukan (GPS spoof, foto lama diedit) — karenanya verifikasi lapangan petugas adalah penentu akhir.
- **Context:** PRD §6 L3 — anti foto lama dipakai ulang.
- **Alternatives considered:** Percaya input warga; watermark server-side (bisa di-crop).
- **Consequences:** Sedikit friction di upload (perlu metadata), tapi mencegah penyalahgunaan umum.

## DEC-007 — Pilot: 1 RT, ±50–100 keluarga

- **Date:** 2026-08-12
- **Decision:** Uji coba dimulai dari 1 RT (sekitar 50–100 keluarga). RT spesifik belum ditentukan Pa — contoh dokumen memakai RT 03 / RW 02.
- **Context:** Jawaban keputusan terbuka #1 (rekomendasi diterima).
- **Alternatives considered:** Langsung skala kelurahan.
- **Consequences:** Volume data kecil → mudah diaudit & dikalibrasi; struktur sudah siap skala karena berbasis Postgres.

## DEC-008 — Petugas: 1–2 pengurus RT/RW + Pa admin

- **Date:** 2026-08-12
- **Decision:** Akun petugas dipegang 1–2 orang pengurus RT/RW. Pa = admin (kelola config & pengguna).
- **Context:** Jawaban keputusan terbuka #2 (rekomendasi diterima).
- **Consequences:** Pembagian akun awal dilakukan manual oleh admin; role petugas tidak bisa self-register.

## DEC-009 — NIK: hash + verifikasi manual petugas (Fase 1)

- **Date:** 2026-08-12
- **Decision:** NIK disimpan sebagai hash (pgcrypto). Verifikasi keaslian dilakukan petugas secara manual saat field verification.
- **Context:** Jawaban keputusan terbuka #3 (rekomendasi diterima). Belum ada sumber verifikasi NIK otomatis.
- **Alternatives considered:** Integrasi Dukcapil (butuh MoU), plaintext + RLS.
- **Consequences:** Dedupe keluarga via hash match; integrasi otomatis ditunda ke Fase 3.

## DEC-010 — Bobot Welfare default dipakai, kalibrasi menyusul

- **Date:** 2026-08-12
- **Decision:** Bobot default PRD §5.1 (pendapatan 25%, pekerjaan 20%, tanggungan 15%, aset 15%, hunian 15%, akses dasar 10%) dipakai di Fase 1. Kalibrasi dilakukan setelah data pilot terkumpul (ubah tabel config, tanpa deploy).
- **Context:** Jawaban keputusan terbuka #4 (rekomendasi diterima).
- **Consequences:** Angka awal mungkin kurang presisi untuk daerah pilot — dikoreksi lewat config, dan setiap perubahan tercatat di audit_log.

## DEC-011 — Moderasi komentar oleh petugas

- **Date:** 2026-08-12
- **Decision:** Komentar pada verifikasi tetangga dimoderasi petugas (bukan admin). Komentar bermasalah bisa dihapus/ditandai.
- **Context:** Jawaban keputusan terbuka #5 (rekomendasi diterima).
- **Consequences:** Petugas butuh UI daftar komentar pending; kolom status moderasi ditambahkan di tabel verifications.

## DEC-012 — MVP online (tanpa mode offline)

- **Date:** 2026-08-12
- **Decision:** Fase 1 berjalan online (butuh internet). Mode offline tidak dikerjakan dulu.
- **Context:** Jawaban keputusan terbuka #6 (rekomendasi diterima).
- **Alternatives considered:** PWA + queue offline (kompleksitas tinggi).
- **Consequences:** Kalau sinyal di lokasi pilot ternyata bermasalah, keputusan ini dievaluasi ulang (dicatat di CURRENT_STATE).

## DEC-013 — Arah skala Welfare: semakin tinggi = semakin mampu

- **Date:** 2026-08-12
- **Decision:** Welfare Score 0–100 dengan arah: **semakin tinggi = semakin mampu** (band §5.3: 0–20 Sangat Rentan … 81–100 Relatif Mampu). Contoh di konsep awal ("welfare 82 = sangat rentan") tidak konsisten dengan band §22 konsep; diseragamkan ke band. Dashboard prioritas memakai "welfare RENDAH + confidence rendah" sebagai prioritas #1.
- **Context:** Kontradiksi internal pada dokumen konsep (§22 vs §23) ditemukan saat implementasi.
- **Consequences:** Semua komponen welfare (pendapatan, pekerjaan, tanggungan, aset, hunian, akses) diskor 0–100 dengan nilai tinggi = kondisi baik; map warna 🟢 untuk yang mampu.