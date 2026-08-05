import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { BrowseScreen } from '../screens/browse/BrowseScreen';
import { VehicleDetailScreen } from '../screens/browse/VehicleDetailScreen';

const Stack = createNativeStackNavigator();

export function BrowseNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary[500], headerTitleStyle: { color: colors.neutral[900] } }}>
      <Stack.Screen name="Browse" component={BrowseScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} options={{ title: 'Vehicle' }} />
    </Stack.Navigator>
  );
}
