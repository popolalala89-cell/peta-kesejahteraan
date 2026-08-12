-- ═══════════════════════════════════════════════════════════════════════
-- PETA KESEJAHTERAAN — migrate_02_verifikasi.sql
-- Ditambahkan SETELAH migrate_01 (12 Agu 2026).
-- Jalankan di Supabase → SQL Editor → Run.
-- Isi: submit_verification v2 (GPS live + SELF_VOTE) + 3 RPC listing baru.
-- ═══════════════════════════════════════════════════════════════════════

-- Lokasi voter per-vote (untuk audit radius), tambah kolom aman (idempotent)
alter table verifications
  add column if not exists voter_lokasi geography(point);

-- ── submit_verification v2: GPS live + larang SELF_VOTE ──
drop function if exists submit_verification(uuid, text, text, text, text, double precision, double precision);
create or replace function submit_verification(
  p_household uuid,
  p_tipe text,
  p_pertanyaan text,
  p_jawaban text,
  p_komentar text default null,
  p_lat double precision default null,
  p_lon double precision default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_prof profiles%rowtype;
  v_hh households%rowtype;
  v_voter_pt geography;
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
  -- pemilik tidak boleh memverifikasi rumahnya sendiri
  if v_hh.owner_id = v_uid then raise exception 'SELF_VOTE'; end if;

  -- GPS live verifier → simpan ke profil + ke baris verifikasi
  if p_lat is null or p_lon is null then raise exception 'LOCATION_REQUIRED'; end if;
  v_voter_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;
  update profiles set lokasi = v_voter_pt where id = v_uid;
  if v_hh.lokasi is null then raise exception 'HOUSEHOLD_LOCATION_MISSING'; end if;
  v_dist := st_distance(v_voter_pt, v_hh.lokasi);

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
     bobot_radius, bobot_reputasi, suspicion_flag, status, voter_lokasi)
  values
    (p_household, v_uid, p_tipe, p_pertanyaan, p_jawaban, p_komentar,
     v_radius_w, v_rep_w, v_susp, case when v_susp then 'HELD' else 'ACTIVE' end,
     v_voter_pt)
  on conflict (household_id, verifier_id, tipe, pertanyaan)
  do update set jawaban = excluded.jawaban, komentar = excluded.komentar,
    bobot_radius = excluded.bobot_radius, bobot_reputasi = excluded.bobot_reputasi,
    suspicion_flag = excluded.suspicion_flag, status = excluded.status,
    moderation_status = 'PENDING', voter_lokasi = excluded.voter_lokasi,
    created_at = now()
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

-- ── get_nearby_households: daftar keluarga terverifikasi di sekitar voter ──
create or replace function get_nearby_households(
  p_lon double precision,
  p_lat double precision,
  p_max_m double precision default 2000
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_pt geography;
  v_bands jsonb := get_config('threshold_bands');
  v_out jsonb := '[]'::jsonb;
  v_row record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_lon is null or p_lat is null then raise exception 'LOCATION_REQUIRED'; end if;
  if v_bands is null then v_bands := '[{"min":0,"max":20},{"min":21,"max":40},{"min":41,"max":60},{"min":61,"max":80},{"min":81,"max":100}]'::jsonb; end if;
  v_pt := st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography;

  for v_row in
    select h.id,
           'KD-' || right(h.id::text, 5) as kode,
           h.rt, h.rw, h.kelurahan, h.status,
           h.welfare_score, h.confidence_score,
           round(st_distance(v_pt, h.lokasi)) as jarak_m,
           (select count(*) from verifications v
             where v.household_id = h.id and v.status = 'ACTIVE') as jumlah_vote
    from households h
    where h.status in ('SUBMITTED','COMMUNITY_VERIFICATION','DOCUMENT_VERIFICATION',
                       'FIELD_VERIFICATION','VERIFIED','MONITORING')
      and h.lokasi is not null
      and h.owner_id <> coalesce(v_uid, '00000000-0000-0000-0000-000000000000'::uuid)
      and st_distance(v_pt, h.lokasi) <= coalesce(p_max_m, 2000)
    order by st_distance(v_pt, h.lokasi) asc
    limit 50
  loop
    v_out := v_out || jsonb_build_object(
      'id', v_row.id, 'kode', v_row.kode, 'rt', v_row.rt, 'rw', v_row.rw,
      'kelurahan', v_row.kelurahan, 'status', v_row.status,
      'welfare_score', v_row.welfare_score, 'confidence_score', v_row.confidence_score,
      'jarak_m', v_row.jarak_m, 'jumlah_vote', v_row.jumlah_vote);
  end loop;
  return v_out;
end $$;

-- ── get_held_votes: suara ditahan yang menunggu keputusan petugas ──
create or replace function get_held_votes() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  v_row record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  for v_row in
    select v.id, v.household_id, 'KD-' || right(h.id::text, 5) as kode,
           p.nama as verifier_nama, v.tipe, v.pertanyaan, v.jawaban,
           v.komentar, v.bobot_radius, v.bobot_reputasi, v.created_at,
           coalesce(a.deskripsi, '') as alasan
    from verifications v
    join households h on h.id = v.household_id
    join profiles p on p.id = v.verifier_id
    left join anomaly_flags a on a.target_type = 'verification' and a.target_id = v.id
    where v.status = 'HELD'
    order by v.created_at asc
  loop
    v_out := v_out || to_jsonb(v_row);
  end loop;
  return v_out;
end $$;

-- ── get_unreviewed_documents: dokumen menunggu validasi petugas ──
create or replace function get_unreviewed_documents() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb := '[]'::jsonb;
  v_row record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if auth_role() not in ('petugas','admin') then raise exception 'PETUGAS_ONLY'; end if;
  for v_row in
    select d.id, d.household_id, 'KD-' || right(h.id::text, 5) as kode,
           d.jenis, d.storage_path, d.uploaded_at
    from evidence_documents d
    join households h on h.id = d.household_id
    where d.verification_status = 'PENDING'
    order by d.uploaded_at asc
  loop
    v_out := v_out || to_jsonb(v_row);
  end loop;
  return v_out;
end $$;

-- ═════════════ Selesai — jalankan, lalu kabari asisten ═════════════