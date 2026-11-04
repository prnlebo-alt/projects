import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';
import { FREE_SKINS, type Plan } from './catalog';

export interface UserRecord {
  id: string;
  email: string;
  plan: Plan;
  unlocked_skins: string[];
  license_token: string | null;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  item_id: string;
  stripe_session_id: string;
  amount: number;
}

export function getSupabaseAdmin() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function upsertUserByEmail(email: string, values?: Partial<Pick<UserRecord, 'plan' | 'unlocked_skins' | 'license_token'>>): Promise<UserRecord> {
  const supabase = getSupabaseAdmin();

  const existing = await getUserByEmail(email);
  if (existing && !values) return existing;
  if (existing && values) {
    return updateUserLicense(existing.id, {
      plan: values.plan ?? existing.plan,
      unlocked_skins: values.unlocked_skins ?? existing.unlocked_skins,
      license_token: values.license_token ?? existing.license_token,
    });
  }

  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      plan: values?.plan ?? 'free',
      unlocked_skins: values?.unlocked_skins ?? [...FREE_SKINS],
      license_token: values?.license_token ?? null,
    })
    .select('id,email,plan,unlocked_skins,license_token')
    .single();

  if (error) throw error;
  return data as UserRecord;
}

export async function updateUserLicense(userId: string, values: Pick<UserRecord, 'plan' | 'unlocked_skins' | 'license_token'>): Promise<UserRecord> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .update(values)
    .eq('id', userId)
    .select('id,email,plan,unlocked_skins,license_token')
    .single();

  if (error) throw error;
  return data as UserRecord;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('id,email,plan,unlocked_skins,license_token')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return data as UserRecord | null;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('id,email,plan,unlocked_skins,license_token')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as UserRecord | null;
}

export async function recordPurchase(values: Omit<PurchaseRecord, 'id'>): Promise<PurchaseRecord> {
  const { data, error } = await getSupabaseAdmin()
    .from('purchases')
    .upsert(values, { onConflict: 'stripe_session_id' })
    .select('id,user_id,item_id,stripe_session_id,amount')
    .single();

  if (error) throw error;
  return data as PurchaseRecord;
}
