import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Input } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('grace.mushi@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.title}>Rental Client</Text>
        <Text style={styles.subtitle}>Book, track, and manage your rentals.</Text>
      </View>

      <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Sign In" onPress={handleLogin} isLoading={loading} style={{ marginTop: spacing.sm }} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <Button title="Create Account" variant="ghost" onPress={() => navigation.navigate('Register')} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50], padding: spacing.xl, justifyContent: 'center' },
  header: { marginBottom: spacing.xxl },
  title: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.base, color: colors.neutral[500], marginTop: spacing.xs },
  error: { color: colors.status.cancelled.fg, marginBottom: spacing.sm, fontSize: fontSize.sm },
  footer: { marginTop: spacing.lg, alignItems: 'center' },
  footerText: { color: colors.neutral[500], fontSize: fontSize.sm, marginBottom: spacing.xs },
});
