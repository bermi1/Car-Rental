import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { AuthNavigator } from './AuthNavigator';
import { AppTabs } from './AppTabs';

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  return <NavigationContainer>{user ? <AppTabs /> : <AuthNavigator />}</NavigationContainer>;
}
