# Peta Kesejahteraan 🌾

Sistem Pemetaan Kesejahteraan & Kerentanan Warga — berbasis bukti dan verifikasi komunitas.

**Dua skor terpisah (DEC-001):**
- **Welfare Score** — kondisi ekonomi keluarga (dari indikator terdata, makin tinggi = makin mampu).
- **Confidence Score** — keyakinan sistem terhadap kebenaran data (bukti + verifikasi + reputasi verifier).

Voting warga **tidak pernah** mengubah Welfare Score. Privasi dijaga: NIK di-hash, dokumen privat, publik hanya lihat agregasi.

## Struktur

```
PRD.md                    # Kontrak proyek (17 seksi)
ai-context/               # Konteks AI (AGENTS, CURRENT_STATE, DECISIONS, dll)
supabase/seed.sql         # Schema + RLS + RPC (sumber kebenaran DB)
src/                      # Frontend React + TS + Vite
.github/workflows/deploy.yml  # CI GH Pages
```

## Setup

1. **Database:** buat project di [supabase.com](https://supabase.com) → SQL Editor → jalankan `supabase/seed.sql`.
2. **Auth:** Authentication → Settings → matikan "Confirm email".
3. **Storage:** buat bucket privat `evidence`.
4. **Akun admin:** setelah signup pertama, jalankan
   `update profiles set role = 'admin' where id = '<user-id>';`
5. **Env lokal:** salin `.env.example` ke `.env`, isi Project URL + anon key.
6. **CI:** repo → Settings → Secrets and variables → Actions → tambah `SUPABASE_URL` dan `ANON_KEY` (nilai anon key).

```bash
npm install
npm run dev       # develop
npm run build     # build ke dist/
```

## Status

- Fase 1 (MVP) sedang dibangun — lihat `ai-context/TASK_BOARD.md`.
- Detail keputusan arsitektur: `ai-context/DECISIONS.md`.