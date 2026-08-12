-- ═══════════════════════════════════════════════════════════════════════
-- PETA KESEJAHTERAAN — migrate_03_pengawas.sql
-- Ditambahkan SETELAH migrate_02 (12 Agu 2026).
-- Jalankan di Supabase → SQL Editor → Run.
-- Isi: "siapa yang mengawasi petugas?" — 3 lapis:
--   1) FOTO WAJIB saat verifikasi lapangan (anti asal klik)
--   2) QUORUM 2 petugas untuk kasus sensitif
--   3) SKOR KEANDALAN petugas (setuju vs konsensus komunitas + deteksi terlalu cepat)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Kolom jejak petugas di households ──
alter table households
  add column if not exists verified_by uuid references profiles(id),
  add column if not exists verified_2nd_by uuid references profiles(id);

-- ── Tabel keandalan petugas ──
create table if not exists officer_reliability (
  officer_id uuid primary key references profiles(id) on delete cascade,
  verifikasi_lapangan int not null default 0,   -- total aksi field_verify
  setuju_dgn_komunitas int not null default 0,  -- hasil cocok dgn mayoritas vote komunitas
  verifikasi_cepat int not null default 0,      -- durasi < fast_verify_seconds
  skor numeric(5,2) not null default 100,       -- 100 * setuju / total
  updated_at timestamptz not null default now()
);

-- ── Konfigurasi default quorum (bisa diubah admin via set_config) ──
insert into config (key, value)
values ('quorum',
  '{"welfare_threshold":40,"fast_verify_seconds":60,"require_evidence":true}'::jsonb)
on conflict (key) do nothing;

-- ── Guard transisi: verified_by / verified_2nd_by hanya petugas/admin ──
create or replace function fn_household_update_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status
     or new.last_verified_at is distinct from old.last_verified_at
     or new.verified_by is distinct from old.verified_by
     or new.verified_2nd_by is distinct from old.verified_2nd_by then
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

-- ── field_verify v2: foto wajib + quorum + keandalan petugas ──
create or replace function field_verify(
  p_household uuid,
  p_hasil boolean,
  p_catatan text default null,
  p_evidence_paths text[] default null,   -- wajib diisi saat p_hasil = true
  p_started_at timestamptz default null   -- kapan petugas mulai (deteksi terlalu cepat)
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_hh households%rowtype;
  v_delta jsonb := get_config('reputation_delta');
  v_match numeric := coalesce((v_delta->>'match')::numeric, 2);
  v_miss numeric := coalesce((v_delta->>'miss')::numeric, -3);
  v_cfg jsonb := get_config('quorum');
  v_threshold numeric := coalesce((v_cfg->>'welfare_threshold')::numeric, 40);
  v_fast_sec int := coalesce((v_cfg->>'fast_verify_seconds')::int, 60);
  v_need_evidence boolean := coalesce((v_cfg->>'require_evidence')::boolean, true);
  v_sensitive boolean;
  v_duration int := null;
  v_majority text := '';
  v_agree boolean := false;
  v_path text;
  v_row record;
  v_decision text;
begin
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;

  select * into v_hh from households where id = p_household;
  if not found then raise exception 'HOUSEHOLD_NOT_FOUND'; end if;

  -- 1) BUKTI FOTO WAJIB saat menyetujui (anti asal klik / asal validasi)
  if p_hasil and v_need_evidence
     and (p_evidence_paths is null or cardinality(p_evidence_paths) = 0) then
    raise exception 'EVIDENCE_REQUIRED';
  end if;
  if p_evidence_paths is not null then
    foreach v_path in array p_evidence_paths loop
      insert into evidence_photos
        (household_id, kategori, storage_path, taken_at, uploader_id, verified)
      values (p_household, 'verifikasi_lapangan', v_path, now(), v_uid, true);
    end loop;
  end if;

  -- 2) durasi verifikasi → terlalu cepat = tanda asal-asalan
  if p_started_at is not null then
    v_duration := greatest(0, extract(epoch from now() - p_started_at)::int);
    if v_duration < v_fast_sec then
      insert into anomaly_flags (target_type, target_id, kode, deskripsi)
      values ('household', p_household, 'FAST_VERIFY',
              'Verifikasi lapangan selesai ' || v_duration || ' detik (batas ' || v_fast_sec || 's) oleh petugas ' || v_uid);
    end if;
  end if;

  -- 3) catat verifikasi petugas (jejak di verifications)
  insert into verifications
    (household_id, verifier_id, tipe, pertanyaan, jawaban, komentar, bobot_radius, bobot_reputasi)
  values (p_household, v_uid, 'PETUGAS', 'FIELD_CHECK',
          case when p_hasil then 'SESUAI' else 'TIDAK' end, p_catatan, 1.0, 1.0)
  on conflict (household_id, verifier_id, tipe, pertanyaan)
  do update set jawaban = excluded.jawaban, komentar = excluded.komentar;

  -- 4) kasus sensitif: welfare rendah / ada suara ditahan / ada laporan terbuka
  v_sensitive := v_hh.welfare_score <= v_threshold
    or exists (select 1 from verifications v
               where v.household_id = p_household and v.status = 'HELD')
    or exists (select 1 from disputes d
               where d.household_id = p_household and d.status in ('OPEN','INVESTIGATION'));

  -- 5) keputusan + quorum
  if not p_hasil then
    update households set status = 'NEED_REVISION', updated_at = now()
    where id = p_household;
    v_decision := 'NEED_REVISION';
  elsif v_sensitive and v_hh.verified_by is null then
    update households set verified_by = v_uid, verified_2nd_by = null,
           status = 'FIELD_VERIFICATION', updated_at = now()
    where id = p_household;
    v_decision := 'QUORUM_1';
  elsif v_sensitive and v_hh.verified_by <> v_uid then
    update households set verified_2nd_by = v_uid, status = 'VERIFIED',
           last_verified_at = now(), updated_at = now()
    where id = p_household;
    v_decision := 'VERIFIED_QUORUM';
  elsif v_sensitive then
    raise exception 'QUORUM_NEEDS_SECOND_OFFICER';
  else
    update households set verified_by = v_uid, verified_2nd_by = null,
           status = 'VERIFIED', last_verified_at = now(), updated_at = now()
    where id = p_household;
    v_decision := 'VERIFIED';
  end if;

  -- 6) reputasi verifier komunitas: cocok → +match, meleset → +miss
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

  -- 7) keandalan PETUGAS: cocok dgn mayoritas komunitas? terlalu cepat?
  select mode() within group (order by jawaban) into v_majority
  from verifications
  where household_id = p_household and tipe in ('TETANGGA','KOMUNITAS') and status = 'ACTIVE';

  v_agree := (p_hasil and coalesce(v_majority,'') in ('SESUAI','SEBAGIAN','YA'))
          or (not p_hasil and coalesce(v_majority,'') in ('TIDAK','TIDAK_TAHU'));

  insert into officer_reliability
    (officer_id, verifikasi_lapangan, setuju_dgn_komunitas, verifikasi_cepat, skor)
  values (v_uid, 1,
          case when v_agree then 1 else 0 end,
          case when v_duration is not null and v_duration < v_fast_sec then 1 else 0 end,
          100)
  on conflict (officer_id) do update set
    verifikasi_lapangan = officer_reliability.verifikasi_lapangan + 1,
    setuju_dgn_komunitas = officer_reliability.setuju_dgn_komunitas + excluded.setuju_dgn_komunitas,
    verifikasi_cepat = officer_reliability.verifikasi_cepat + excluded.verifikasi_cepat,
    skor = round(100.0 * (officer_reliability.setuju_dgn_komunitas + excluded.setuju_dgn_komunitas)
                 / (officer_reliability.verifikasi_lapangan + 1), 2),
    updated_at = now();

  perform recalc_scores(p_household);
  return v_decision;
end $$;

-- ── get_officer_reliability: admin lihat peringkat keandalan petugas ──
create or replace function get_officer_reliability() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_row record;
begin
  if auth_role() <> 'admin' then raise exception 'ADMIN_ONLY'; end if;
  for v_row in
    select r.officer_id, p.nama, r.verifikasi_lapangan, r.setuju_dgn_komunitas,
           r.verifikasi_cepat, r.skor, r.updated_at
    from officer_reliability r
    join profiles p on p.id = r.officer_id
    order by r.skor asc, r.verifikasi_cepat desc, r.updated_at asc
  loop
    v_out := v_out || to_jsonb(v_row);
  end loop;
  return v_out;
end $$;

-- ── officer_dashboard_priorities v2: quorum pending tampil paling atas ──
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
           coalesce(abs(l.welfare - p.welfare), 0) as delta,
           (h.verified_by is not null and h.verified_2nd_by is null
            and h.status = 'FIELD_VERIFICATION') as quorum_pending,
           (select nama from profiles pr where pr.id = h.verified_by) as verifier1_nama
    from households h
    left join snaps l on l.household_id = h.id and l.rn = 1
    left join snaps p on p.household_id = h.id and p.rn = 2
    where h.status in ('COMMUNITY_VERIFICATION','DOCUMENT_VERIFICATION',
                       'FIELD_VERIFICATION','VERIFIED','MONITORING')
    order by
      case when h.verified_by is not null and h.verified_2nd_by is null
                and h.status = 'FIELD_VERIFICATION' then 0
           when h.welfare_score <= 40 and h.confidence_score < 70 then 1 else 2 end,
      h.welfare_score asc, h.confidence_score asc
  loop
    v_out := v_out || jsonb_build_object(
      'household_id', v_row.id,
      'welfare', v_row.welfare_score, 'confidence', v_row.confidence_score,
      'disputes', v_row.disputes, 'held', v_row.held, 'flags', v_row.flags,
      'days_stale', v_row.days_stale, 'delta', v_row.delta,
      'quorum_pending', v_row.quorum_pending, 'verifier1_nama', v_row.verifier1_nama,
      'alasan', case
        when v_row.quorum_pending then 'Menunggu petugas ke-2 (quorum)'
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

-- ── get_my_household v2: transparansi — warga lihat siapa yang memverifikasi ──
create or replace function get_my_household()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_hh households%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_hh from households where owner_id = v_uid order by created_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', v_hh.id,
    'status', v_hh.status,
    'nama_kepala', v_hh.nama_kepala,
    'alamat', v_hh.alamat,
    'rt', v_hh.rt,
    'rw', v_hh.rw,
    'welfare_score', v_hh.welfare_score,
    'confidence_score', v_hh.confidence_score,
    'last_verified_at', v_hh.last_verified_at,
    'kode', 'KD-' || right(v_hh.id::text, 5),
    'verified_by', (select nama from profiles p where p.id = v_hh.verified_by),
    'verified_2nd_by', (select nama from profiles p where p.id = v_hh.verified_2nd_by),
    'quorum_pending', (v_hh.verified_by is not null and v_hh.verified_2nd_by is null
                       and v_hh.status = 'FIELD_VERIFICATION'),
    'anggota', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select nama, hubungan, status, pekerjaan, status_pekerjaan, penghasilan_bulanan
      from household_members WHERE household_id = v_hh.id) x),
    'foto', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
      select kategori, taken_at from evidence_photos WHERE household_id = v_hh.id) x)
  );
end $$;

-- ═════════════ Selesai — jalankan, lalu kabari asisten ═════════════
