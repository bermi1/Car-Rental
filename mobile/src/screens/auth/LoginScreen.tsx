import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Input } from '../../components/ui';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Language } from '../../i18n';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'sw', label: 'SW' },
];

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { language, setLanguage } = useI18n();
  const sw = language === 'sw';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await login(identifier.trim(), password);
    } catch (err: any) {
      // Show what the server actually said — "Invalid credentials" and a
      // deactivated account need different things from the user.
      setError(err?.message || (sw ? 'Kuingia kumeshindikana' : 'Could not sign in'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.languageRow}>
          {LANGUAGES.map((l) => {
            const active = language === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLanguage(l.code)}
                style={[styles.languageChip, active && styles.languageChipActive]}
              >
                <Text style={[styles.languageText, active && styles.languageTextActive]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.brand}>
          <View style={styles.mark}>
            <Text style={styles.markText}>B</Text>
          </View>
          <Text style={styles.title}>BERMI RENTALS</Text>
          <Text style={styles.subtitle}>
            {sw ? 'Kodisha, fuatilia na simamia magari yako.' : 'Book, track and manage your rentals.'}
          </Text>
        </View>

        <Input
          label={sw ? 'Namba ya simu au barua pepe' : 'Phone number or email'}
          placeholder="0712 345 678"
          autoCapitalize="none"
          keyboardType="default"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <Input
          label={sw ? 'Nenosiri' : 'Password'}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          title={sw ? 'Ingia' : 'Sign in'}
          onPress={handleLogin}
          isLoading={loading}
          disabled={!identifier.trim() || !password}
          style={{ marginTop: spacing.sm }}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>{sw ? 'Huna akaunti?' : "Don't have an account?"}</Text>
          <Button
            title={sw ? 'Fungua akaunti' : 'Create account'}
            variant="ghost"
            onPress={() => navigation.navigate('Register')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  content: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  languageRow: { flexDirection: 'row', gap: spacing.xs, alignSelf: 'flex-end', marginBottom: spacing.lg },
  languageChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  languageChipActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  languageText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.neutral[500] },
  languageTextActive: { color: colors.primary[700] },
  brand: { marginBottom: spacing.xxl },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  markText: { color: colors.white, fontSize: 28, fontWeight: '700' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900], letterSpacing: 0.4 },
  subtitle: { fontSize: fontSize.base, color: colors.neutral[500], marginTop: spacing.xs },
  error: { color: colors.status.cancelled.fg, marginBottom: spacing.sm, fontSize: fontSize.sm },
  footer: { marginTop: spacing.lg, alignItems: 'center' },
  footerText: { color: colors.neutral[500], fontSize: fontSize.sm, marginBottom: spacing.xs },
});
