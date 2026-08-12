-- ═══════════════════════════════════════════════════════════════════════
-- PETA KESEJAHTERAAN — migrate_01_registrasi.sql
-- Ditambahkan SETELAH seed.sql (12 Agu 2026).
-- Jalankan di Supabase → SQL Editor → Run (2 fungsi).
-- ═══════════════════════════════════════════════════════════════════════

-- ── register_household ────────────────────────────────────────────────
-- Transaksi atomik: buat keluarga + anggota + rumah + aset + foto + dokumen,
-- langsung status SUBMITTED, lalu hitung skor. Anti duplikat keluarga aktif.
-- Dipanggil frontend saat step 8 (Review & kirim).
CREATE OR REPLACE FUNCTION register_household(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_member jsonb;
  v_asset jsonb;
  v_photo jsonb;
  v_doc jsonb;
  v_used_photos int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_uid) THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
  IF EXISTS (SELECT 1 FROM households
             WHERE owner_id = v_uid AND status NOT IN ('REJECTED')) THEN
    RAISE EXCEPTION 'DUPLICATE_HOUSEHOLD';
  END IF;

  INSERT INTO households
    (owner_id, no_kartu_keluarga, nama_kepala, alamat, rt, rw, kelurahan, kecamatan,
     lokasi, telepon, status_tempat_tinggal, jumlah_anggota, status)
  VALUES
    (v_uid,
     NULLIF(p_data->'household'->>'no_kartu_keluarga', ''),
     p_data->'household'->>'nama_kepala',
     p_data->'household'->>'alamat',
     NULLIF(p_data->'household'->>'rt', ''),
     NULLIF(p_data->'household'->>'rw', ''),
     NULLIF(p_data->'household'->>'kelurahan', ''),
     NULLIF(p_data->'household'->>'kecamatan', ''),
     ST_SetSRID(ST_MakePoint(
       (p_data->'household'->>'lon')::float,
       (p_data->'household'->>'lat')::float), 4326)::geography,
     NULLIF(p_data->'household'->>'telepon', ''),
     NULLIF(p_data->'household'->>'status_tempat_tinggal', ''),
     (p_data->'household'->>'jumlah_anggota')::int,
     'SUBMITTED')
  RETURNING id INTO v_id;

  -- Anggota keluarga
  FOR v_member IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'members', '[]'::jsonb)) LOOP
    INSERT INTO household_members
      (household_id, nama, hubungan, tanggal_lahir, jenis_kelamin, status,
       pekerjaan, jenis_pekerjaan, status_pekerjaan, penghasilan_bulanan,
       stabilitas_penghasilan, lama_bekerja_months, pendidikan)
    VALUES
      (v_id, v_member->>'nama', v_member->>'hubungan',
       NULLIF(v_member->>'tanggal_lahir','')::date,
       v_member->>'jenis_kelamin', v_member->>'status',
       NULLIF(v_member->>'pekerjaan',''),
       NULLIF(v_member->>'jenis_pekerjaan',''),
       NULLIF(v_member->>'status_pekerjaan',''),
       NULLIF(v_member->>'penghasilan_bulanan','')::numeric,
       NULLIF(v_member->>'stabilitas_penghasilan','')::int,
       NULLIF(v_member->>'lama_bekerja_months','')::int,
       NULLIF(v_member->>'pendidikan',''));
  END LOOP;

  -- Kondisi rumah (wajib)
  INSERT INTO house_conditions
    (household_id, status, luas_bangunan, jumlah_kamar, jenis_lantai, jenis_dinding,
     jenis_atap, kondisi_bangunan, sanitasi, sumber_air, sumber_listrik, jumlah_penghuni)
  VALUES
    (v_id,
     NULLIF(p_data->'house'->>'status',''),
     NULLIF(p_data->'house'->>'luas_bangunan','')::numeric,
     NULLIF(p_data->'house'->>'jumlah_kamar','')::int,
     NULLIF(p_data->'house'->>'jenis_lantai',''),
     NULLIF(p_data->'house'->>'jenis_dinding',''),
     NULLIF(p_data->'house'->>'jenis_atap',''),
     NULLIF(p_data->'house'->>'kondisi_bangunan','')::int,
     NULLIF(p_data->'house'->>'sanitasi',''),
     NULLIF(p_data->'house'->>'sumber_air',''),
     NULLIF(p_data->'house'->>'sumber_listrik',''),
     NULLIF(p_data->'house'->>'jumlah_penghuni','')::int);

  -- Aset (opsional)
  FOR v_asset IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'assets', '[]'::jsonb)) LOOP
    INSERT INTO assets (household_id, jenis, deskripsi, nilai_est, produktif, is_income_source)
    VALUES (v_id, v_asset->>'jenis', v_asset->>'deskripsi',
            NULLIF(v_asset->>'nilai_est','')::numeric,
            COALESCE((v_asset->>'produktif')::boolean, false),
            COALESCE((v_asset->>'is_income_source')::boolean, false));
  END LOOP;

  -- Foto rumah (wajib minimal 1)
  FOR v_photo IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'photos', '[]'::jsonb)) LOOP
    INSERT INTO evidence_photos
      (household_id, kategori, storage_path, taken_at, lat, lon, uploader_id)
    VALUES
      (v_id, v_photo->>'kategori', v_photo->>'storage_path',
       COALESCE(NULLIF(v_photo->>'taken_at','')::timestamptz, now()),
       NULLIF(v_photo->>'lat','')::float,
       NULLIF(v_photo->>'lon','')::float,
       v_uid);
    v_used_photos := v_used_photos + 1;
  END LOOP;

  -- Dokumen (opsional)
  FOR v_doc IN SELECT * FROM jsonb_array_elements(COALESCE(p_data->'documents', '[]'::jsonb)) LOOP
    INSERT INTO evidence_documents (household_id, jenis, storage_path)
    VALUES (v_id, v_doc->>'jenis', v_doc->>'storage_path');
  END LOOP;

  -- Foto wajib per PRD §6 — kalau kosong, kirim ke revisi
  IF v_used_photos = 0 THEN
    UPDATE households SET status = 'NEED_REVISION' WHERE id = v_id;
  END IF;

  PERFORM recalc_scores(v_id);
  RETURN jsonb_build_object('id', v_id,
                            'status', CASE WHEN v_used_photos = 0 THEN 'NEED_REVISION' ELSE 'SUBMITTED' END);
END $$;

-- ── get_my_household ──────────────────────────────────────────────────
-- Ambil keluarga milik user yang login (untuk halaman Profil/Status).
CREATE OR REPLACE FUNCTION get_my_household()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hh households%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_hh FROM households WHERE owner_id = v_uid ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
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
    'anggota', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT nama, hubungan, status, pekerjaan, status_pekerjaan, penghasilan_bulanan
      FROM household_members WHERE household_id = v_hh.id) x),
    'foto', (SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
      SELECT kategori, taken_at FROM evidence_photos WHERE household_id = v_hh.id) x)
  );
END $$;