import React, { useCallback, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Spinner, StatusBadge } from '../components/ui';
import { colors, fontSize, spacing } from '../theme/tokens';
import { api, fileUrl } from '../api/client';
import type { Booking, Contract } from '../types';

interface BookingWithContracts extends Booking {
  contracts: Contract[];
}

export function ContractsScreen() {
  const [rows, setRows] = useState<BookingWithContracts[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const bookings = await api.get<Booking[]>('/bookings');
        const withContracts = await Promise.all(
          bookings.map(async (b) => ({ ...b, contracts: await api.get<Contract[]>(`/contracts/booking/${b.id}`) }))
        );
        setRows(withContracts.filter((b) => b.contracts.length > 0));
      })();
    }, [])
  );

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={styles.title}>My Contracts</Text>
        <Text style={styles.subtitle}>View and download your signed rental agreements.</Text>
      </View>

      {!rows ? (
        <Spinner />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          ListEmptyComponent={<EmptyState title="No contracts yet" description="Contracts appear here once staff generate them for a booking." />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.vehicleName}>{item.vehicle?.make} {item.vehicle?.model}</Text>
                <StatusBadge status={item.status} />
              </View>
              {item.contracts.map((c) => (
                <View key={c.id} style={{ marginTop: spacing.sm }}>
                  <Button
                    title={c.signed ? 'View Signed Contract' : 'View Contract PDF'}
                    variant="secondary"
                    onPress={() => Linking.openURL(fileUrl(c.pdf_file_path))}
                  />
                </View>
              ))}
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
  vehicleName: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
});
