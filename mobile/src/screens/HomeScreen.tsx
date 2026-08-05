import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Spinner, StatusBadge } from '../components/ui';
import { colors, fontSize, spacing, radius } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import type { Booking } from '../types';

function daysRemaining(endDate: string): number {
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 0);
}

export function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.get<Booking[]>('/bookings').then(setBookings);
    }, [])
  );

  if (!bookings) return <Spinner />;

  const active = bookings.find((b) => b.status === 'active');
  const upcoming = bookings.find((b) => ['confirmed', 'documents_submitted', 'pending_documents'].includes(b.status));
  const pastCount = bookings.filter((b) => b.status === 'completed').length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>Here's what's happening with your rentals.</Text>

      {active && active.vehicle ? (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.primary[500] }}>
          <Text style={styles.activeLabel}>CURRENT RENTAL</Text>
          <Text style={styles.activeVehicle}>{active.vehicle.make} {active.vehicle.model}</Text>
          <Text style={styles.activeDatesOnPrimary}>
            {new Date(active.start_date).toLocaleDateString()} – {new Date(active.end_date).toLocaleDateString()}
          </Text>
          <View style={styles.activeFooter}>
            <Text style={styles.daysRemaining}>{daysRemaining(active.end_date)} day(s) remaining</Text>
            <Button
              title="View Details"
              variant="secondary"
              onPress={() => navigation.navigate('BookingsTab', { screen: 'BookingDetail', params: { id: active.id } })}
            />
          </View>
        </Card>
      ) : (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={styles.noActiveTitle}>No active rental right now</Text>
          <Text style={styles.noActiveDescription}>Browse available vehicles to plan your next trip.</Text>
          <Button title="Browse Vehicles" onPress={() => navigation.navigate('BrowseTab')} style={{ marginTop: spacing.md }} />
        </Card>
      )}

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{pastCount}</Text>
          <Text style={styles.statLabel}>Past Rentals</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{upcoming ? 1 : 0}</Text>
          <Text style={styles.statLabel}>Upcoming</Text>
        </Card>
      </View>

      {upcoming && upcoming.vehicle && (
        <Card style={{ marginTop: spacing.lg }}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Upcoming Rental</Text>
            <StatusBadge status={upcoming.status} />
          </View>
          <Text style={styles.upcomingVehicle}>{upcoming.vehicle.make} {upcoming.vehicle.model}</Text>
          <Text style={styles.activeDates}>
            {new Date(upcoming.start_date).toLocaleDateString()} – {new Date(upcoming.end_date).toLocaleDateString()}
          </Text>
        </Card>
      )}

      <Button
        title="Browse & Book a Vehicle"
        variant="secondary"
        onPress={() => navigation.navigate('BrowseTab')}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  greeting: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900] },
  subtitle: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  activeLabel: { color: colors.primary[100], fontSize: fontSize.xs, fontWeight: '700', letterSpacing: 1 },
  activeVehicle: { color: colors.white, fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.xs },
  activeDatesOnPrimary: { color: colors.primary[100], fontSize: fontSize.sm, marginTop: 2 },
  activeDates: { color: colors.neutral[500], fontSize: fontSize.sm, marginTop: 2 },
  activeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  daysRemaining: { color: colors.primary[100], fontSize: fontSize.sm, fontWeight: '600' },
  noActiveTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
  noActiveDescription: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900] },
  statLabel: { fontSize: fontSize.xs, color: colors.neutral[500], marginTop: spacing.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
  upcomingVehicle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.neutral[900], marginTop: spacing.sm },
});
