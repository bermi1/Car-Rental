import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Spinner, StatusBadge } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { api } from '../../api/client';
import type { ClientDevice } from '../../types';

export function DevicesScreen() {
  const [devices, setDevices] = useState<ClientDevice[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<ClientDevice[]>('/devices/me').then(setDevices);
  }, []);

  useFocusEffect(load);

  async function unlink(id: string) {
    setBusyId(id);
    try {
      await api.delete(`/devices/me/${id}`);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={styles.title}>My Devices</Text>
        <Text style={styles.subtitle}>Devices currently signed into your account.</Text>
      </View>

      {!devices ? (
        <Spinner />
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          ListEmptyComponent={<EmptyState title="No devices linked" />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceName}>{item.device_name}</Text>
                  <Text style={styles.deviceMeta}>
                    {item.platform} · Last active {new Date(item.last_active_at).toLocaleString()}
                  </Text>
                </View>
                <StatusBadge status={item.is_active ? 'confirmed' : 'cancelled'} />
              </View>
              {item.is_active && (
                <Button
                  title="Unlink Device"
                  variant="danger"
                  onPress={() => unlink(item.id)}
                  isLoading={busyId === item.id}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs, marginBottom: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deviceName: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
  deviceMeta: { fontSize: fontSize.xs, color: colors.neutral[500], marginTop: 2 },
});
