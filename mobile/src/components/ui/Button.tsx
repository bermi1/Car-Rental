import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: Variant;
  isLoading?: boolean;
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', isLoading, style, disabled, ...rest }: ButtonProps) {
  const variantStyle = variantStyles[variant];
  return (
    <TouchableOpacity
      style={[styles.base, variantStyle.container, style, (disabled || isLoading) && styles.disabled]}
      disabled={disabled || isLoading}
      activeOpacity={0.8}
      {...rest}
    >
      {isLoading ? (
        <ActivityIndicator color={variantStyle.text.color} size="small" />
      ) : (
        <Text style={[styles.text, variantStyle.text]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});

const variantStyles: Record<Variant, { container: ViewStyle; text: { color: string } }> = {
  primary: { container: { backgroundColor: colors.primary[500] }, text: { color: colors.white } },
  secondary: { container: { backgroundColor: colors.neutral[100] }, text: { color: colors.neutral[800] } },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.neutral[700] } },
  danger: { container: { backgroundColor: colors.status.cancelled.fg }, text: { color: colors.white } },
};
