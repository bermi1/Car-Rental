import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../api/client';

export function ProfileScreen({ navigation }: any) {
  const { user, refreshUser, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await api.put(`/clients/${user!.id}`, { full_name: fullName, phone });
      await refreshUser();
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Input label="Full Name" value={fullName} onChangeText={setFullName} />
        <Input label="Phone" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Save Changes" onPress={handleSave} isLoading={saving} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Button title="My Documents" variant="secondary" onPress={() => navigation.navigate('DocumentsTab')} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Button title="My Devices" variant="secondary" onPress={() => navigation.navigate('Devices')} />
      </Card>

      <Button title="Log Out" variant="ghost" onPress={logout} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  success: { color: colors.status.active.fg, fontSize: fontSize.sm, marginBottom: spacing.sm },
  error: { color: colors.status.cancelled.fg, fontSize: fontSize.sm, marginBottom: spacing.sm },
});
