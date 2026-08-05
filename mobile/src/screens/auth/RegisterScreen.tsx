import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Input } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';

export function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    setLoading(true);
    try {
      await register({ full_name: fullName, phone, email, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl }}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to start booking rentals.</Text>
        </View>

        <Input label="Full Name" value={fullName} onChangeText={setFullName} />
        <Input label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Input label="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Create Account" onPress={handleRegister} isLoading={loading} />

        <View style={styles.footer}>
          <Button title="Back to Sign In" variant="ghost" onPress={() => navigation.goBack()} />
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
  footer: { marginTop: spacing.md, alignItems: 'center' },
});
