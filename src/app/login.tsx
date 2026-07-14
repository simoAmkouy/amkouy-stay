import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { notify } from '@/utils/alert';

export default function LoginScreen() {
  const { signIn, resetPassword } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage(t('login.missingFields'));
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      setErrorMessage(error);
    }
    // No explicit navigation on success: AuthGate (root layout) is the single source of truth
    // for post-login routing — it waits for the role to load and redirects to that role's
    // actual home route, which isn't always /dashboard (see constants/permissions.ts).
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage(t('login.forgotPasswordMissingEmail'));
      return;
    }
    setErrorMessage(null);
    const { error } = await resetPassword(email.trim());
    if (error) {
      notify(t('common.error'), error);
      return;
    }
    notify(t('login.emailSent'), t('login.resetLinkSent', { email: email.trim() }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBlock}>
          <Image
            source={require('@/assets/images/amkouy-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Amkouy Immobilier"
          />
          <Text style={styles.title}>{t('login.brand')}</Text>
          <Text style={styles.subtitle}>{t('login.tagline')}</Text>
        </View>

        <View style={styles.field}>
          <View style={styles.inputRow}>
            <Icon name="mail" size={22} color={AmkouyColors.textFaint} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <Text style={styles.fieldLabel}>{t('login.email')}</Text>
        </View>

        <View style={[styles.field, styles.fieldSpacing]}>
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

        <View style={styles.forgotRow}>
          <Pressable onPress={handleForgotPassword} hitSlop={6}>
            <Text style={styles.forgotText}>{t('login.forgotPassword')}</Text>
          </Pressable>
        </View>

        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <Pressable
          onPress={handleSignIn}
          disabled={submitting}
          style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}>
          {submitting ? (
            <ActivityIndicator color={AmkouyColors.primary} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('login.signIn')}</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('login.or')}</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={() => notify(t('login.biometric'), t('login.biometricSoon'))}
          style={styles.secondaryButton}>
          <Icon name="fingerprint" size={24} color={AmkouyColors.primary} />
          <Text style={styles.secondaryButtonText}>{t('login.biometric')}</Text>
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
    width: 200,
    height: 133,
    alignSelf: 'center',
  },
  title: {
    ...robotoText(700, 27, { color: AmkouyColors.primary, marginTop: 22, letterSpacing: -0.4 }),
  },
  subtitle: {
    ...robotoText(400, 14, { color: AmkouyColors.textFaint, marginTop: 7 }),
  },
  field: {
    position: 'relative',
    marginTop: 46,
  },
  fieldSpacing: {
    marginTop: 12,
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
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 12,
    marginBottom: 26,
  },
  forgotText: {
    ...robotoText(600, 13, { color: AmkouyColors.secondary, padding: 6 }),
  },
  errorText: {
    ...robotoText(500, 13, { color: AmkouyColors.error, marginBottom: 14, textAlign: 'center' }),
  },
  primaryButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: AmkouyColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...robotoText(700, 15, { color: AmkouyColors.primary, letterSpacing: 0.5 }),
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AmkouyColors.hairline,
  },
  dividerText: {
    ...robotoText(400, 13, { color: AmkouyColors.textFainter }),
  },
  secondaryButton: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: AmkouyColors.primary,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButtonText: {
    ...robotoText(600, 14, { color: AmkouyColors.primary }),
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
