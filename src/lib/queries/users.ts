import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { logActivity } from '@/lib/queries/activity-log';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logAppError } from '@/utils/errors';

export type UserRow = Database['public']['Tables']['users']['Row'];
export type UserRole = Database['public']['Enums']['user_role'];

/** Staff-directory lookup for assignment pickers (cleaner/technician). Relies on the
 * `users_select` RLS policy allowing `is_staff()` to read the full table. */
export async function listUsersByRole(role: UserRole): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('full_name');
  if (error) {
    logAppError('users.listUsersByRole', error);
    throw error;
  }
  return data ?? [];
}

/** Manager/admin ids, for notification fan-out on staff-facing lifecycle events. Calls the
 * `list_staff_user_ids` RPC (SECURITY DEFINER) rather than querying `users` directly, since the
 * caller triggering these events (cleaner, technician) can't see other users' rows under
 * `users_select` RLS — a direct query would silently return an empty list for them. */
export async function listStaffUserIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_staff_user_ids');
  if (error) {
    logAppError('users.listStaffUserIds', error);
    throw error;
  }
  return (data ?? []).map((u) => u.id);
}

// ============================================================================
// Team & Roles (Settings → Équipe & rôles) — full directory + admin actions.
// Reuses `users_select`/`users_update` RLS as-is (extended this module to add
// `is_finance()` read access; writes remain `is_admin()`-only, matching Phase 11's
// "visible ONLY to super_admin/admin").
// ============================================================================

export async function listAllUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .is('deleted_at', null)
    .order('full_name');
  if (error) {
    logAppError('users.listAllUsers', error);
    throw error;
  }
  return data ?? [];
}

export async function getUser(id: string): Promise<UserRow | null> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) {
    logAppError('users.getUser', error);
    throw error;
  }
  return data;
}

export async function setUserActive(id: string, isActive: boolean): Promise<UserRow> {
  const { data, error } = await supabase.from('users').update({ is_active: isActive }).eq('id', id).select().single();
  if (error) {
    logAppError('users.setUserActive', error);
    throw error;
  }
  await logActivity({ entityType: 'user', entityId: id, action: isActive ? 'user.activated' : 'user.deactivated' });
  return data;
}

export async function changeUserRole(id: string, role: UserRole): Promise<UserRow> {
  const { data, error } = await supabase.from('users').update({ role }).eq('id', id).select().single();
  if (error) {
    logAppError('users.changeUserRole', error);
    throw error;
  }
  await logActivity({ entityType: 'user', entityId: id, action: 'user.role_changed', changes: { role } });
  return data;
}

/**
 * Create User (Phase 11). This app has no server-side function and never exposes the Supabase
 * service-role key to the client, so `auth.admin.createUser()` / `inviteUserByEmail()` aren't
 * available here — and calling `supabase.auth.signUp()` on the shared client would hijack the
 * calling admin's own session (a well-known Supabase JS behavior: signUp signs in as the new
 * user). The safe path used here: sign up the new user on a throwaway, non-persisting client
 * instance (never touches the admin's session or storage), which creates the `auth.users` row
 * and — via the existing `handle_new_auth_user` trigger — a `public.users` row hardcoded to
 * `role = 'cleaner'` (the Pre-Module-7 signup-escalation fix). The admin's real session then
 * patches the correct role/phone (an ordinary `is_admin()`-gated UPDATE), and finally reuses the
 * existing password-reset email flow so the new user sets their own password — never generated,
 * shown, or stored by this app beyond the one throwaway value passed to `signUp`.
 */
export async function createUser(input: { fullName: string; email: string; phone: string | null; role: UserRole }): Promise<void> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;
  const throwawayClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // Not `crypto.randomUUID()` — unavailable on native Hermes without an extra dependency, and
  // unneeded here anyway: this value is discarded immediately, the real credential the new user
  // ends up with comes entirely from the password-reset email flow below.
  const randomSegment = () => Math.random().toString(36).slice(2);
  const throwawayPassword = `Tmp-${randomSegment()}${randomSegment()}-${Date.now()}`;
  const { data: signUpData, error: signUpError } = await throwawayClient.auth.signUp({
    email: input.email,
    password: throwawayPassword,
    options: { data: { full_name: input.fullName, phone: input.phone } },
  });
  if (signUpError || !signUpData.user) {
    logAppError('users.createUser.signUp', signUpError);
    throw signUpError ?? new Error('La création du compte a échoué.');
  }
  const newUserId = signUpData.user.id;

  const { error: updateError } = await supabase
    .from('users')
    .update({ full_name: input.fullName, phone: input.phone, role: input.role })
    .eq('id', newUserId);
  if (updateError) {
    logAppError('users.createUser.setRole', updateError);
    throw updateError;
  }

  await logActivity({ entityType: 'user', entityId: newUserId, action: 'user.created', changes: { role: input.role } });

  const redirectTo =
    Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(input.email, { redirectTo });
  if (resetError) logAppError('users.createUser.sendResetEmail', resetError);
}
