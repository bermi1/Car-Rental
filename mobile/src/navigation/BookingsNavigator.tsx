import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { BookingsListScreen } from '../screens/bookings/BookingsListScreen';
import { BookingDetailScreen } from '../screens/bookings/BookingDetailScreen';

const Stack = createNativeStackNavigator();

export function BookingsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary[500], headerTitleStyle: { color: colors.neutral[900] } }}>
      <Stack.Screen name="BookingsList" component={BookingsListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ title: 'Booking' }} />
    </Stack.Navigator>
  );
}
