import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Input, Spinner } from '../../components/ui';
import { colors, fontSize, spacing, radius } from '../../theme/tokens';
import { api, fileUrl, ApiError } from '../../api/client';
import type { Vehicle } from '../../types';

export function VehicleDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentalType, setRentalType] = useState<'self_drive' | 'driver_included'>('self_drive');
  const [pickupRegion, setPickupRegion] = useState('');
  const [dropoffRegion, setDropoffRegion] = useState('');
  const [currency, setCurrency] = useState<'TZS' | 'USD'>('TZS');
  const [quote, setQuote] = useState<{ days: number; amount: number } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Vehicle>(`/vehicles/${id}`).then(setVehicle);
  }, [id]);

  useEffect(() => {
    if (!startDate || !endDate) {
      setQuote(null);
      return;
    }
    api
      .post<{ days: number; amount: number }>('/bookings/quote', { vehicle_id: id, start_date: startDate, end_date: endDate, currency })
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [startDate, endDate, currency, id]);

  async function handleRequest() {
    setError('');
    if (!startDate || !endDate || !pickupRegion || !dropoffRegion) {
      setError('Please fill in dates and pickup/drop-off regions.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/bookings', {
        vehicle_id: id,
        rental_type: rentalType,
        start_date: startDate,
        end_date: endDate,
        pickup_region: pickupRegion,
        dropoff_region: dropoffRegion,
        quoted_currency: currency,
        quoted_amount: quote?.amount ?? 0,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to request booking');
    } finally {
      setSaving(false);
    }
  }

  if (!vehicle) return <Spinner />;

  if (success) {
    return (
      <View style={styles.successScreen}>
        <Text style={styles.successTitle}>Booking Requested</Text>
        <Text style={styles.successDescription}>
          Your request is pending document verification. Upload your ID and driving license to move it forward.
        </Text>
        <Button title="Upload Documents" onPress={() => navigation.navigate('DocumentsTab')} style={{ marginTop: spacing.lg }} />
        <Button title="View My Bookings" variant="secondary" onPress={() => navigation.navigate('BookingsTab')} style={{ marginTop: spacing.sm }} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg }}>
      {vehicle.photos[0] ? (
        <Image source={{ uri: fileUrl(vehicle.photos[0]) }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, { backgroundColor: colors.neutral[100] }]} />
      )}
      <Text style={styles.name}>{vehicle.make} {vehicle.model}</Text>
      <Text style={styles.meta}>{vehicle.category} · {vehicle.plate_number}</Text>
      <Text style={styles.rate}>{Number(vehicle.daily_rate_tzs).toLocaleString()} TZS/day</Text>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={styles.formTitle}>Request a Booking</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input label="Start Date" placeholder="YYYY-MM-DD" value={startDate} onChangeText={setStartDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="End Date" placeholder="YYYY-MM-DD" value={endDate} onChangeText={setEndDate} />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input label="Pickup Region" value={pickupRegion} onChangeText={setPickupRegion} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Drop-off Region" value={dropoffRegion} onChangeText={setDropoffRegion} />
          </View>
        </View>

        <Text style={styles.label}>Rental Type</Text>
        <View style={styles.toggleRow}>
          {(['self_drive', 'driver_included'] as const).map((t) => (
            <Button
              key={t}
              title={t === 'self_drive' ? 'Self-Drive' : 'With Driver'}
              variant={rentalType === t ? 'primary' : 'secondary'}
              onPress={() => setRentalType(t)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        <Text style={styles.label}>Currency</Text>
        <View style={styles.toggleRow}>
          {(['TZS', 'USD'] as const).map((c) => (
            <Button
              key={c}
              title={c}
              variant={currency === c ? 'primary' : 'secondary'}
              onPress={() => setCurrency(c)}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        {pickupRegion && dropoffRegion && pickupRegion.trim().toLowerCase() !== dropoffRegion.trim().toLowerCase() && (
          <Text style={styles.crossRegionNote}>This is a cross-region rental.</Text>
        )}

        {quote && (
          <Text style={styles.quote}>
            Estimated total: <Text style={{ fontWeight: '700' }}>{quote.amount.toLocaleString()} {currency}</Text> for {quote.days} day(s)
          </Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Request Booking" onPress={handleRequest} isLoading={saving} style={{ marginTop: spacing.md }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  hero: { width: '100%', height: 180, borderRadius: radius.lg },
  name: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900], marginTop: spacing.md },
  meta: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: 2 },
  rate: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary[600], marginTop: spacing.xs },
  formTitle: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900], marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.neutral[700], marginBottom: spacing.xs },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  crossRegionNote: {
    fontSize: fontSize.sm,
    color: colors.status.pending.fg,
    backgroundColor: colors.status.pending.bg,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  quote: { fontSize: fontSize.sm, color: colors.neutral[600], marginBottom: spacing.sm },
  error: { color: colors.status.cancelled.fg, fontSize: fontSize.sm, marginBottom: spacing.sm },
  successScreen: { flex: 1, backgroundColor: colors.neutral[50], padding: spacing.xl, justifyContent: 'center' },
  successTitle: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900], textAlign: 'center' },
  successDescription: { fontSize: fontSize.sm, color: colors.neutral[500], textAlign: 'center', marginTop: spacing.sm },
});
