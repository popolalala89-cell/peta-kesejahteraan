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