// Wrapper RPC Supabase — nama fungsi sama dengan seed.sql

import { supabase } from './supabase'
import type {
  MapAggregate,
  MyReputation,
  PriorityItem,
  PublicHousehold,
} from './types'

export async function getPublicHousehold(
  householdId: string,
): Promise<PublicHousehold | null> {
  const { data, error } = await supabase!.rpc('get_public_household', {
    p_household: householdId,
  })
  if (error) throw error
  return (data ?? null) as PublicHousehold | null
}

export async function mapAggregate(
  rt?: string,
  rw?: string,
): Promise<MapAggregate> {
  const { data, error } = await supabase!.rpc('map_aggregate', {
    p_rt: rt ?? null,
    p_rw: rw ?? null,
  })
  if (error) throw error
  return data as MapAggregate
}

export async function officerPriorities(): Promise<PriorityItem[]> {
  const { data, error } = await supabase!.rpc('officer_dashboard_priorities')
  if (error) throw error
  return (data ?? []) as PriorityItem[]
}

export async function getEligibleVoters(householdId: string) {
  const { data, error } = await supabase!.rpc('get_eligible_voters', {
    p_household: householdId,
  })
  if (error) throw error
  return data as { total: number; radius_100m: number; radius_500m: number }
}

export async function getMyReputation(): Promise<MyReputation | null> {
  const { data, error } = await supabase!.rpc('get_my_reputation')
  if (error) throw error
  return data as MyReputation | null
}

export async function submitVerification(
  householdId: string,
  tipe: 'TETANGGA' | 'KOMUNITAS',
  pertanyaan: string,
  jawaban: string,
  komentar?: string,
) {
  const { data, error } = await supabase!.rpc('submit_verification', {
    p_household: householdId,
    p_tipe: tipe,
    p_pertanyaan: pertanyaan,
    p_jawaban: jawaban,
    p_komentar: komentar ?? null,
  })
  if (error) throw error
  return data as { ok: boolean; status: string; distance_m: number }
}

export async function fileDispute(
  householdId: string,
  tipe: 'KOREKSI' | 'KEBERATAN' | 'LAPORAN_PALSU',
  alasan: string,
) {
  const { data, error } = await supabase!.rpc('file_dispute', {
    p_household: householdId,
    p_tipe: tipe,
    p_alasan: alasan,
  })
  if (error) throw error
  return data as string
}