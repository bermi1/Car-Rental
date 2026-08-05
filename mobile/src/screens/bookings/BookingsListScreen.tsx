import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, Spinner, StatusBadge } from '../../components/ui';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { api } from '../../api/client';
import type { Booking } from '../../types';

export function BookingsListScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.get<Booking[]>('/bookings').then(setBookings);
    }, [])
  );

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>Your rental history and upcoming trips.</Text>
      </View>

      {!bookings ? (
        <Spinner />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          ListEmptyComponent={<EmptyState title="No bookings yet" description="Browse vehicles to request your first booking." />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { id: item.id })}>
              <Card>
                <View style={styles.rowBetween}>
                  <Text style={styles.vehicleName}>{item.vehicle?.make} {item.vehicle?.model}</Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text style={styles.dates}>
                  {new Date(item.start_date).toLocaleDateString()} – {new Date(item.end_date).toLocaleDateString()}
                </Text>
                <Text style={styles.route}>
                  {item.pickup_region} → {item.dropoff_region}
                  {item.is_cross_region ? ' · Cross-region' : ''}
                </Text>
              </Card>
            </TouchableOpacity>
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vehicleName: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900], flex: 1, marginRight: spacing.sm },
  dates: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  route: { fontSize: fontSize.xs, color: colors.neutral[400], marginTop: 2 },
});
