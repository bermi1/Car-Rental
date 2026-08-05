import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme/tokens';

export function Spinner() {
  return (
    <View style={styles.wrapper}>
      <ActivityIndicator color={colors.primary[500]} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingVertical: spacing.xxl, alignItems: 'center', justifyContent: 'center' },
});
