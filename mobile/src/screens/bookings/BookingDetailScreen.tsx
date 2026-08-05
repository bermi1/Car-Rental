import React, { useCallback, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Spinner, StatusBadge } from '../../components/ui';
import { BookingStepper } from '../../components/BookingStepper';
import { colors, fontSize, spacing } from '../../theme/tokens';
import { api, fileUrl, ApiError } from '../../api/client';
import type { BookingDetailResponse } from '../../types';

export function BookingDetailScreen({ route }: any) {
  const { id } = route.params;
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<BookingDetailResponse>(`/bookings/${id}`).then(setBooking);
  }, [id]);

  useFocusEffect(load);

  async function handleCancel() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/bookings/${id}/cancel`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel booking');
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return <Spinner />;

  const needsDocuments = booking.status === 'pending_documents';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={styles.rowBetween}>
        <Text style={styles.vehicleName}>{booking.vehicle?.make} {booking.vehicle?.model}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.dates}>
        {new Date(booking.start_date).toLocaleDateString()} – {new Date(booking.end_date).toLocaleDateString()}
      </Text>
      <Text style={styles.route}>
        {booking.pickup_region} → {booking.dropoff_region}
        {booking.is_cross_region ? ' · Cross-region rental' : ''}
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <BookingStepper status={booking.status as any} />
      </Card>

      {needsDocuments && (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.status.pending.bg }}>
          <Text style={{ color: colors.status.pending.fg, fontWeight: '600' }}>Action needed</Text>
          <Text style={{ color: colors.status.pending.fg, marginTop: spacing.xs, fontSize: fontSize.sm }}>
            Upload your ID and driving license from the Documents tab to move this booking forward.
          </Text>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Contract</Text>
      {booking.contracts.length === 0 ? (
        <EmptyState title="Not generated yet" description="Your rental contract will appear here once staff generates it." />
      ) : (
        booking.contracts.map((c) => (
          <Card key={c.id} style={{ marginBottom: spacing.sm }}>
            <Button title="View / Download Contract PDF" variant="secondary" onPress={() => Linking.openURL(fileUrl(c.pdf_file_path))} />
          </Card>
        ))
      )}

      <Text style={styles.sectionTitle}>Condition Reports</Text>
      {booking.condition_reports.length === 0 ? (
        <EmptyState title="No condition reports yet" description="These appear after check-in and check-out." />
      ) : (
        booking.condition_reports.map((r) => (
          <Card key={r.id} style={{ marginBottom: spacing.sm }}>
            <Text style={styles.reportType}>{r.type === 'check_in' ? 'Check-In' : 'Check-Out'}</Text>
            <Text style={styles.reportMeta}>Fuel: {r.fuel_level} · Mileage: {r.mileage.toLocaleString()} km</Text>
            {r.notes ? <Text style={styles.reportNotes}>{r.notes}</Text> : null}
            {r.photos.length > 0 && (
              <ScrollView horizontal style={{ marginTop: spacing.sm }}>
                {r.photos.map((p, i) => (
                  <Image key={i} source={{ uri: fileUrl(p) }} style={styles.reportPhoto} />
                ))}
              </ScrollView>
            )}
          </Card>
        ))
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!['completed', 'cancelled'].includes(booking.status) && (
        <Button title="Cancel Booking" variant="danger" onPress={handleCancel} isLoading={busy} style={{ marginTop: spacing.lg }} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vehicleName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900], flex: 1, marginRight: spacing.sm },
  dates: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  route: { fontSize: fontSize.sm, color: colors.neutral[400], marginTop: 2 },
  sectionTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900], marginTop: spacing.xl, marginBottom: spacing.sm },
  reportType: { fontSize: fontSize.sm, fontWeight: '600', color: colors.neutral[900] },
  reportMeta: { fontSize: fontSize.xs, color: colors.neutral[500], marginTop: 2 },
  reportNotes: { fontSize: fontSize.xs, color: colors.neutral[400], marginTop: spacing.xs },
  reportPhoto: { width: 96, height: 96, borderRadius: 8, marginRight: spacing.sm },
  error: { color: colors.status.cancelled.fg, fontSize: fontSize.sm, marginTop: spacing.sm },
});
