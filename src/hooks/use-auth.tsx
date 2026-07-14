import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { getErrorMessage, logAppError } from '@/utils/errors';

export type UserProfile = Database['public']['Tables']['users']['Row'];

type AuthContextValue = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: "Votre e-mail n'est pas encore confirmé.",
  user_not_found: 'Aucun compte ne correspond à cet e-mail.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
};

function authErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code && AUTH_ERROR_MESSAGES[code]) return AUTH_ERROR_MESSAGES[code];
  return getErrorMessage(error, fallback);
}

/**
 * Real Supabase Auth session state, the app's third Context (after DateFilterProvider) — this
 * one genuinely is app-wide, wrapping the whole tree in the root layout so both the login guard
 * and every screen's role checks (Phase 2) read from one place.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Tracks which user id `profile` was last resolved for, so `profileLoading` can be derived
  // (rather than set imperatively) — a session can be known before its role is, and callers
  // (the post-login redirect, AccessGuard) must not act on a role that hasn't loaded yet.
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) logAppError('use-auth.loadProfile', error);
        setProfile(data);
        setResolvedUserId(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const profileLoading = !!userId && resolvedUserId !== userId;

  // Supabase's recommended React Native pattern: only auto-refresh tokens while foregrounded.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      logAppError('use-auth.signIn', error);
    } else {
      // Phase 12 (Team & Roles): smallest possible "Last Login" tracking — one RPC call against
      // the caller's own row, no login-history table. Never blocks sign-in on failure.
      supabase.rpc('touch_last_login').then(({ error: rpcError }) => {
        if (rpcError) logAppError('use-auth.touchLastLogin', rpcError);
      });
    }
    return { error: error ? authErrorMessage(error, 'Impossible de se connecter.') : null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) logAppError('use-auth.signOut', error);
  };

  const resetPassword = async (email: string) => {
    // CB-13 (Launch Readiness Audit): this used to only set a redirect on web, so the recovery
    // email's link had nowhere to send a native app back to — it opened in the system browser and
    // never returned. `Linking.createURL` produces the right scheme-based URL for a native build
    // (and the right Expo Go/dev-client proxy URL in development) the same way Expo Router already
    // resolves its own deep links, so `/reset-password` still opens the existing screen either way.
    const redirectTo =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : Linking.createURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) logAppError('use-auth.resetPassword', error);
    return {
      error: error ? authErrorMessage(error, "Impossible d'envoyer l'e-mail de réinitialisation.") : null,
    };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) logAppError('use-auth.updatePassword', error);
    return { error: error ? authErrorMessage(error, 'Impossible de mettre à jour le mot de passe.') : null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile: userId ? profile : null,
        loading: loading || profileLoading,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
