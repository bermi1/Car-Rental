import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, spacing, radius, bookingStatusOrder, bookingStatusLabels, BookingStatus } from '../theme/tokens';

export function BookingStepper({ status }: { status: BookingStatus }) {
  if (status === 'cancelled') {
    return (
      <View style={[styles.cancelledBanner, { backgroundColor: colors.status.cancelled.bg }]}>
        <Text style={{ color: colors.status.cancelled.fg, fontWeight: '600' }}>Cancelled</Text>
      </View>
    );
  }

  const currentIndex = bookingStatusOrder.indexOf(status);

  return (
    <View style={styles.row}>
      {bookingStatusOrder.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <View key={step} style={styles.stepWrapper}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.circle,
                  done && { backgroundColor: colors.primary[500] },
                  current && { backgroundColor: colors.primary[100], borderWidth: 2, borderColor: colors.primary[400] },
                  !done && !current && { backgroundColor: colors.neutral[100] },
                ]}
              >
                <Text style={[styles.circleText, done && { color: colors.white }, current && { color: colors.primary[700] }]}>
                  {done ? '✓' : i + 1}
                </Text>
              </View>
              {i < bookingStatusOrder.length - 1 && (
                <View style={[styles.connector, { backgroundColor: done ? colors.primary[500] : colors.neutral[200] }]} />
              )}
            </View>
            <Text style={[styles.stepLabel, current && { color: colors.neutral[900], fontWeight: '600' }]} numberOfLines={2}>
              {bookingStatusLabels[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const CIRCLE_SIZE = 26;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  stepWrapper: { alignItems: 'center', flex: 1 },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.neutral[400] },
  connector: { flex: 1, height: 2, marginHorizontal: 2 },
  stepLabel: {
    fontSize: 10,
    color: colors.neutral[400],
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  cancelledBanner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
});
