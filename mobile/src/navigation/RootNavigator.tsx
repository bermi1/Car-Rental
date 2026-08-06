import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { SplashScreen } from '../screens/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { AppTabs } from './AppTabs';

export function RootNavigator() {
  const { user, loading } = useAuth();

  // The branded hold, not a bare spinner — this is the first thing the user
  // sees after the native splash while the stored session is checked.
  if (loading) return <SplashScreen />;

  return <NavigationContainer>{user ? <AppTabs /> : <AuthNavigator />}</NavigationContainer>;
}
