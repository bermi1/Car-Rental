import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/tokens';
import { HomeScreen } from '../screens/HomeScreen';
import { BrowseNavigator } from './BrowseNavigator';
import { BookingsNavigator } from './BookingsNavigator';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { ProfileNavigator } from './ProfileNavigator';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  HomeTab: 'home',
  BrowseTab: 'car-sport',
  BookingsTab: 'calendar',
  DocumentsTab: 'document-text',
  ContractsTab: 'reader',
  ProfileTab: 'person-circle',
};

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.neutral[400],
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ color, size }) => <Ionicons name={ICONS[route.name]} color={color} size={size ? size - 4 : 18} />,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="BrowseTab" component={BrowseNavigator} options={{ tabBarLabel: 'Browse' }} />
      <Tab.Screen name="BookingsTab" component={BookingsNavigator} options={{ tabBarLabel: 'Bookings' }} />
      <Tab.Screen name="DocumentsTab" component={DocumentsScreen} options={{ tabBarLabel: 'Documents' }} />
      <Tab.Screen name="ContractsTab" component={ContractsScreen} options={{ tabBarLabel: 'Contracts' }} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
