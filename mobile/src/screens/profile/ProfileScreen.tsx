import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input } from '../../components/ui';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useI18n, type Language } from '../../i18n';
import { api, ApiError } from '../../api/client';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

export function ProfileScreen({ navigation }: any) {
  const { user, refreshUser, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
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
      setMessage(t('profile.updated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.title}>{t('profile.title')}</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Input label={t('profile.fullName')} value={fullName} onChangeText={setFullName} />
        <Input label={t('profile.phone')} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={t('common.save')} onPress={handleSave} isLoading={saving} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
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
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Button title={t('profile.myDocuments')} variant="secondary" onPress={() => navigation.navigate('DocumentsTab')} />
      </Card>

      <Card style={{ marginTop: spacing.md }}>
        <Button title={t('profile.myDevices')} variant="secondary" onPress={() => navigation.navigate('Devices')} />
      </Card>

      <Button title={t('profile.logout')} variant="ghost" onPress={logout} style={{ marginTop: spacing.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.neutral[700], marginBottom: spacing.sm },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
  languageChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  languageChipActive: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  languageText: { fontSize: fontSize.sm, color: colors.neutral[600] },
  languageTextActive: { color: colors.primary[700], fontWeight: '600' },
  success: { color: colors.status.active.fg, fontSize: fontSize.sm, marginBottom: spacing.sm },
  error: { color: colors.status.cancelled.fg, fontSize: fontSize.sm, marginBottom: spacing.sm },
});
