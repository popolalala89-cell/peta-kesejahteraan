# PRD — Sistem Pemetaan Kesejahteraan & Kerentanan Warga

**Versi:** 1.0 (Draft untuk review)
**Tanggal:** 12 Agustus 2026
**Nama sementara:** Peta Kesejahteraan
**Status:** Menunggu keputusan terbuka (§19) sebelum eksekusi

---

## 1. Visi & Problem Statement

### 1.1 Problem

Penentuan penerima bantuan sosial / warga kurang mampu selama ini sering:
- Berdasarkan opini dan popularitas, bukan data.
- Tidak bisa diaudit — keputusan tanpa jejak.
- Rawan konflik antarwarga (iri, dendam, persaingan).
- Data mudah dipalsukan (foto lama, dokumen pinjaman).
- Privasi warga terabaikan (status ekonomi dibahas publik).

### 1.2 Solusi

Sistem berbasis **bukti + verifikasi komunitas** yang menghasilkan **dua skor terpisah**:

1. **Welfare Score (0–100)** — seberapa rentan kondisi ekonomi keluarga ini? (dihitung dari indikator ekonomi, BUKAN popularitas)
2. **Confidence Score (0–100)** — seberapa yakin sistem bahwa data tersebut benar? (kualitas bukti + verifikasi)

Output sistem bukan "orang ini miskin", melainkan:
> Estimasi tingkat kerentanan ekonomi: 82% · Kepercayaan data: 91% · Verifikasi komunitas: 37/42 warga · Status: Sangat Rentan · Terakhir diverifikasi: 12 Agustus 2026

### 1.3 Prinsip Desain (non-negotiable)

| # | Prinsip | Artinya |
|---|---------|---------|
| P1 | **Voting ≠ penentu kemiskinan** | Suara warga hanya jadi komponen *confidence*, tidak pernah mengubah *welfare score* |
| P2 | **Fakta / verifikasi / keputusan dipisah** | Tiga hal ini tidak boleh dicampur jadi satu angka |
| P3 | **Voting lokal saja** | Hanya warga dekat geografis yang bisa memverifikasi (radius berbobot) |
| P4 | **Kualitas > kuantitas** | Reputasi verifier menentukan bobot suara |
| P5 | **Anonim untuk publik** | Identitas voter disembunyikan; hanya petugas yang bisa audit |
| P6 | **Laporan ≠ hukuman instan** | Keberatan masuk investigasi dulu, data tidak langsung diubah/dihapus |
| P7 | **Privasi warga dijaga** | NIK/dokumen/telpon tidak pernah tampil publik |
| P8 | **Threshold bukan angka sakti** | Semua bobot & ambang batas hidup di tabel konfigurasi, bisa dikalibrasi per daerah |
| P9 | **Bahasa produk:** "Peta Kesejahteraan", bukan "peta orang miskin"** | Tujuan: menemukan yang butuh bantuan, bukan mempermalukan |

---

## 2. Scope

### 2.1 In Scope (MVP — Fase 1)

1. Auth & profil warga (Supabase Auth, role: warga / petugas / admin)
2. Registrasi keluarga (form bertahap: identitas → anggota → pekerjaan → aset → rumah → foto → dokumen)
3. Perhitungan Welfare Score & Confidence Score (RPC + snapshot)
4. Verifikasi tetangga (request tertarget, jawaban 4 pilihan + komentar moderasi)
5. Voting komunitas radius (100m / 500m / 1–2 km, bobot menurun) + penahanan suara mencurigakan
6. Dashboard petugas (daftar prioritas terurut otomatis, verifikasi lapangan, keputusan dokumen)
7. Halaman profil publik (masked, pakai Nomor Keluarga #KD-xxxx)
8. Peta agregasi per RT/RW (tanpa nama & detail sensitif)
9. Audit log (trigger database, view petugas/admin)
10. Mekanisme keberatan/laporan + alur investigasi
11. Tabel konfigurasi (bobot, radius, threshold, aturan anomali)

### 2.2 Not In MVP (Fase 2+)

- Integrasi data pemerintah/instansi (DTKS, pajak, dll) — butuh MoU & API pihak ketiga
- Notifikasi push realtime (WA gateway / web push)
- GIS peta interaktif (leaflet) di halaman publik
- Analytics & export laporan resmi
- Aplikasi Android native (Cordova/Capacitor)

---

## 3. Peran & Hak Akses (RBAC)

| Role | Bisa apa |
|------|----------|
| **warga** | Registrasi keluarga sendiri, upload bukti, request verifikasi tetangga, vote keluarga dalam radius, ajukan koreksi/keberatan/laporan, lihat profil publik, lihat reputasi sendiri |
| **petugas** | Semua hak warga + verifikasi lapangan, verifikasi dokumen/foto, melihat identitas voter (audit), memutus dispute, review suara yang ditahan, lihat dashboard prioritas |
| **admin** | Hak petugas + kelola pengguna/role, ubah tabel konfigurasi, lihat audit log penuh, kelola storage |

**Syarat voter:** akun harus sudah **terverifikasi petugas** (status `is_verified`) dan punya lokasi tersimpan. Akun baru yang belum disetujui tidak bisa vote.

---

## 4. Glossary

| Istilah | Definisi |
|---------|----------|
| **Household** | Satu keluarga (sesuai KK) yang didaftarkan |
| **Verifier** | Warga terverifikasi yang memberikan penilaian |
| **Verifikasi tetangga** | Penilaian yang DIMINTA pendaftar ke tetangga tertentu |
| **Voting komunitas** | Penilaian publik warga dalam radius |
| **HELD** | Suara ditahan (mencurigakan), belum dihitung sampai petugas review |
| **Confidence** | Keyakinan sistem terhadap kebenaran data (bukan "akurasi" — tidak ada kebenaran absolut) |

---

## 5. Model Skor

### 5.1 Welfare Score (kondisi ekonomi — tidak dipengaruhi suara)

Komponen & bobot default (hidup di tabel `config`, bisa dikalibrasi):

| Komponen | Bobot | Sumber data |
|----------|-------|-------------|
| Pendapatan keluarga | 25% | Penghasilan anggota vs UMK daerah |
| Stabilitas pekerjaan | 20% | Status pekerjaan + stabilitas + lama bekerja |
| Rasio tanggungan | 15% | Non-produktif (anak/lansia/disabilitas) vs produktif |
| Aset | 15% | Aset terdata; **aset produktif dinilai ringan** (motor tukang = alat cari nafkah) |
| Hunian | 15% | Kondisi/luas/kepadatan rumah |
| Akses dasar | 10% | Air bersih, listrik, sanitasi |

Tiap komponen diskor 0–100 → rata-rata terbobot → **Welfare Score**.

### 5.2 Confidence Score (kualitas data)

| Sumber | Bobot default |
|--------|---------------|
| Data pendaftar (kelengkapan + konsistensi) | 15% |
| Bukti dokumen (proporsi tervalidasi petugas) | 20% |
| Foto (jumlah, metadata valid, tervalidasi) | 15% |
| Verifikasi tetangga (konsensus × reputasi verifier) | 15% |
| Voting komunitas (rasio sesuai × bobot radius × reputasi) | 15% |
| Verifikasi petugas (field check) | 20% |

### 5.3 Band Status (default, kalibrasi per daerah)

| Rentang | Status |
|---------|--------|
| 0–20 | Sangat Rentan |
| 21–40 | Rentan |
| 41–60 | Menengah Bawah |
| 61–80 | Menengah |
| 81–100 | Relatif Mampu |

### 5.4 Contoh output

```
Welfare Score: 18/100 · Confidence: 93%
→ Kondisinya sangat rentan DAN datanya kuat → layak diproses bantuan.

Welfare Score: 18/100 · Confidence: 37%
→ Kemungkinan sangat rentan, tapi data belum bisa dipercaya
→ masuk prioritas verifikasi petugas (cek dulu sebelum keputusan).
```

> **Arah skala (penting):** Welfare Score SEMAKIN TINGGI = semakin MAMPU
> (81–100 Relatif Mampu, 0–20 Sangat Rentan — lihat band §5.3).
> Contoh di konsep awal ("kerentanan ekonomi 82% = sangat rentan") memakai
> arah terbalik; diseragamkan ke arah §5.3 agar konsisten dengan peta warna
> (🟢 sejahtera di atas, 🔴 prioritas bantuan di bawah).

### 5.5 Aturan bobot voting

| Radius | Bobot radius |
|--------|--------------|
| ≤ 100 m (tetangga terdekat) | 1.0 |
| ≤ 500 m (lingkungan) | 0.6 |
| ≤ 2 km (wilayah sekitar) | 0.3 |
| > 2 km | Tidak boleh vote |

Bobot efektif suara = `bobot_radius × (0.5 + rep_verifier/100)` dengan reputasi 0–100. Suara penyumbang `suspicion_flag = true` → status **HELD**, tidak ikut hitung sampai review petugas.

### 5.6 Reputasi verifier

- Mulai 50.0.
- Setelah verifikasi lapangan selesai, tiap suara dibandingkan hasil petugas: cocok → +2, meleset → −3 ( nilai di config).
- Rentang 0–100. Semakin akurat riwayat, semakin besar bobot (rumus §5.5).

---

## 6. Lapisan Verifikasi (7 lapis)

| Lapis | Sumber | Dipakai untuk |
|-------|--------|---------------|
| L1 | Data pendaftar | Welfare + Confidence |
| L2 | Bukti dokumen | Confidence + review dokumen |
| L3 | Foto kondisi aktual (timestamp + lokasi + ID verifikasi) | Confidence (+ anti foto lama) |
| L4 | Verifikasi tetangga (diminta) | Confidence |
| L5 | Voting komunitas (radius) | Confidence + deteksi anomali |
| L6 | Verifikasi petugas (lapangan) | Confidence + umpan balik reputasi |
| L7 | Data objektif pemerintah/instansi | Verifikasi silang (Fase 2) |

---

## 7. Alur Status Keluarga

```
DRAFT
  ↓ (pendaftar selesai isi + upload)
SUBMITTED
  ↓ (ada request verifikasi tetangga / auto saat eligible)
COMMUNITY_VERIFICATION
  ↓ (suara terkumpul, anomali reviewed)
DOCUMENT_VERIFICATION
  ↓ (petugas validasi dokumen & foto)
FIELD_VERIFICATION
  ↓ (petugas cek lapangan)
VERIFIED
  ↓ (berkala / saat data berubah)
MONITORING
```

Cabang: `NEED_REVISION` (dari SUBMITTED/DOCUMENT_VERIFICATION — pendaftar diminta perbaiki) dan `REJECTED` (≥ 3 kali gagal revisi atau keputusan petugas setelah investigasi). Transisi dicatat di `audit_log`.

---

## 8. Aturan Bisnis Detail

### 8.1 Deteksi anomali (sistem flag otomatis)

| Kode | Aturan (default, di config) |
|------|------------------------------|
| `BURST_NEW_ACCOUNTS` | ≥ 10 akun umur < 7 hari vote 1 household |
| `SAME_IP` | ≥ 3 suara dari IP sama dalam 24 jam |
| `SUSPICIOUS_DISTANCE` | voter terdeteksi > 5 km dari target saat vote |
| `MASS_VERIFY` | 1 akun > 20 verifikasi/hari |
| `INCONSISTENT` | delta skor > 25 poin dalam 7 hari |

Suara ter-flag → **HELD** + notifikasi petugas. Tidak otomatis dibuang — petugas yang memutuskan (DISCARD atau ACTIVE).

### 8.2 Keberatan / koreksi / laporan

| Tipe | Siapa | Efek |
|------|-------|------|
| `KOREKSI` | Keluarga itu sendiri | Masuk investigasi petugas, data diubah hanya setelah keputusan |
| `KEBERATAN` | Warga lain ("dituduh mampu padahal tidak") | Masuk investigasi, dilampiri bukti |
| `LAPORAN_PALSU` | Siapa pun dengan bukti | Status household → `INVESTIGATION`, TIDAK dihapus otomatis |

**Prinsip:** laporan → pemeriksaan → keputusan. Sistem yang gampang berubah karena laporan = senjata konflik.

### 8.3 Dashboard prioritas petugas (auto-rank)

RPC `officer_dashboard_priorities()` mengurutkan:
1. Welfare RENDAH (sangat rentan) + confidence rendah — data lemah untuk kasus paling butuh
2. Welfare rendah + banyak laporan terbuka
3. Data berubah drastis (delta skor besar)
4. Voting mencurigakan (HELD menumpuk)
5. Data tidak konsisten (foto vs deskripsi, anomaly flags)
6. Belum diverifikasi lama (> 90 hari)

Tujuan: petugas tidak periksa 10.000 keluarga buta — sistem bilang "periksa 87 ini dulu".

### 8.4 Privasi & masking

| Data | Perlakuan |
|------|-----------|
| NIK | Disimpan sebagai **hash** (pgcrypto); tidak pernah plaintext/tampil |
| No. telepon | Masking di tampilan apa pun: `08xx-xxxx-1234` |
| Foto | Storage bucket **privat**; publik hanya lihat badge "Foto ✓" |
| Dokumen | Storage privat; publik hanya lihat "Dokumen penghasilan telah diverifikasi ✓" |
| Identitas voter | Tersembunyi; hanya petugas atas izin audit (log siapa yang buka) |
| Nama kepala keluarga | Di profil publik diganti Nomor Keluarga `#KD-xxxxx`; nama tampil hanya untuk warga terverifikasi dalam radius 500 m |

---

## 9. Database Schema (PostgreSQL / Supabase)

> Business rules di atas dalam Bahasa Indonesia; schema teknis di bawah dalam Bahasa Inggris.

```sql
-- ═══════════════════════════════════════════════════
-- PETA KESEJAHTERAAN — schema v1.0
-- ═══════════════════════════════════════════════════
create extension if not exists postgis;      -- radius voting (geography point)
create extension if not exists pgcrypto;     -- hash NIK

-- ── Profil (relasi 1:1 ke auth.users) ──────────────────
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'warga'
             check (role in ('warga','petugas','admin')),
  nama       text not null,
  no_hp      text,
  nik_hash   text,                          -- hash NIK, tidak pernah plaintext
  lokasi     geography(point),              -- titik rumah voter (syarat radius)
  is_verified boolean not null default false, -- akun disetujui petugas → bisa vote
  verifier_reputation numeric(5,2) not null default 50.0,
  tenure_days int not null default 0,
  created_at timestamptz not null default now()
);

-- ── Keluarga ───────────────────────────────────────────
create table households (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profiles(id) on delete set null,
  no_kartu_keluarga text,
  nama_kepala text not null,
  alamat      text not null,
  rt text, rw text, kelurahan text, kecamatan text,
  lokasi      geography(point) not null,
  telepon     text,
  status_tempat_tinggal text,               -- milik sendiri / sewa / numpang / dinas
  jumlah_anggota int,
  status      text not null default 'DRAFT' check (status in
    ('DRAFT','SUBMITTED','COMMUNITY_VERIFICATION','DOCUMENT_VERIFICATION',
     'FIELD_VERIFICATION','VERIFIED','MONITORING','NEED_REVISION','REJECTED')),
  welfare_score    numeric(5,2),            -- snapshot hasil hitung
  confidence_score numeric(5,2),
  last_verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Anggota keluarga ───────────────────────────────────
create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nama text not null,
  nik_hash text,
  hubungan text,                            -- kepala / istri / anak / ortu / lain
  tanggal_lahir date,
  jenis_kelamin text,
  status text,                              -- anak_sekolah / lansia / disabilitas / bekerja / tidak_bekerja
  pekerjaan text,
  jenis_pekerjaan text,
  status_pekerjaan text,                    -- tetap / kontrak / harian / lepas / -
  penghasilan_bulanan numeric(12,2),
  stabilitas_penghasilan int check (stabilitas_penghasilan between 1 and 5),
  lama_bekerja_months int,
  pendidikan text
);

-- ── Kondisi rumah (1:1) ────────────────────────────────
create table house_conditions (
  household_id uuid primary key references households(id) on delete cascade,
  status text, luas_bangunan numeric(8,2), jumlah_kamar int,
  jenis_lantai text, jenis_dinding text, jenis_atap text,
  kondisi_bangunan int,                     -- 1–5
  sanitasi text, sumber_air text, sumber_listrik text,
  jumlah_penghuni int
);

-- ── Aset ───────────────────────────────────────────────
create table assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  jenis text,                               -- kendaraan / tanah / rumah_lain / usaha / mesin / ternak
  deskripsi text,
  nilai_est numeric(14,2),
  is_income_source boolean not null default false  -- aset produktif → bobot ringan
);

-- ── Bukti foto (timestamp + lokasi + uploader) ─────────
create table evidence_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kategori text,                            -- tampak_depan / ruang_utama / dapur / kamar_mandi / atap
  storage_path text not null,
  taken_at timestamptz not null,            -- dipaksa dari EXIF/device, bukan input bebas
  lat float, lon float,
  uploader_id uuid references profiles(id),
  verified boolean not null default false
);

-- ── Bukti dokumen ──────────────────────────────────────
create table evidence_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  jenis text,                               -- sktm / bukti_penghasilan / bukti_tanggungan / dll
  storage_path text not null,
  verification_status text not null default 'PENDING'
             check (verification_status in ('PENDING','VERIFIED','REJECTED')),
  verified_by uuid references profiles(id),
  verified_at timestamptz
);

-- ── Verifikasi (tetangga / komunitas / petugas) ────────
create table verifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  verifier_id  uuid not null references profiles(id),
  tipe text not null check (tipe in ('TETANGGA','KOMUNITAS','PETUGAS')),
  pertanyaan text not null,                 -- kunci pertanyaan
  jawaban text not null,                    -- SESUAI / SEBAGIAN / TIDAK / TIDAK_TAHU (atau ya/tidak)
  komentar text,
  bobot_radius   numeric(4,2),              -- diisi sistem saat submit
  bobot_reputasi numeric(4,2),              -- diisi sistem saat submit
  suspicion_flag boolean not null default false,
  status text not null default 'ACTIVE'
             check (status in ('ACTIVE','HELD','DISCARDED')),
  created_at timestamptz not null default now(),
  unique (household_id, verifier_id, tipe, pertanyaan)
);

-- ── Request verifikasi tetangga ────────────────────────
create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  invitee_id uuid references profiles(id),  -- null = broadcast radius terdekat
  status text not null default 'OPEN'
             check (status in ('OPEN','FULFILLED','EXPIRED')),
  created_at timestamptz not null default now()
);

-- ── Keberatan / koreksi / laporan ──────────────────────
create table disputes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  reporter_id uuid references profiles(id),
  tipe text not null check (tipe in ('KOREKSI','KEBERATAN','LAPORAN_PALSU')),
  alasan text not null,
  bukti_path text,
  status text not null default 'OPEN'
             check (status in ('OPEN','INVESTIGATION','RESOLVED','DISMISSED')),
  keputusan text,
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Flag anomali ───────────────────────────────────────
create table anomaly_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,                -- 'household' | 'profile'
  target_id uuid not null,
  kode text not null,                       -- BURST_NEW_ACCOUNTS / SAME_IP / SUSPICIOUS_DISTANCE / MASS_VERIFY / INCONSISTENT
  deskripsi text,
  status text not null default 'OPEN'
             check (status in ('OPEN','REVIEWED','DISMISSED')),
  created_at timestamptz not null default now()
);

-- ── Snapshot skor (riwayat perhitungan) ────────────────
create table score_snapshots (
  id bigserial primary key,
  household_id uuid not null references households(id),
  welfare numeric(5,2), confidence numeric(5,2),
  detail jsonb,                             -- rincian per komponen (untuk transparansi)
  computed_at timestamptz not null default now()
);

-- ── Konfigurasi (anti angka sakti) ─────────────────────
create table config (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
-- seed awal: welfare_weights, confidence_weights, radius_buckets,
--            threshold_bands, anomaly_rules, reputation_delta

-- ── Audit log (semua perubahan penting) ────────────────
create table audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,                     -- INSERT/UPDATE/STATUS_CHANGE/VOTE_HELD/DISPUTE_DECISION
  entity_type text not null, entity_id uuid not null,
  old_data jsonb, new_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
```

**RLS (ringkasan, detail di fase eksekusi):**

| Tabel | Policy inti |
|-------|-------------|
| `profiles` | User baca profil sendiri; petugas/admin baca semua; `nik_hash` hanya petugas |
| `households` | Owner tulis keluarga sendiri; petugas/admin tulis verifikasi; publik lewat fungsi masked |
| `verifications` | INSERT: voter terverifikasi + dalam radius; SELECT publik: agregasi saja (tanpa verifier_id) |
| `evidence_*` | Upload: owner + petugas; SELECT publik: count/badge saja |
| `disputes` | INSERT semua warga; RESOLVE hanya petugas |
| `audit_log` | INSERT oleh trigger; SELECT petugas/admin |
| `config` | READ publik (untuk transparansi bobot); WRITE admin |

---

## 10. API / RPC Inventory

| Fungsi | Method | Auth | Deskripsi |
|--------|--------|------|-----------|
| `register_household(jsonb)` | RPC | warga | Simpan DRAFT keluarga + anggota + aset + rumah |
| `submit_household(uuid)` | RPC | warga (owner) | DRAFT → SUBMITTED |
| `upload_evidence()` | Storage | warga (owner) | Foto/dokumen ke bucket privat |
| `request_neighbor_verification(uuid)` | RPC | warga | Buat verification_request |
| `submit_verification(uuid_household, tipe, pertanyaan, jawaban, komentar)` | RPC | warga terverifikasi | Validasi radius + reputasi + anomali → ACTIVE/HELD |
| `get_eligible_voters(uuid_household)` | RPC | publik | "82 warga sekitar memenuhi syarat" |
| `get_public_household(uuid)` | RPC | publik | Profil masked `#KD-xxxxx` + skor + ringkasan verifikasi |
| `map_aggregate(rt, rw)` | RPC | publik | Agregasi jumlah per band status |
| `officer_dashboard_priorities()` | RPC | petugas | Daftar prioritas auto-rank (§8.3) |
| `field_verify(uuid_household, hasil, catatan)` | RPC | petugas | Verifikasi lapangan + umpan reputasi verifier |
| `review_document(uuid_doc, status)` | RPC | petugas | VERIFIED/REJECTED |
| `review_held_vote(uuid_verif, keputusan)` | RPC | petugas | ACTIVE/DISCARDED + hapus flag |
| `file_dispute(tipe, alasan, bukti)` | RPC | warga | OPEN |
| `resolve_dispute(uuid, keputusan)` | RPC | petugas | RESOLVED/DISMISSED + efek data |
| `recalc_scores(uuid_household)` | RPC | trigger/petugas | Hitung ulang + snapshot |
| `get_my_reputation()` | RPC | warga | Skor + riwayat verifier sendiri |
| `audit_query(...)` | RPC | petugas/admin | Filter audit log |

---

## 11. UI/UX Design System

> Bahasa UI: **Indonesia**. Material 3, clean (tanpa garis/border kasar), modals + toast (TANPA alert/confirm/prompt), responsif HP (bottom-nav) & desktop (sidebar). Asset lokal, TANPA CDN.

### 11.1 Design tokens (CSS variables)

```css
:root {
  /* Warna */
  --primary: #00897B;          /* Teal 600 — kesejahteraan */
  --on-primary: #FFFFFF;
  --primary-container: #B2DFDB;
  --secondary: #388E3C;        /* Green 700 */
  --surface: #FBFDFC;
  --surface-container: #EFF5F3;
  --on-surface: #1A1C1B;
  --on-surface-variant: #49454F;

  /* Status warga */
  --band-relatif:   #2E7D32;   /* 🟢 Relatif Sejahtera */
  --band-rentan:    #F9A825;   /* 🟡 Rentan */
  --band-sangat:    #EF6C00;   /* 🟠 Sangat Rentan */
  --band-prioritas: #C62828;   /* 🔴 Prioritas Bantuan */

  /* Radius & elevasi */
  --radius-card: 12px;
  --radius-sheet: 16px;
  --shadow-1: 0 2px 8px rgba(0,0,0,.08);
  --shadow-2: 0 4px 16px rgba(0,0,0,.12);
}
```

### 11.2 ASCII mockup — halaman kunci

**Profil publik keluarga (masked):**

```
┌──────────────────────────────┐
│ ←  Keluarga #KD-10291        │
│    RT 03 / RW 02             │
│                              │
│  [🔴 Sangat Rentan]  ⚠️ 91% │   ← confidence
│  Terakhir diverifikasi:      │
│  12 Agustus 2026             │
│                              │
│  Indikator                   │
│  Pendapatan    🔴 Sangat rend│
│  Hunian        🔴 Kurang lay │
│  Tanggungan    🟠 Tinggi     │
│  Pekerjaan     🔴 Tidak stab │
│  Aset          🟢 Rendah     │
│                              │
│  Verifikasi                  │
│  📄 Dokumen ✓ 🖼 Foto ✓     │
│  👥 Tetangga ✓ 🌐 Komunitas │
│  🏢 Petugas ✓               │
│                              │
│  Verifikasi komunitas:       │
│  42 verifier                 │
│  🟢 37 sesuai  🟡 3  🔴 2   │
│  Community Confidence: 88%   │
│                              │
│  [Ikut Verifikasi (ℝ 100m)]  │
│  [Ajukan Koreksi]            │
└──────────────────────────────┘
```

**Registrasi keluarga (step progress):**

```
┌──────────────────────────────┐
│  Pendaftaran Keluarga  ●●●○  │  ← 4/8
│                              │
│  Kondisi Rumah               │
│  Status          [Milik ✔]   │
│  Luas bangunan   [____ m²]   │
│  Jumlah kamar    [__]        │
│  Lantai          [Keramik ✔] │
│  Dinding         [Tembok  ✔] │
│  Atap            [Genteng ✔] │
│  Sanitasi        [Layak  ✔]  │
│  Air             [PDAM   ✔]  │
│  Listrik         [PLN    ✔]  │
│                              │
│  📷 Foto wajib:              │
│  [Depan] [Ruang] [Dapur]     │
│  [KM]   [Atap]               │
│  ✓ 4/5 terunggah             │
│                              │
│      [← Kembali] [Lanjut →]  │
└──────────────────────────────┘
```

**Voting komunitas (sheet):**

```
┌──────────────────────────────┐
│  Verifikasi Keluarga #KD-1029│
│  Jarak Anda: 75 m (bobot 1.0)│
│                              │
│  Apakah kondisi ekonomi      │
│  keluarga ini sesuai info?   │
│  ( ) Sesuai                  │
│  ( ) Sebagian sesuai         │
│  ( ) Tidak sesuai            │
│  ( ) Tidak mengetahui        │
│                              │
│  Apakah keluarga ini sulit   │
│  memenuhi kebutuhan harian?  │
│  ( ) Ya  ( ) Tidak           │
│                              │
│  Catatan (opsional,          │
│  dimoderasi):                │
│  [______________________]    │
│                              │
│  🔒 Suara Anda anonim        │
│     [Kirim Verifikasi]       │
└──────────────────────────────┘
```

**Dashboard petugas (prioritas):**

```
┌──────────────────────────────┐
│  Dashboard Petugas           │
│  🔍 87 keluarga prioritas    │
│                              │
│  ┌─ Tabel prioritas ────────┐│
│  │ #  Keluarga   W  C  Alasan││
│  │ 1  #KD-0091  87 34  C rendah│
│  │ 2  #KD-0142  84 41  laporan │
│  │ 3  #KD-0007  79 22  drastis │
│  │ 4  #KD-0520  76 38  HELD x6 │
│  │ …                          ││
│  └───────────────────────────┘│
│  [Verifikasi Lapangan] [HELD] │
└──────────────────────────────┘
```

**Peta agregasi RT (publik):**

```
┌──────────────────────────────┐
│  Peta Kesejahteraan          │
│  [RT 03 / RW 02 ▾]           │
│                              │
│        ┌──────────────┐      │
│        │   [peta]     │      │
│        │  🟢🟡🟠🔴     │      │
│        │  titik warna │      │
│        └──────────────┘      │
│                              │
│  RT 03 — 87 keluarga         │
│  🟢 41 sejahtera             │
│  🟡 20 rentan                │
│  🟠 19 sangat rentan         │
│  🔴 7 prioritas bantuan      │
└──────────────────────────────┘
```

---

## 12. Keamanan & Privasi

1. **RLS ketat per tabel** — publik tidak pernah SELECT langsung; hanya lewat RPC masked.
2. **NIK di-hash** (pgcrypto `digest`); dipakai untuk dedupe & verifikasi petugas, bukan tampilan.
3. **Storage privat** — foto & dokumen di bucket privat; akses via signed URL ber-role (petugas). Publik hanya badge.
4. **Audit trail** — trigger menulis `audit_log` untuk: perubahan data, transisi status, keputusan dispute, review suara HELD, akses identitas voter oleh petugas.
5. **Anti-spoofing** — foto: `taken_at` dipaksa dari metadata EXIF/device (tidak menerima input waktu bebas); tetap diasumsikan bisa dipalsukan → verifikasi petugas adalah garda terakhir (bukan satu-satunya).
6. **Anonimitas** — voting tanpa identitas di tampilan publik; identitas bisa dibuka petugas dengan jejak audit.
7. **Rate-limit** — batas submit verifikasi/jam per akun (anti MASS_VERIFY di sisi API + flag di DB).
8. **RBAC server-side** — role diperiksa di RPC (Postgres function), bukan hanya sembunyikan tombol di UI.

---

## 13. Deployment & Infrastruktur

| Komponen | Pilihan | Catatan |
|----------|---------|---------|
| Frontend | React + TS + Vite | Pola sama dengan RumahKita / sekolah-sma; GH Pages CI (`popolalala89-cell/...`, secrets SUPABASE_URL + ANON_KEY) |
| Backend | Supabase (Postgres + Auth + Storage + RLS + RPC) | Free tier cukup untuk skala desa/RT (ratusan keluarga) |
| GIS | PostGIS extension | Sudah tersedia di Supabase; `geography(point)` untuk jarak radius |
| Foto/dokumen | Supabase Storage bucket privat | 1 GB free — cukup untuk ratusan keluarga (kompres foto sisi client) |
| Notifikasi | Fase 2 (WA gateway / web push) | Tidak masuk MVP |
| Asset | Lokal semua, tanpa CDN | Sesuai kendala internet Pa |

---

## 14. Konstanta (yang TIDAK berubah)

- Stack: React + TS + Vite + Supabase (Postgres/Auth/Storage/RLS), deploy GH Pages.
- Bahasa UI: Indonesia. Bahasa teknis (schema/RPC): Inggris.
- Design: Material 3 clean, modals+toast, sidebar desktop / bottom-nav HP, tanpa border garis.
- NIK tidak pernah plaintext di database maupun tampilan.
- Suara warga (voting) TIDAK PERNAH mengubah Welfare Score — hanya Confidence.
- Publik tidak pernah melihat detail pribadi; peta publik hanya agregasi.
- Threshold & bobot hidup di tabel `config` — tidak ada angka sakti di kode.
- Pelabelan produk: "Peta Kesejahteraan & Kerentanan" (bukan "peta orang miskin").
- Tidak ada fitur hapus data karena laporan — selalu lewat investigasi.

---

## 15. Roadmap

| Fase | Isi | Keluaran |
|------|-----|----------|
| **Fase 1 (MVP)** | Auth+Roles, registrasi berjenjang, skor (Welfare+Confidence), verifikasi tetangga, voting radius + HELD, dashboard petugas, profil publik masked, agregasi RT, audit log, config table | Sistem jalan end-to-end untuk 1 RT/RW uji coba |
| **Fase 2** | Reputasi verifier penuh, dispute/investigasi UI, anomaly dashboard, notifikasi, peta interaktif, moderasi komentar | Siap dipakai kelurahan |
| **Fase 3** | Integrasi data pemerintah, analytics/export, kalibrasi threshold per daerah, aplikasi Android | Skala kecamatan |

---

## 16. Keputusan Terbuka (wajib dijawab sebelum eksekusi)

1. **Cakupan uji coba:** RT/RW mana yang dipakai pilot? Berapa keluarga?
2. **Siapa petugasnya?** (RT/RW? kelurahan? karang taruna?) — menentukan akun awal & pelatihan.
3. **Registrasi NIK:** verifikasi otomatis ke sumber mana pun belum ada — apakah NIK cukup disimpan hash + dicek manual petugas di Fase 1?
4. **Kalibrasi threshold Welfare:** bobot awal di §5.1 dipakai apa mau disesuaikan dulu dengan kondisi daerah (UMK, harga sewa, dll)?
5. **Komentar moderasi:** siapa yang memoderasi komentar tetangga (petugas? admin?)?
6. **Kebutuhan offline:** apakah pendaftaran harus bisa jalan tanpa internet (kondisi sinyal di lokasi pilot)?

---

## 17. Referensi

- Konsep awal: ide Pa (diskusi 12 Agustus 2026) — "database warga miskin" → dikembangkan jadi sistem bukti + verifikasi komunitas.
- Struktur PRD mengikuti skill `documentation-first-development` (Phase 2: PRD First + Konstanta).