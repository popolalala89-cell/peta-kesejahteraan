// Tipe data inti — sesuai schema supabase/seed.sql

export type Role = 'warga' | 'petugas' | 'admin'

export interface Profile {
  id: string
  role: Role
  nama: string
  no_hp: string | null
  is_verified: boolean
  verifier_reputation: number
  tenure_days: number
}

export interface PublicHousehold {
  kode: string
  rt: string | null
  rw: string | null
  status: string
  welfare_score: number | null
  confidence_score: number | null
  band: { label: string; warna: string } | null
  last_verified_at: string | null
  indikator: Record<string, number>
  verifikasi: { total: number; sesuai: number; sebagian: number; tidak: number }
  eligible_voters: number
}

export interface PriorityItem {
  household_id: string
  welfare: number | null
  confidence: number | null
  disputes: number
  held: number
  flags: number
  days_stale: number
  delta: number
  alasan: string
}

export interface MapAggregate {
  total: number
  rincian: Array<{ band: string; jumlah: number }>
}

export interface MyReputation {
  reputasi: number
  verifikasi_dilakukan: number
  verifikasi_aktif: number
  tenure_days: number
}

export const BAND_META: Record<string, { label: string; warna: string }> = {
  relatif_mampu: { label: 'Relatif Mampu', warna: '#2E7D32' },
  menengah: { label: 'Menengah', warna: '#9E9D24' },
  menengah_bawah: { label: 'Menengah Bawah', warna: '#F9A825' },
  rentan: { label: 'Rentan', warna: '#EF6C00' },
  sangat_rentan: { label: 'Sangat Rentan', warna: '#C62828' },
}