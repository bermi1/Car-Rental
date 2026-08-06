import React, { useCallback, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, EmptyState, Spinner, StatusBadge } from '../../components/ui';
import { BookingStepper } from '../../components/BookingStepper';
import { PaymentSheet } from '../../components/PaymentSheet';
import { colors, fontSize, radius, spacing } from '../../theme/tokens';
import { api, fileUrl, ApiError } from '../../api/client';
import { useLocationSharing } from '../../hooks/useLocationSharing';
import { useT } from '../../i18n';
import type { BookingBalance, BookingDetailResponse, Payment } from '../../types';

function money(amount: number, currency: string) {
  return `${Number(amount).toLocaleString()} ${currency}`;
}

export function BookingDetailScreen({ route }: any) {
  const { id } = route.params;
  const t = useT();
  const [booking, setBooking] = useState<BookingDetailResponse | null>(null);
  const [balance, setBalance] = useState<BookingBalance | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    api.get<BookingDetailResponse>(`/bookings/${id}`).then(setBooking);
    api.get<BookingBalance>(`/payments/booking/${id}/balance`).then(setBalance).catch(() => setBalance(null));
    api.get<Payment[]>(`/payments/booking/${id}`).then(setPayments).catch(() => setPayments([]));
  }, [id]);

  useFocusEffect(load);

  const sharing = useLocationSharing(id, booking?.status ?? '', booking?.location_sharing_enabled ?? false);

  async function handleCancel() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/bookings/${id}/cancel`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return <Spinner />;

  const needsDocuments = booking.status === 'pending_documents';
  const isActive = booking.status === 'active';
  const outstanding = balance ? balance.balance : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
      <View style={styles.rowBetween}>
        <Text style={styles.vehicleName}>
          {booking.vehicle?.make} {booking.vehicle?.model}
        </Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.dates}>
        {new Date(booking.start_date).toLocaleDateString()} – {new Date(booking.end_date).toLocaleDateString()}
      </Text>
      <Text style={styles.route}>
        {booking.pickup_region} → {booking.dropoff_region}
        {booking.is_cross_region ? ` · ${t('booking.crossRegion')}` : ''}
      </Text>

      <Card style={{ marginTop: spacing.lg }}>
        <BookingStepper status={booking.status as any} />
      </Card>

      {needsDocuments && (
        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.status.pending.bg }}>
          <Text style={{ color: colors.status.pending.fg, fontWeight: '600' }}>{t('booking.actionNeeded')}</Text>
          <Text style={{ color: colors.status.pending.fg, marginTop: spacing.xs, fontSize: fontSize.sm }}>
            {t('booking.uploadPrompt')}
          </Text>
        </Card>
      )}

      {/* Money owed, and how to settle it. */}
      <Text style={styles.sectionTitle}>{t('balance.title')}</Text>
      <Card>
        {balance ? (
          <>
            <Row label={t('balance.quoted')} value={money(balance.quoted_amount, balance.currency)} />
            {balance.penalties > 0 && (
              <Row label={t('balance.penalties')} value={money(balance.penalties, balance.currency)} tone="danger" />
            )}
            <Row label={t('balance.paid')} value={money(balance.paid, balance.currency)} tone="success" />
            <View style={styles.divider} />
            {outstanding > 0 ? (
              <Row label={t('balance.outstanding')} value={money(outstanding, balance.currency)} strong />
            ) : (
              <Text style={styles.settled}>{t('balance.settled')}</Text>
            )}
          </>
        ) : (
          <Text style={styles.muted}>{t('common.loading')}…</Text>
        )}

        <Button
          title={t('payments.record')}
          onPress={() => setPaying(true)}
          style={{ marginTop: spacing.md }}
          variant={outstanding > 0 ? 'primary' : 'secondary'}
        />
      </Card>

      {payments.length > 0 && (
        <Card style={{ marginTop: spacing.sm }}>
          {payments.map((p, i) => (
            <View key={p.id} style={[styles.paymentRow, i > 0 && styles.paymentRowDivided]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentAmount}>{money(p.amount, p.currency)}</Text>
                <Text style={styles.paymentMeta}>
                  {p.reference || '—'} · {new Date(p.paid_at || p.created_at).toLocaleDateString()}
                </Text>
                {p.rejection_reason ? <Text style={styles.rejection}>{p.rejection_reason}</Text> : null}
              </View>
              <StatusBadge
                status={p.status === 'confirmed' ? 'confirmed' : p.status === 'rejected' ? 'cancelled' : 'pending_documents'}
                label={
                  p.status === 'confirmed'
                    ? t('payments.confirmed')
                    : p.status === 'rejected'
                      ? t('payments.rejectedStatus')
                      : t('payments.awaiting')
                }
              />
            </View>
          ))}
        </Card>
      )}

      {/* Location sharing — only meaningful while the car is out. */}
      {isActive && (
        <>
          <Text style={styles.sectionTitle}>{t('location.title')}</Text>
          <Card>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.switchLabel}>{t('location.enable')}</Text>
                <Text style={styles.muted}>
                  {sharing.enabled ? t('location.enabled') : t('location.disabled')}
                </Text>
              </View>
              <Switch
                value={sharing.enabled}
                disabled={sharing.busy}
                onValueChange={(next) => sharing.toggle(next)}
                trackColor={{ true: colors.primary[500], false: colors.neutral[200] }}
              />
            </View>
            <Text style={[styles.muted, { marginTop: spacing.sm, lineHeight: 18 }]}>{t('location.body')}</Text>
            {sharing.permissionDenied && <Text style={styles.error}>{t('location.denied')}</Text>}
            {sharing.enabled && (
              <Text style={[styles.muted, { marginTop: spacing.sm }]}>
                {sharing.lastSentAt
                  ? `${t('location.lastSent')}: ${sharing.lastSentAt.toLocaleTimeString()}`
                  : t('location.onlyActive')}
              </Text>
            )}
          </Card>
        </>
      )}

      <Text style={styles.sectionTitle}>{t('booking.contract')}</Text>
      {booking.contracts.length === 0 ? (
        <EmptyState title={t('booking.contractEmpty')} description={t('booking.contractEmptyHint')} />
      ) : (
        booking.contracts.map((c) => (
          <Card key={c.id} style={{ marginBottom: spacing.sm }}>
            <Button
              title={t('common.view')}
              variant="secondary"
              onPress={() => Linking.openURL(fileUrl(c.pdf_file_path))}
            />
          </Card>
        ))
      )}

      <Text style={styles.sectionTitle}>{t('booking.handover')}</Text>
      {booking.condition_reports.length === 0 ? (
        <EmptyState title={t('booking.handoverEmpty')} description={t('booking.handoverEmptyHint')} />
      ) : (
        booking.condition_reports.map((r) => (
          <Card key={r.id} style={{ marginBottom: spacing.sm }}>
            <Text style={styles.reportType}>
              {r.type === 'check_in' ? t('booking.checkIn') : t('booking.checkOut')}
            </Text>
            <Text style={styles.reportMeta}>
              {t('booking.fuel')}: {r.fuel_level} · {t('booking.mileage')}: {r.mileage.toLocaleString()} km
            </Text>
            {r.notes ? <Text style={styles.reportNotes}>{r.notes}</Text> : null}
            {r.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                {r.photos.map((p, i) => (
                  <Image key={i} source={{ uri: fileUrl(p) }} style={styles.reportPhoto} />
                ))}
              </ScrollView>
            )}
            {r.video_path ? (
              <View style={styles.videoRow}>
                <Ionicons name="videocam" size={16} color={colors.primary[600]} />
                <Text style={styles.videoLink} onPress={() => Linking.openURL(fileUrl(r.video_path!))}>
                  {t('booking.watchVideo')}
                </Text>
              </View>
            ) : null}
          </Card>
        ))
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!['completed', 'cancelled'].includes(booking.status) && (
        <Button
          title={t('booking.cancel')}
          variant="danger"
          onPress={handleCancel}
          isLoading={busy}
          style={{ marginTop: spacing.lg }}
        />
      )}

      <PaymentSheet
        open={paying}
        onClose={() => setPaying(false)}
        bookingId={id}
        currency={balance?.currency || booking.quoted_currency}
        suggestedAmount={outstanding}
        onRecorded={load}
      />
    </ScrollView>
  );
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: 'danger' | 'success';
  strong?: boolean;
}) {
  const valueColor =
    tone === 'danger' ? colors.status.cancelled.fg : tone === 'success' ? colors.status.active.fg : colors.neutral[900];
  return (
    <View style={styles.balanceRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={[styles.balanceValue, { color: valueColor }, strong && styles.balanceValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.neutral[50] },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vehicleName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.neutral[900], flex: 1, marginRight: spacing.sm },
  dates: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs },
  route: { fontSize: fontSize.sm, color: colors.neutral[400], marginTop: 2 },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.neutral[900],
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  muted: { fontSize: fontSize.sm, color: colors.neutral[500] },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  balanceValue: { fontSize: fontSize.sm, fontWeight: '600' },
  balanceValueStrong: { fontSize: fontSize.lg, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.neutral[100], marginVertical: spacing.sm },
  settled: { fontSize: fontSize.sm, fontWeight: '600', color: colors.status.active.fg },
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  paymentRowDivided: { borderTopWidth: 1, borderTopColor: colors.neutral[100] },
  paymentAmount: { fontSize: fontSize.sm, fontWeight: '600', color: colors.neutral[900] },
  paymentMeta: { fontSize: fontSize.xs, color: colors.neutral[400], marginTop: 2 },
  rejection: { fontSize: fontSize.xs, color: colors.status.cancelled.fg, marginTop: 2 },
  switchLabel: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
  reportType: { fontSize: fontSize.sm, fontWeight: '600', color: colors.neutral[900] },
  reportMeta: { fontSize: fontSize.xs, color: colors.neutral[500], marginTop: 2 },
  reportNotes: { fontSize: fontSize.xs, color: colors.neutral[400], marginTop: spacing.xs },
  reportPhoto: { width: 96, height: 96, borderRadius: radius.md, marginRight: spacing.sm },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  videoLink: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary[600] },
  error: { color: colors.status.cancelled.fg, fontSize: fontSize.sm, marginTop: spacing.sm },
});
