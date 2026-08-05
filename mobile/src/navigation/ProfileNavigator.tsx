import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/tokens';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { DevicesScreen } from '../screens/profile/DevicesScreen';

const Stack = createNativeStackNavigator();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: colors.primary[500], headerTitleStyle: { color: colors.neutral[900] } }}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Devices" component={DevicesScreen} options={{ title: 'My Devices' }} />
    </Stack.Navigator>
  );
}
