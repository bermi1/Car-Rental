import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, fontSize, statusColorFor, bookingStatusLabels, BookingStatus } from '../../theme/tokens';

export function StatusBadge({ status }: { status: BookingStatus | string }) {
  const color = statusColorFor(status);
  const label = (bookingStatusLabels as any)[status] || status.replace(/_/g, ' ');
  return (
    <View style={[styles.badge, { backgroundColor: color.bg }]}>
      <View style={[styles.dot, { backgroundColor: color.fg }]} />
      <Text style={[styles.label, { color: color.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.full,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
