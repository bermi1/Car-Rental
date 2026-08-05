import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, EmptyState, Input, Spinner } from '../../components/ui';
import { colors, fontSize, spacing, radius } from '../../theme/tokens';
import { api, fileUrl } from '../../api/client';
import type { Vehicle } from '../../types';

export function BrowseScreen({ navigation }: any) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [category, setCategory] = useState('');

  useEffect(() => {
    const qs = new URLSearchParams({ status: 'available' });
    if (category) qs.set('category', category);
    api.get<Vehicle[]>(`/vehicles?${qs.toString()}`).then(setVehicles);
  }, [category]);

  return (
    <View style={styles.screen}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Text style={styles.title}>Browse Vehicles</Text>
        <Text style={styles.subtitle}>Find your next ride and request a booking.</Text>
        <Input placeholder="Filter by category (e.g. SUV, Sedan)" value={category} onChangeText={setCategory} />
      </View>

      {!vehicles ? (
        <Spinner />
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
          ListEmptyComponent={<EmptyState title="No vehicles available" description="Try a different category." />}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('VehicleDetail', { id: item.id })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                {item.photos[0] ? (
                  <Image source={{ uri: fileUrl(item.photos[0]) }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.vehicleName}>{item.make} {item.model}</Text>
                  <Text style={styles.vehicleMeta}>{item.category} · {item.plate_number}</Text>
                  <Text style={styles.vehicleRate}>{Number(item.daily_rate_tzs).toLocaleString()} TZS/day</Text>
                </View>
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
  subtitle: { fontSize: fontSize.sm, color: colors.neutral[500], marginTop: spacing.xs, marginBottom: spacing.md },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  thumbPlaceholder: { backgroundColor: colors.neutral[100] },
  vehicleName: { fontSize: fontSize.base, fontWeight: '600', color: colors.neutral[900] },
  vehicleMeta: { fontSize: fontSize.xs, color: colors.neutral[500], marginTop: 2 },
  vehicleRate: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary[600], marginTop: spacing.xs },
});
