import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/icon';
import { AmkouyColors } from '@/constants/amkouy-theme';
import { robotoText, robotoWeight } from '@/constants/typography';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { supabase } from '@/lib/supabase';
import { notify } from '@/utils/alert';
import { logAppError } from '@/utils/errors';

/** Supabase puts the recovery tokens in the URL fragment (`#access_token=...&refresh_token=...`),
 * which `expo-linking`'s own query-param parsing doesn't read (it only parses `?query=strings`) —
 * pulled out by hand here. Web doesn't need this (handled by `detectSessionInUrl` in supabase.ts);
 * this only runs the work on native. */
function extractRecoveryTokens(url: string): { accessToken: string; refreshToken: string } | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return null;
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // CB-13 (Launch Readiness Audit): on native, arriving here from the recovery email's deep link
  // does NOT by itself create a session — only the URL is parsed. Without this, `updatePassword`
  // below has no signed-in user to act on, and silently fails.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const applyUrl = async (url: string | null) => {
      if (!url) return;
      const tokens = extractRecoveryTokens(url);
      if (!tokens) return;
      const { error } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (error) logAppError('reset-password.applyRecoveryUrl', error);
    };
    Linking.getInitialURL().then(applyUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => applyUrl(url));
    return () => subscription.remove();
  }, []);

  const handleSubmit = async () => {
    if (password.trim().length < 6) {
      setErrorMessage(t('resetPassword.tooShort'));
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
      return;
    }
    notify(t('resetPassword.updatedTitle'), t('resetPassword.updatedMessage'));
    router.replace('/login');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBlock}>
          <View style={styles.logo}>
            <Text style={styles.logoLetter}>A</Text>
          </View>
          <Text style={styles.title}>{t('resetPassword.title')}</Text>
          <Text style={styles.subtitle}>{t('resetPassword.subtitle')}</Text>
        </View>

        <View style={styles.field}>
          <View style={styles.inputRow}>
            <Icon name="lock" size={22} color={AmkouyColors.textFaint} />
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showPassword}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
              <Icon
                name={showPassword ? 'visibility' : 'visibility_off'}
                size={22}
                color={AmkouyColors.textFaint}
              />
            </Pressable>
          </View>
          <Text style={styles.fieldLabel}>{t('login.password')}</Text>
        </View>

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}>
          {submitting ? (
            <ActivityIndicator color={AmkouyColors.primary} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('common.save')}</Text>
          )}
        </Pressable>

        <View style={styles.spacer} />

        <Text style={styles.footer}>{t('login.footer')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AmkouyColors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
    paddingBottom: 30,
  },
  logoBlock: {
    alignItems: 'center',
  },
  logo: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: AmkouyColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    ...robotoText(900, 44, { color: AmkouyColors.secondary }),
  },
  title: {
    ...robotoText(700, 24, { color: AmkouyColors.primary, marginTop: 22, letterSpacing: -0.4, textAlign: 'center' }),
  },
  subtitle: {
    ...robotoText(400, 14, { color: AmkouyColors.textFaint, marginTop: 7, textAlign: 'center' }),
  },
  field: {
    position: 'relative',
    marginTop: 46,
  },
  inputRow: {
    height: 56,
    borderWidth: 1.5,
    borderColor: AmkouyColors.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontFamily: robotoWeight(400),
    fontSize: 15,
    color: AmkouyColors.text,
  },
  passwordInput: {
    letterSpacing: 2,
  },
  fieldLabel: {
    position: 'absolute',
    top: -9,
    left: 14,
    backgroundColor: AmkouyColors.surface,
    paddingHorizontal: 6,
    ...robotoText(500, 12, { color: AmkouyColors.textFaint }),
  },
  errorText: {
    ...robotoText(500, 13, { color: AmkouyColors.error, marginTop: 20, textAlign: 'center' }),
  },
  primaryButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: AmkouyColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, letterSpacing: 0.5 }),
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
    ...robotoText(400, 12, { color: AmkouyColors.textFainter }),
  },
});
