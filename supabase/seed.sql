-- ═══════════════════════════════════════════════════════════════════════
-- PETA KESEJAHTERAAN — seed.sql v1.0
-- Jalankan di Supabase → SQL Editor (sekali jalan, urut dari atas).
-- Sumber kebenaran schema: PRD.md §9 + DEC-001..013.
--
-- ISI:
--   1. Extensions (postgis, pgcrypto)
--   2. Tabel (12) + index
--   3. Trigger: updated_at + audit_log
--   4. Seed tabel config (bobot, radius, band, aturan anomali, pertanyaan)
--   5. RLS: enable + policies
--   6. Helper + RPC functions (skor, voting, dashboard, dispute, dst)
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 2. TABEL
-- ─────────────────────────────────────────────────────────────

-- Profil (1:1 ke auth.users) — role: warga/petugas/admin
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'warga'
              check (role in ('warga','petugas','admin')),
  nama        text not null,
  no_hp       text,
  nik_hash    text,                            -- hash NIK, TIDAK pernah plaintext
  lokasi      geography(point),                -- titik rumah (syarat radius voting)
  is_verified boolean not null default false,  -- disetujui petugas → boleh vote
  verifier_reputation numeric(5,2) not null default 50.0,
  tenure_days int not null default 0,
  created_at  timestamptz not null default now()
);

-- Keluarga
create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profiles(id) on delete set null,
  no_kartu_keluarga text,
  nama_kepala text not null,
  alamat      text not null,
  rt text, rw text, kelurahan text, kecamatan text,
  lokasi      geography(point) not null,
  telepon     text,
  status_tempat_tinggal text,                  -- milik sendiri/sewa/numpang/dinas
  jumlah_anggota int,
  status      text not null default 'DRAFT' check (status in
    ('DRAFT','SUBMITTED','COMMUNITY_VERIFICATION','DOCUMENT_VERIFICATION',
     'FIELD_VERIFICATION','VERIFIED','MONITORING','NEED_REVISION','REJECTED')),
  welfare_score    numeric(5,2),               -- snapshot hasil hitung
  confidence_score numeric(5,2),
  last_verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Anggota keluarga
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nama text not null,
  nik_hash text,
  hubungan text,                               -- kepala/istri/anak/ortu/lain
  tanggal_lahir date,
  jenis_kelamin text,
  status text,                                 -- anak_sekolah/lansia/disabilitas/bekerja/tidak_bekerja
  pekerjaan text,
  jenis_pekerjaan text,
  status_pekerjaan text,                       -- tetap/kontrak/harian/lepas
  penghasilan_bulanan numeric(12,2),
  stabilitas_penghasilan int check (stabilitas_penghasilan between 1 and 5),
  lama_bekerja_months int,
  pendidikan text
);

-- Kondisi rumah (1:1)
create table if not exists house_conditions (
  household_id uuid primary key references households(id) on delete cascade,
  status text,
  luas_bangunan numeric(8,2),
  jumlah_kamar int,
  jenis_lantai text,
  jenis_dinding text,
  jenis_atap text,
  kondisi_bangunan int check (kondisi_bangunan between 1 and 5),
  sanitasi text,                               -- layak/tidak_layak
  sumber_air text,                             -- pdam/sumur/sungai/lain
  sumber_listrik text,                         -- pln/non_pln/tidak
  jumlah_penghuni int
);

-- Aset
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  jenis text,                                  -- kendaraan/tanah/rumah_lain/usaha/mesin/ternak
  deskripsi text,
  nilai_est numeric(14,2),
  is_income_source boolean not null default false  -- aset produktif → bobot ringan
);

-- Bukti foto
create table if not exists evidence_photos (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  kategori text,                               -- tampak_depan/ruang_utama/dapur/kamar_mandi/atap
  storage_path text not null,
  taken_at timestamptz not null,               -- dari metadata device (DEC-006)
  lat float, lon float,
  uploader_id uuid references profiles(id),
  verified boolean not null default false
);

-- Bukti dokumen
create table if not exists evidence_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  jenis text,                                  -- sktm/bukti_penghasilan/bukti_tanggungan/dll
  storage_path text not null,
  verification_status text not null default 'PENDING'
             check (verification_status in ('PENDING','VERIFIED','REJECTED')),
  verified_by uuid references profiles(id),
  verified_at timestamptz
);

-- Verifikasi (tetangga/komunitas/petugas) + moderasi komentar (DEC-011)
create table if not exists verifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  verifier_id  uuid not null references profiles(id),
  tipe text not null check (tipe in ('TETANGGA','KOMUNITAS','PETUGAS')),
  pertanyaan text not null,                    -- key pertanyaan (lihat config verification_questions)
  jawaban text not null,                       -- SESUAI/SEBAGIAN/TIDAK/TIDAK_TAHU atau YA/TIDAK
  komentar text,
  moderation_status text not null default 'PENDING'
             check (moderation_status in ('PENDING','APPROVED','REJECTED')),
  moderated_by uuid references profiles(id),
  moderated_at timestamptz,
  bobot_radius   numeric(4,2),                 -- diisi sistem saat submit
  bobot_reputasi numeric(4,2),                 -- diisi sistem saat submit
  suspicion_flag boolean not null default false,
  status text not null default 'ACTIVE'
             check (status in ('ACTIVE','HELD','DISCARDED')),
  created_at timestamptz not null default now(),
  unique (household_id, verifier_id, tipe, pertanyaan)
);

-- Request verifikasi tetangga
create table if not exists verification_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  invitee_id uuid references profiles(id),     -- null = broadcast radius terdekat
  status text not null default 'OPEN'
             check (status in ('OPEN','FULFILLED','EXPIRED')),
  created_at timestamptz not null default now()
);

-- Keberatan/koreksi/laporan
create table if not exists disputes (
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

-- Flag anomali
create table if not exists anomaly_flags (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,                   -- 'verification' | 'household' | 'profile'
  target_id uuid not null,
  kode text not null,                          -- BURST_NEW_ACCOUNTS/SAME_IP/SUSPICIOUS_DISTANCE/MASS_VERIFY/INCONSISTENT/SUSPICIOUS_VOTE
  deskripsi text,
  status text not null default 'OPEN'
             check (status in ('OPEN','REVIEWED','DISMISSED')),
  created_at timestamptz not null default now()
);

-- Snapshot skor (riwayat perhitungan)
create table if not exists score_snapshots (
  id bigserial primary key,
  household_id uuid not null references households(id),
  welfare numeric(5,2),
  confidence numeric(5,2),
  detail jsonb,                                -- rincian per komponen
  computed_at timestamptz not null default now()
);

-- Konfigurasi (anti angka sakti — DEC-003)
create table if not exists config (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- Audit log
create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

-- Index
create index if not exists idx_households_rt_rw on households (rt, rw);
create index if not exists idx_households_owner on households (owner_id);
create index if not exists idx_members_household on household_members (household_id);
create index if not exists idx_verif_household on verifications (household_id);
create index if not exists idx_verif_verifier_time on verifications (verifier_id, created_at);
create index if not exists idx_disputes_household on disputes (household_id);
create index if not exists idx_snapshots_household_time on score_snapshots (household_id, computed_at desc);
create index if not exists idx_profiles_verified on profiles (is_verified);
create index if not exists idx_profiles_lokasi on profiles using gist (lokasi);
create index if not exists idx_households_lokasi on households using gist (lokasi);

-- ─────────────────────────────────────────────────────────────
-- 3. TRIGGER: updated_at + audit_log
-- ─────────────────────────────────────────────────────────────

create or replace function fn_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_households_updated on households;
create trigger trg_households_updated
  before update on households
  for each row execute function fn_set_updated_at();

-- Guard transisi status: pemilik hanya boleh DRAFT → SUBMITTED;
-- status lain & last_verified_at hanya petugas/admin (anti self-verify).
create or replace function fn_household_update_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status
     or new.last_verified_at is distinct from old.last_verified_at then
    if coalesce(auth_role() in ('petugas','admin'), false) then
      return new;
    elsif auth.uid() = old.owner_id and old.status = 'DRAFT' and new.status = 'SUBMITTED' then
      return new;
    else
      raise exception 'STATUS_CHANGE_FORBIDDEN';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_households_guard on households;
create trigger trg_households_guard
  before update on households
  for each row execute function fn_household_update_guard();

create or replace function fn_audit() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_entity uuid := coalesce((to_jsonb(new) ->> 'id')::uuid, (to_jsonb(old) ->> 'id')::uuid);
begin
  insert into audit_log(actor_id, action, entity_type, entity_id, old_data, new_data)
  values (
    v_actor, TG_OP, TG_TABLE_NAME, v_entity,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end $$;

-- Trigger audit pada tabel penting (dengan kolom id)
do $$
declare t text;
begin
  foreach t in array array['profiles','households','verifications','disputes',
                          'evidence_documents','evidence_photos','anomaly_flags','config'] loop
    execute format('drop trigger if exists trg_audit_%s on %s', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on %s
                    for each row execute function fn_audit()', t, t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. SEED CONFIG (semua angka hidup di sini — DEC-003)
-- ─────────────────────────────────────────────────────────────

insert into config (key, value) values
-- Bobot komponen Welfare (DEC-010: default, kalibrasi menyusul)
('welfare_weights', '{"pendapatan":25,"pekerjaan":20,"tanggungan":15,"aset":15,"hunian":15,"akses_dasar":10}'::jsonb),
-- Bobot sumber Confidence
('confidence_weights', '{"data_pendaftar":15,"dokumen":20,"foto":15,"tetangga":15,"komunitas":15,"petugas":20}'::jsonb),
-- Bucket radius voting (meter → bobot)
('radius_buckets', '{"100":1.0,"500":0.6,"2000":0.3}'::jsonb),
-- Band status Welfare (arah: tinggi = mampu — DEC-013)
('threshold_bands', '[
  {"min":0,"max":20,"label":"Sangat Rentan","warna":"#C62828"},
  {"min":21,"max":40,"label":"Rentan","warna":"#EF6C00"},
  {"min":41,"max":60,"label":"Menengah Bawah","warna":"#F9A825"},
  {"min":61,"max":80,"label":"Menengah","warna":"#9E9D24"},
  {"min":81,"max":100,"label":"Relatif Mampu","warna":"#2E7D32"}
]'::jsonb),
-- Aturan anomali
('anomaly_rules', '{
  "burst_new_accounts": {"days":7,"count":10},
  "mass_verify": {"per_day":20},
  "suspicious_distance": {"meters":5000}
}'::jsonb),
-- Delta reputasi verifier
('reputation_delta', '{"match":2,"miss":-3}'::jsonb),
-- Umum
('general', '{
  "umk":3000000,
  "confidence_verified_threshold":70,
  "stale_days":90,
  "household_open_status":["SUBMITTED","COMMUNITY_VERIFICATION"]
}'::jsonb),
-- Daftar pertanyaan verifikasi (key dipakai di kolom pertanyaan)
('verification_questions', '[
  {"key":"kondisi_ekonomi_sesuai","tipe":["TETANGGA","KOMUNITAS"],"label":"Apakah kondisi ekonomi keluarga ini sesuai dengan informasi yang diberikan?","opsi":["SESUAI","SEBAGIAN","TIDAK","TIDAK_TAHU"]},
  {"key":"kesulitan_harian","tipe":["TETANGGA","KOMUNITAS"],"label":"Apakah keluarga ini mengalami kesulitan memenuhi kebutuhan sehari-hari?","opsi":["YA","TIDAK","TIDAK_TAHU"]},
  {"key":"pekerjaan_tetap","tipe":["TETANGGA"],"label":"Apakah kepala keluarga memiliki pekerjaan tetap?","opsi":["YA","TIDAK","TIDAK_TAHU"]},
  {"key":"rumah_sesuai","tipe":["TETANGGA"],"label":"Apakah kondisi rumah sesuai dengan yang ditampilkan?","opsi":["YA","TIDAK","TIDAK_TAHU"]},
  {"key":"aset_tersembunyi","tipe":["TETANGGA"],"label":"Apakah keluarga memiliki usaha/aset yang belum dicantumkan?","opsi":["YA","TIDAK","TIDAK_TAHU"]}
]'::jsonb)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5. RLS
-- ─────────────────────────────────────────────────────────────

-- Helper role (security definer → tidak memicu rekursi RLS)
create or replace function auth_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select p.role from profiles p where p.id = auth.uid();
$$;

create or replace function is_officer() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(auth_role() in ('petugas','admin'), false);
$$;

create or replace function is_verified_voter() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_verified from profiles where id = auth.uid()), false);
$$;

alter table profiles enable row level security;
alter table households enable row level security;
alter table household_members enable row level security;
alter table house_conditions enable row level security;
alter table assets enable row level security;
alter table evidence_photos enable row level security;
alter table evidence_documents enable row level security;
alter table verifications enable row level security;
alter table verification_requests enable row level security;
alter table disputes enable row level security;
alter table anomaly_flags enable row level security;
alter table score_snapshots enable row level security;
alter table config enable row level security;
alter table audit_log enable row level security;

-- PROFILES
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select using (
  id = auth.uid() or is_officer()
);
drop policy if exists profiles_insert on profiles;
create policy profiles_insert on profiles for insert with check (
  auth.uid() = id and role = 'warga'
);
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (
  id = auth.uid() or is_officer()
) with check (
  (id = auth.uid() and role = 'warga') or is_officer()
);

-- HOUSEHOLDS
drop policy if exists households_select on households;
create policy households_select on households for select using (
  owner_id = auth.uid() or is_officer()
);
drop policy if exists households_insert on households;
create policy households_insert on households for insert with check (
  owner_id = auth.uid()
);
drop policy if exists households_update on households;
create policy households_update on households for update using (
  owner_id = auth.uid() or is_officer()
) with check (
  owner_id = auth.uid() or is_officer()
);
drop policy if exists households_delete on households;
create policy households_delete on households for delete using (
  owner_id = auth.uid() and status = 'DRAFT'
);

-- CHILD TABLES (anggota, kondisi rumah, aset, bukti) — mengikuti akses household
drop policy if exists members_select on household_members;
create policy members_select on household_members for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);
drop policy if exists members_insert on household_members;
create policy members_insert on household_members for insert with check (
  exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
);
drop policy if exists members_update on household_members;
create policy members_update on household_members for update using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);

drop policy if exists hc_select on house_conditions;
create policy hc_select on house_conditions for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);
drop policy if exists hc_insert on house_conditions;
create policy hc_insert on house_conditions for insert with check (
  exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
);
drop policy if exists hc_update on house_conditions;
create policy hc_update on house_conditions for update using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);

drop policy if exists assets_select on assets;
create policy assets_select on assets for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);
drop policy if exists assets_insert on assets;
create policy assets_insert on assets for insert with check (
  exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
);
drop policy if exists assets_update on assets;
create policy assets_update on assets for update using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);

drop policy if exists photos_select on evidence_photos;
create policy photos_select on evidence_photos for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);
drop policy if exists photos_insert on evidence_photos;
create policy photos_insert on evidence_photos for insert with check (
  exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
);
drop policy if exists photos_update on evidence_photos;
create policy photos_update on evidence_photos for update using (
  is_officer()
);

drop policy if exists docs_select on evidence_documents;
create policy docs_select on evidence_documents for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);
drop policy if exists docs_insert on evidence_documents;
create policy docs_insert on evidence_documents for insert with check (
  exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
);
drop policy if exists docs_update on evidence_documents;
create policy docs_update on evidence_documents for update using (
  is_officer()
);

-- VERIFICATIONS — insert lewat RPC submit_verification (validasi radius dll).
-- SELECT langsung: owner household + petugas; publik hanya lewat RPC get_public_household.
drop policy if exists verif_select on verifications;
create policy verif_select on verifications for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
  or verifier_id = auth.uid()
);
drop policy if exists verif_insert on verifications;
create policy verif_insert on verifications for insert with check (
  (is_verified_voter() and tipe in ('TETANGGA','KOMUNITAS')) or (is_officer() and tipe = 'PETUGAS')
);
drop policy if exists verif_update on verifications;
create policy verif_update on verifications for update using (
  verifier_id = auth.uid() or is_officer()
);

-- VERIFICATION_REQUESTS
drop policy if exists vreq_select on verification_requests;
create policy vreq_select on verification_requests for select using (
  invitee_id = auth.uid()
  or exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);
drop policy if exists vreq_insert on verification_requests;
create policy vreq_insert on verification_requests for insert with check (
  exists (select 1 from households h where h.id = household_id and h.owner_id = auth.uid())
);

-- DISPUTES
drop policy if exists disputes_select on disputes;
create policy disputes_select on disputes for select using (
  reporter_id = auth.uid() or is_officer()
);
drop policy if exists disputes_insert on disputes;
create policy disputes_insert on disputes for insert with check (
  auth.uid() = reporter_id
);
drop policy if exists disputes_update on disputes;
create policy disputes_update on disputes for update using (
  is_officer()
);

-- ANOMALY_FLAGS — insert oleh sistem (RPC/trigger, security definer); baca petugas
drop policy if exists flags_select on anomaly_flags;
create policy flags_select on anomaly_flags for select using (
  is_officer()
);

-- SCORE_SNAPSHOTS
drop policy if exists snaps_select on score_snapshots;
create policy snaps_select on score_snapshots for select using (
  exists (select 1 from households h where h.id = household_id and (h.owner_id = auth.uid() or is_officer()))
);

-- CONFIG — baca publik (transparansi bobot), tulis admin
drop policy if exists config_select on config;
create policy config_select on config for select using (true);
drop policy if exists config_update on config;
create policy config_update on config for update using (
  coalesce(auth_role() = 'admin', false)
);

-- AUDIT_LOG — insert trigger (definer), baca petugas/admin
drop policy if exists audit_select on audit_log;
create policy audit_select on audit_log for select using (
  is_officer()
);

-- ─────────────────────────────────────────────────────────────
-- 6. HELPER + RPC FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- Baca config (internal; definer supaya aman dari RLS)
create or replace function get_config(p_key text) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select value from config where key = p_key;
$$;

-- ── recalc_scores: hitung Welfare + Confidence, simpan snapshot ──
create or replace function recalc_scores(p_household uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_hh households%rowtype;
  v_w jsonb := get_config('welfare_weights');
  v_c jsonb := get_config('confidence_weights');
  v_gen jsonb := get_config('general');
  v_umk numeric := coalesce((v_gen->>'umk')::numeric, 3000000);

  -- welfare components
  c_pendapatan numeric := 0; c_pekerjaan numeric := 0; c_tanggungan numeric := 50;
  c_aset numeric := 0; c_hunian numeric := 50; c_akses numeric := 50;
  w_pendapatan numeric := coalesce((v_w->>'pendapatan')::numeric, 25);
  w_pekerjaan numeric := coalesce((v_w->>'pekerjaan')::numeric, 20);
  w_tanggungan numeric := coalesce((v_w->>'tanggungan')::numeric, 15);
  w_aset numeric := coalesce((v_w->>'aset')::numeric, 15);
  w_hunian numeric := coalesce((v_w->>'hunian')::numeric, 15);
  w_akses numeric := coalesce((v_w->>'akses_dasar')::numeric, 10);
  v_welfare numeric;
  v_total_pendapatan numeric := 0;
  v_status_skor numeric := 0; v_stab_skor numeric := 0; v_n_kerja int := 0;
  v_dep int := 0; v_prod int := 0;
  v_nilai_aset numeric := 0;

  -- confidence components
  c_data numeric; c_dok numeric; c_foto numeric;
  c_tetangga numeric := 0; c_komunitas numeric := 0; c_petugas numeric := 0;
  w_data numeric := coalesce((v_c->>'data_pendaftar')::numeric, 15);
  w_dok numeric := coalesce((v_c->>'dokumen')::numeric, 20);
  w_foto numeric := coalesce((v_c->>'foto')::numeric, 15);
  w_tetangga numeric := coalesce((v_c->>'tetangga')::numeric, 15);
  w_komunitas numeric := coalesce((v_c->>'komunitas')::numeric, 15);
  w_petugas numeric := coalesce((v_c->>'petugas')::numeric, 20);
  v_confidence numeric;
  v_req_fields int := 0; v_filled int := 0;
  v_rep_avg numeric := 0; v_rad_avg numeric := 0; v_cons numeric := 0;
  v_hc house_conditions%rowtype;
  v_air numeric; v_listrik numeric; v_sanitasi numeric;
begin
  select * into v_hh from households where id = p_household;
  if not found then return; end if;

  -- ===== WELFARE =====
  -- 1. Pendapatan: total penghasilan anggota vs UMK (rasio 100% UMK = 100)
  select coalesce(sum(penghasilan_bulanan), 0) into v_total_pendapatan
  from household_members where household_id = p_household;
  c_pendapatan := least(100, round((v_total_pendapatan / nullif(v_umk,0) * 100)::numeric, 2));

  -- 2. Pekerjaan: rata-rata (status_pekerjaan*70% + stabilitas*30%)
  select coalesce(avg(case status_pekerjaan
        when 'tetap' then 100 when 'kontrak' then 70
        when 'harian' then 45 when 'lepas' then 25 else 0 end), 0),
         coalesce(avg(stabilitas_penghasilan * 20), 0),
         count(*)
  into v_status_skor, v_stab_skor, v_n_kerja
  from household_members where household_id = p_household and status = 'bekerja';
  if v_n_kerja > 0 then
    c_pekerjaan := round((v_status_skor * 0.7 + v_stab_skor * 0.3)::numeric, 2);
  end if;

  -- 3. Tanggungan: rasio dependen vs total (semakin banyak dependen → makin rentan)
  select count(*) filter (where status in ('anak_sekolah','lansia','disabilitas','tidak_bekerja')),
         count(*) filter (where status = 'bekerja')
  into v_dep, v_prod
  from household_members where household_id = p_household;
  if (v_dep + v_prod) > 0 then
    c_tanggungan := round((100 - (v_dep::numeric / (v_dep + v_prod)) * 100)::numeric, 2);
  end if;

  -- 4. Aset: nilai aset (aset produktif dihitung 50%) vs 12x UMK = 100
  select coalesce(sum(case when is_income_source then nilai_est * 0.5 else nilai_est end), 0)
  into v_nilai_aset from assets where household_id = p_household;
  c_aset := least(100, round((v_nilai_aset / nullif(v_umk * 12, 0) * 100)::numeric, 2));

  -- 5. Hunian: rata-rata nilai lantai/dinding/atap
  select * into v_hc from house_conditions where household_id = p_household;
  if found then
    c_hunian := round((
        coalesce(case v_hc.jenis_lantai when 'tanah' then 20 when 'semen' then 40 when 'keramik' then 85 else 50 end, 50)
      + coalesce(case v_hc.jenis_dinding when 'bambu' then 30 when 'papan' then 50 when 'tembok' then 90 else 50 end, 50)
      + coalesce(case v_hc.jenis_atap when 'rumbia' then 30 when 'seng' then 60 when 'genteng' then 90 else 50 end, 50)
      + coalesce(v_hc.kondisi_bangunan * 20, 60)
    ) / 4.0, 2);
    -- 6. Akses dasar
    v_air := coalesce(case v_hc.sumber_air when 'pdam' then 100 when 'sumur' then 70 when 'sungai' then 20 else 50 end, 50);
    v_listrik := coalesce(case v_hc.sumber_listrik when 'pln' then 100 when 'non_pln' then 40 when 'tidak' then 0 else 50 end, 50);
    v_sanitasi := coalesce(case v_hc.sanitasi when 'layak' then 100 when 'tidak_layak' then 30 else 50 end, 50);
    c_akses := round(((v_air + v_listrik + v_sanitasi) / 3.0)::numeric, 2);
  end if;

  v_welfare := round(
    (c_pendapatan * w_pendapatan + c_pekerjaan * w_pekerjaan + c_tanggungan * w_tanggungan +
     c_aset * w_aset + c_hunian * w_hunian + c_akses * w_akses) / 100.0, 2);

  -- ===== CONFIDENCE =====
  -- data pendaftar: kelengkapan field wajib
  v_req_fields := 8;
  v_filled := (case when v_hh.no_kartu_keluarga is not null then 1 else 0 end)
            + (case when v_hh.nama_kepala is not null then 1 else 0 end)
            + (case when v_hh.alamat is not null then 1 else 0 end)
            + (case when v_hh.rt is not null then 1 else 0 end)
            + (case when v_hh.telepon is not null then 1 else 0 end)
            + (case when v_hh.status_tempat_tinggal is not null then 1 else 0 end)
            + (case when v_hh.jumlah_anggota is not null then 1 else 0 end)
            + (case when exists (select 1 from household_members m where m.household_id = p_household) then 1 else 0 end);
  c_data := round((v_filled::numeric / v_req_fields) * 100, 2);

  -- dokumen
  select case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where verification_status = 'VERIFIED') / count(*), 2) end
  into c_dok from evidence_documents where household_id = p_household;

  -- foto
  select case when count(*) = 0 then 0
              else round(100.0 * count(*) filter (where verified) / count(*), 2) end
  into c_foto from evidence_photos where household_id = p_household;

  -- tetangga: konsensus (SESUAI/YA=100, SEBAGIAN=50, TIDAK_TAHU=50, TIDAK=0) × reputasi rata-rata
  select coalesce(avg(case when jawaban in ('SESUAI','YA') then 100
                           when jawaban in ('SEBAGIAN','TIDAK_TAHU') then 50 else 0 end), 0),
         coalesce(avg(bobot_reputasi), 0)
  into v_cons, v_rep_avg
  from verifications where household_id = p_household and tipe = 'TETANGGA' and status = 'ACTIVE';
  c_tetangga := round(least(100.0, v_cons * coalesce(v_rep_avg, 0))::numeric, 2);

  -- komunitas: konsensus × bobot radius rata-rata × reputasi rata-rata (cap 100)
  select coalesce(avg(case when jawaban in ('SESUAI','YA') then 100
                           when jawaban in ('SEBAGIAN','TIDAK_TAHU') then 50 else 0 end), 0),
         coalesce(avg(bobot_radius), 0), coalesce(avg(bobot_reputasi), 0)
  into v_cons, v_rad_avg, v_rep_avg
  from verifications where household_id = p_household and tipe = 'KOMUNITAS' and status = 'ACTIVE';
  c_komunitas := round(least(100.0, v_cons * coalesce(v_rad_avg, 0) * coalesce(v_rep_avg, 0))::numeric, 2);

  -- petugas: verifikasi lapangan selesai
  c_petugas := case when v_hh.status in ('VERIFIED','MONITORING') then 100
                    when v_hh.status = 'FIELD_VERIFICATION' then 60 else 0 end;

  v_confidence := round(
    (c_data * w_data + c_dok * w_dok + c_foto * w_foto +
     c_tetangga * w_tetangga + c_komunitas * w_komunitas + c_petugas * w_petugas) / 100.0, 2);

  update households
     set welfare_score = v_welfare, confidence_score = v_confidence, updated_at = now()
   where id = p_household;

  insert into score_snapshots (household_id, welfare, confidence, detail)
  values (p_household, v_welfare, v_confidence, jsonb_build_object(
    'welfare', jsonb_build_object(
      'pendapatan', c_pendapatan, 'pekerjaan', c_pekerjaan, 'tanggungan', c_tanggungan,
      'aset', c_aset, 'hunian', c_hunian, 'akses_dasar', c_akses),
    'confidence', jsonb_build_object(
      'data_pendaftar', c_data, 'dokumen', c_dok, 'foto', c_foto,
      'tetangga', c_tetangga, 'komunitas', c_komunitas, 'petugas', c_petugas)));
end $$;

-- ── submit_verification: validasi radius + reputasi + anomali → ACTIVE/HELD ──
create or replace function submit_verification(
  p_household uuid,
  p_tipe text,
  p_pertanyaan text,
  p_jawaban text,
  p_komentar text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof profiles%rowtype;
  v_hh households%rowtype;
  v_dist float;
  v_buckets jsonb := get_config('radius_buckets');
  v_anom jsonb := get_config('anomaly_rules');
  v_radius_w numeric(4,2);
  v_rep_w numeric(4,2);
  v_susp boolean := false;
  v_age_days int;
  v_burst int := 0;
  v_mass int := 0;
  v_new_id uuid;
  v_alasan text := '';
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_prof from profiles where id = v_uid;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  if p_tipe = 'PETUGAS' then
    if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  else
    if not v_prof.is_verified then raise exception 'VERIFIER_NOT_VERIFIED'; end if;
  end if;

  select * into v_hh from households where id = p_household;
  if not found then raise exception 'HOUSEHOLD_NOT_FOUND'; end if;
  if v_hh.status in ('DRAFT','REJECTED') then raise exception 'HOUSEHOLD_NOT_OPEN'; end if;

  if v_prof.lokasi is null or v_hh.lokasi is null then raise exception 'LOCATION_MISSING'; end if;
  v_dist := st_distance(v_prof.lokasi, v_hh.lokasi);

  -- bobot radius
  if v_dist <= 100 then v_radius_w := (v_buckets->>'100')::numeric;
  elsif v_dist <= 500 then v_radius_w := (v_buckets->>'500')::numeric;
  elsif v_dist <= 2000 then v_radius_w := (v_buckets->>'2000')::numeric;
  else
    -- undangan tetangga boleh sampai batas suspicious_distance, bobot terendah + flag
    if p_tipe = 'TETANGGA'
       and v_dist <= coalesce((v_anom->'suspicious_distance'->>'meters')::float, 5000) then
      v_radius_w := (v_buckets->>'2000')::numeric;
      v_susp := true;
      v_alasan := v_alasan || 'JARAK_JAUH(' || round(v_dist)::text || 'm); ';
    else
      raise exception 'OUT_OF_RANGE';
    end if;
  end if;

  -- bobot reputasi (0.5 + rep/100)
  v_rep_w := round((0.5 + v_prof.verifier_reputation / 100)::numeric, 4);

  -- anomali
  v_age_days := greatest(0, extract(day from now() - v_prof.created_at)::int);
  if p_tipe <> 'PETUGAS' then
    -- burst akun baru
    if v_age_days <= (v_anom->'burst_new_accounts'->>'days')::int then
      select count(*) into v_burst
      from verifications v
      join profiles pr on pr.id = v.verifier_id
      where v.household_id = p_household
        and v.created_at > now() - interval '24 hours'
        and extract(day from now() - pr.created_at) <= (v_anom->'burst_new_accounts'->>'days')::int;
      if v_burst >= (v_anom->'burst_new_accounts'->>'count')::int then
        v_susp := true;
        v_alasan := v_alasan || 'BURST_AKUN_BARU(' || v_burst || '); ';
      end if;
    end if;
    -- mass verify
    select count(*) into v_mass
    from verifications where verifier_id = v_uid and created_at > now() - interval '24 hours';
    if v_mass >= (v_anom->'mass_verify'->>'per_day')::int then
      v_susp := true;
      v_alasan := v_alasan || 'MASS_VERIFY(' || v_mass || '/hari); ';
    end if;
  end if;

  insert into verifications
    (household_id, verifier_id, tipe, pertanyaan, jawaban, komentar,
     bobot_radius, bobot_reputasi, suspicion_flag, status)
  values
    (p_household, v_uid, p_tipe, p_pertanyaan, p_jawaban, p_komentar,
     v_radius_w, v_rep_w, v_susp, case when v_susp then 'HELD' else 'ACTIVE' end)
  on conflict (household_id, verifier_id, tipe, pertanyaan)
  do update set jawaban = excluded.jawaban, komentar = excluded.komentar,
    bobot_radius = excluded.bobot_radius, bobot_reputasi = excluded.bobot_reputasi,
    suspicion_flag = excluded.suspicion_flag, status = excluded.status,
    moderation_status = 'PENDING', created_at = now()
  returning id into v_new_id;

  if v_susp then
    insert into anomaly_flags (target_type, target_id, kode, deskripsi)
    values ('verification', v_new_id, 'SUSPICIOUS_VOTE', trim(v_alasan));
  end if;

  perform recalc_scores(p_household);
  return jsonb_build_object(
    'ok', true, 'status', case when v_susp then 'HELD' else 'ACTIVE' end,
    'distance_m', round(v_dist), 'radius_weight', v_radius_w, 'rep_weight', v_rep_w);
end $$;

-- ── get_eligible_voters: jumlah warga berhak verifikasi (radius 2 km) ──
create or replace function get_eligible_voters(p_household uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_hh households%rowtype;
  v_total int; v_100 int; v_500 int;
begin
  select * into v_hh from households where id = p_household;
  if not found then return '{}'::jsonb; end if;
  select count(*) into v_total from profiles
   where is_verified and lokasi is not null
     and id <> coalesce(v_hh.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and st_distance(lokasi, v_hh.lokasi) <= 2000;
  select count(*) into v_100 from profiles
   where is_verified and lokasi is not null
     and id <> coalesce(v_hh.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and st_distance(lokasi, v_hh.lokasi) <= 100;
  select count(*) into v_500 from profiles
   where is_verified and lokasi is not null
     and id <> coalesce(v_hh.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and st_distance(lokasi, v_hh.lokasi) <= 500;
  return jsonb_build_object('total', v_total, 'radius_100m', v_100, 'radius_500m', v_500);
end $$;

-- ── get_public_household: profil publik masked (#KD-xxxxx) ──
create or replace function get_public_household(p_household uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_hh households%rowtype;
  v_bands jsonb := get_config('threshold_bands');
  v_band jsonb;
  v_kode text;
  v_verif jsonb;
  v_snap score_snapshots%rowtype;
  v_eligible int;
begin
  select * into v_hh from households where id = p_household;
  if not found or v_hh.status = 'DRAFT' then return null; end if;

  v_kode := 'KD-' || right(v_hh.id::text, 5);
  select b into v_band
  from jsonb_array_elements(v_bands) b
  where (v_hh.welfare_score::int between (b->>'min')::int and (b->>'max')::int)
  limit 1;

  select jsonb_build_object(
    'total', count(*),
    'sesuai', count(*) filter (where jawaban in ('SESUAI','YA')),
    'sebagian', count(*) filter (where jawaban = 'SEBAGIAN'),
    'tidak', count(*) filter (where jawaban in ('TIDAK','TIDAK_TAHU')))
  into v_verif
  from verifications
  where household_id = p_household and tipe in ('TETANGGA','KOMUNITAS') and status = 'ACTIVE';

  select count(*) into v_eligible
  from profiles
  where is_verified and lokasi is not null
    and id <> coalesce(v_hh.owner_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and st_distance(lokasi, v_hh.lokasi) <= 2000;

  select * into v_snap from score_snapshots
  where household_id = p_household order by computed_at desc limit 1;

  return jsonb_build_object(
    'kode', v_kode, 'rt', v_hh.rt, 'rw', v_hh.rw,
    'status', v_hh.status,
    'welfare_score', v_hh.welfare_score,
    'confidence_score', v_hh.confidence_score,
    'band', v_band,
    'last_verified_at', v_hh.last_verified_at,
    'indikator', coalesce(v_snap.detail -> 'welfare', '{}'::jsonb),
    'verifikasi', coalesce(v_verif, '{}'::jsonb),
    'eligible_voters', v_eligible);
end $$;

-- ── map_aggregate: agregasi per RT/RW (publik, tanpa detail pribadi) ──
create or replace function map_aggregate(p_rt text default null, p_rw text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_total int := 0;
  v_row record;
begin
  for v_row in
    select case
             when welfare_score <= 20 then 'sangat_rentan'
             when welfare_score <= 40 then 'rentan'
             when welfare_score <= 60 then 'menengah_bawah'
             when welfare_score <= 80 then 'menengah'
             else 'relatif_mampu' end as band,
           count(*) as jumlah
    from households
    where status in ('VERIFIED','MONITORING')
      and (p_rt is null or rt = p_rt)
      and (p_rw is null or rw = p_rw)
    group by 1
  loop
    v_out := v_out || jsonb_build_object('band', v_row.band, 'jumlah', v_row.jumlah);
    v_total := v_total + v_row.jumlah;
  end loop;
  return jsonb_build_object('total', v_total, 'rincian', v_out);
end $$;

-- ── officer_dashboard_priorities: auto-rank keluarga (PRD §8.3) ──
create or replace function officer_dashboard_priorities() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_gen jsonb := get_config('general');
  v_stale int := coalesce((v_gen->>'stale_days')::int, 90);
  v_row record;
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;

  for v_row in
    with snaps as (
      select household_id, welfare,
             row_number() over (partition by household_id order by computed_at desc) as rn
      from score_snapshots
    )
    select h.id,
           h.welfare_score, h.confidence_score,
           (select count(*) from disputes d
             where d.household_id = h.id and d.status in ('OPEN','INVESTIGATION')) as disputes,
           (select count(*) from verifications v
             where v.household_id = h.id and v.status = 'HELD') as held,
           (select count(*) from anomaly_flags f
             where f.target_id = h.id and f.status = 'OPEN') as flags,
           coalesce(extract(day from now() - h.last_verified_at)::int, 999) as days_stale,
           coalesce(abs(l.welfare - p.welfare), 0) as delta
    from households h
    left join snaps l on l.household_id = h.id and l.rn = 1
    left join snaps p on p.household_id = h.id and p.rn = 2
    where h.status in ('COMMUNITY_VERIFICATION','DOCUMENT_VERIFICATION',
                       'FIELD_VERIFICATION','VERIFIED','MONITORING')
    order by
      case when h.welfare_score <= 40 and h.confidence_score < 70 then 1 else 2 end,
      h.welfare_score asc, h.confidence_score asc
  loop
    v_out := v_out || jsonb_build_object(
      'household_id', v_row.id,
      'welfare', v_row.welfare_score, 'confidence', v_row.confidence_score,
      'disputes', v_row.disputes, 'held', v_row.held, 'flags', v_row.flags,
      'days_stale', v_row.days_stale, 'delta', v_row.delta,
      'alasan', case
        when v_row.welfare_score <= 40 and v_row.confidence_score < 70 then 'Welfare rendah + confidence rendah'
        when v_row.disputes > 0 then 'Ada laporan terbuka'
        when v_row.delta > 25 then 'Perubahan skor drastis'
        when v_row.held > 0 then 'Voting mencurigakan'
        when v_row.flags > 0 then 'Flag anomali'
        when v_row.days_stale > v_stale then 'Belum diverifikasi lama'
        else 'Rutin' end);
  end loop;
  return v_out;
end $$;

-- ── field_verify: verifikasi lapangan petugas + umpan reputasi verifier ──
create or replace function field_verify(
  p_household uuid, p_hasil boolean, p_catatan text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_delta jsonb := get_config('reputation_delta');
  v_match numeric := coalesce((v_delta->>'match')::numeric, 2);
  v_miss numeric := coalesce((v_delta->>'miss')::numeric, -3);
  v_row record;
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;

  insert into verifications
    (household_id, verifier_id, tipe, pertanyaan, jawaban, komentar, bobot_radius, bobot_reputasi)
  values (p_household, v_uid, 'PETUGAS', 'FIELD_CHECK',
          case when p_hasil then 'SESUAI' else 'TIDAK' end, p_catatan, 1.0, 1.0)
  on conflict (household_id, verifier_id, tipe, pertanyaan)
  do update set jawaban = excluded.jawaban, komentar = excluded.komentar;

  -- reputasi verifier: cocok → +match, meleset → +miss
  for v_row in
    select distinct verifier_id from verifications
    where household_id = p_household and tipe in ('TETANGGA','KOMUNITAS') and status = 'ACTIVE'
  loop
    update profiles set verifier_reputation = greatest(0, least(100,
      verifier_reputation + case
        when p_hasil and exists (select 1 from verifications v2
              where v2.household_id = p_household and v2.verifier_id = v_row.verifier_id
                and v2.jawaban in ('SESUAI','YA','SEBAGIAN')) then v_match
        when not p_hasil and exists (select 1 from verifications v2
              where v2.household_id = p_household and v2.verifier_id = v_row.verifier_id
                and v2.jawaban = 'TIDAK') then v_match
        else v_miss end))
    where id = v_row.verifier_id;
  end loop;

  update households set status = 'VERIFIED', last_verified_at = now(), updated_at = now()
  where id = p_household;

  perform recalc_scores(p_household);
end $$;

-- ── review_held_vote: petugas putuskan suara ditahan ──
create or replace function review_held_vote(p_verification uuid, p_keputusan text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hh uuid;
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  if p_keputusan not in ('ACTIVE','DISCARDED') then raise exception 'INVALID_DECISION'; end if;

  select household_id into v_hh from verifications where id = p_verification;
  if v_hh is null then raise exception 'VERIFICATION_NOT_FOUND'; end if;

  update verifications set status = p_keputusan where id = p_verification;
  update anomaly_flags set status = 'REVIEWED'
  where target_type = 'verification' and target_id = p_verification;
  perform recalc_scores(v_hh);
end $$;

-- ── review_document: petugas validasi dokumen ──
create or replace function review_document(p_document uuid, p_status text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hh uuid;
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  if p_status not in ('VERIFIED','REJECTED') then raise exception 'INVALID_STATUS'; end if;

  select household_id into v_hh from evidence_documents where id = p_document;
  if v_hh is null then raise exception 'DOCUMENT_NOT_FOUND'; end if;

  update evidence_documents
     set verification_status = p_status, verified_by = auth.uid(), verified_at = now()
   where id = p_document;
  perform recalc_scores(v_hh);
end $$;

-- ── review_comment: moderasi komentar (DEC-011: petugas) ──
create or replace function review_comment(p_verification uuid, p_status text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  if p_status not in ('APPROVED','REJECTED') then raise exception 'INVALID_STATUS'; end if;
  update verifications
     set moderation_status = p_status, moderated_by = auth.uid(), moderated_at = now()
   where id = p_verification;
end $$;

-- ── file_dispute: koreksi / keberatan / laporan palsu ──
create or replace function file_dispute(
  p_household uuid, p_tipe text, p_alasan text, p_bukti_path text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_tipe not in ('KOREKSI','KEBERATAN','LAPORAN_PALSU') then raise exception 'INVALID_TYPE'; end if;
  if p_alasan is null or length(p_alasan) < 10 then raise exception 'ALASAN_TOO_SHORT'; end if;

  insert into disputes (household_id, reporter_id, tipe, alasan, bukti_path)
  values (p_household, auth.uid(), p_tipe, p_alasan, p_bukti_path)
  returning id into v_id;
  return v_id;
end $$;

-- ── resolve_dispute: keputusan petugas (laporan ≠ hukuman instan) ──
create or replace function resolve_dispute(
  p_dispute uuid, p_keputusan text, p_catatan text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_d disputes%rowtype;
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  if p_keputusan not in ('RESOLVED','DISMISSED') then raise exception 'INVALID_DECISION'; end if;

  select * into v_d from disputes where id = p_dispute;
  if not found then raise exception 'DISPUTE_NOT_FOUND'; end if;

  update disputes
     set status = p_keputusan, keputusan = p_catatan,
         decided_by = auth.uid(), decided_at = now()
   where id = p_dispute;

  -- efek pada household (bukan penghapusan data otomatis)
  if p_keputusan = 'RESOLVED' then
    if v_d.tipe = 'LAPORAN_PALSU' then
      update households set status = 'REJECTED', updated_at = now() where id = v_d.household_id;
    elsif v_d.tipe = 'KOREKSI' then
      update households set status = 'NEED_REVISION', updated_at = now() where id = v_d.household_id;
    end if;
  end if;
end $$;

-- ── get_my_reputation ──
create or replace function get_my_reputation() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_prof profiles%rowtype;
  v_total int := 0;
  v_approved int := 0;
begin
  select * into v_prof from profiles where id = auth.uid();
  if not found then return null; end if;
  select count(*), count(*) filter (where status = 'ACTIVE' and not suspicion_flag)
  into v_total, v_approved
  from verifications where verifier_id = v_prof.id and tipe in ('TETANGGA','KOMUNITAS');
  return jsonb_build_object(
    'reputasi', v_prof.verifier_reputation,
    'verifikasi_dilakukan', v_total,
    'verifikasi_aktif', v_approved,
    'tenure_days', v_prof.tenure_days);
end $$;

-- ── set_config: admin ubah bobot/threshold (tanpa deploy) ──
create or replace function set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth_role() <> 'admin' then raise exception 'ADMIN_ONLY'; end if;
  insert into config (key, value, updated_by, updated_at)
  values (p_key, p_value, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end $$;

-- ── set_user_role / verify_profile: admin & petugas ──
create or replace function set_user_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth_role() <> 'admin' then raise exception 'ADMIN_ONLY'; end if;
  if p_role not in ('warga','petugas','admin') then raise exception 'INVALID_ROLE'; end if;
  update profiles set role = p_role where id = p_user;
end $$;

create or replace function verify_profile(p_user uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  update profiles set is_verified = true where id = p_user;
end $$;

-- ─────────────────────────────────────────────────────────────
-- TUTUP AKSES LANGSUNG KE TABEL SENSITIF
-- Semua mutasi lewat RPC (validasi radius/anomali/role).
-- RPC security definer tetap jalan (owner postgres) walau revoke.
-- ─────────────────────────────────────────────────────────────
revoke insert, update, delete on verifications from anon, authenticated;
revoke insert, update, delete on anomaly_flags from anon, authenticated;
revoke insert, update, delete on audit_log from anon, authenticated;
revoke update, delete on config from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- CATATAN SETELAH RUN
-- ─────────────────────────────────────────────────────────────
-- 1. Setelah akun pertama dibuat (signup), jadikan admin:
--      update profiles set role = 'admin' where id = '<auth.users.id>';
--    (Atau via supabase.auth.getUser() dari frontend, lalu panggil set_user_role.)
-- 2. Storage bucket privat 'evidence' dibuat dari dashboard:
--      Storage → New bucket → name: evidence, public: OFF
--    RLS storage (opsional, fase lanjut): hanya owner + petugas yang bisa baca.
-- 3. Supabase Auth: matikan "Confirm email" (Authentication → Settings)
--    supaya signup langsung aktif (pola proyek Pa sebelumnya).
-- 4. Kalibrasi bobot/threshold kapan saja via set_config('welfare_weights', ...)
--    — tanpa deploy, tercatat di audit_log (DEC-003).
