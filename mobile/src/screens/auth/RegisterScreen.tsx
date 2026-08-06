import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Input } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { ApiError } from '../../api/client';

/**
 * Quick registration — name, phone, password, in.
 *
 * The phone number is the account handle because that's what everyone has;
 * email is offered but never required. Whatever the client types is accepted
 * (0712…, 255712…, +255 712…) and normalised on the server.
 */
export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const { language, t } = useI18n();
  const sw = language === 'sw';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = fullName.trim().length > 1 && phone.trim().length >= 9 && password.length >= 6;

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      await register({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        password,
        language,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{sw ? 'Fungua akaunti' : 'Create your account'}</Text>
          <Text style={styles.subtitle}>
            {sw ? 'Dakika moja tu, kisha anza kukodisha gari.' : 'Takes a minute — then you can book a car.'}
          </Text>
        </View>

        <Input
          label={sw ? 'Jina kamili' : 'Full name'}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete="name"
        />
        <Input
          label={sw ? 'Namba ya simu' : 'Phone number'}
          placeholder="0712 345 678"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoComplete="tel"
        />
        <Input
          label={sw ? 'Barua pepe (si lazima)' : 'Email (optional)'}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoComplete="email"
        />
        <Input
          label={sw ? 'Nenosiri' : 'Password'}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={password.length > 0 && password.length < 6 ? (sw ? 'Angalau herufi 6' : 'At least 6 characters') : undefined}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={sw ? 'Fungua akaunti' : 'Create account'}
          onPress={handleRegister}
          isLoading={loading}
          disabled={!canSubmit}
        />

        <Text style={styles.legal}>
          {sw
            ? 'Utahitajika kupakia kitambulisho na leseni kabla ya kukabidhiwa gari.'
            : "You'll be asked to upload your ID and driving license before a car is handed over."}
        </Text>

        <View style={styles.footer}>
          <Button
            title={sw ? 'Nina akaunti — ingia' : 'I already have an account'}
            variant="ghost"
            onPress={() => navigation.goBack()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  header: { marginBottom: spacing.xl },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.base, color: colors.neutral[500], marginTop: spacing.xs },
  error: { color: colors.status.cancelled.fg, marginBottom: spacing.sm, fontSize: fontSize.sm },
  legal: { fontSize: fontSize.xs, color: colors.neutral[400], marginTop: spacing.md, lineHeight: 17 },
  footer: { marginTop: spacing.md, alignItems: 'center' },
});
