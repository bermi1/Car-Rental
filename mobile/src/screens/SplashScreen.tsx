import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, ActivityIndicator, Easing } from 'react-native';

/**
 * BERMI RENTALS splash.
 *
 * Expo's native splash covers the very first frame; this takes over from there
 * and stays up while the stored session is checked, so the app never shows a
 * bare screen between launch and the first real view.
 */
export function SplashScreen({ message }: { message?: string }) {
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, rise]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center' }}>
        <View style={styles.mark}>
          <Text style={styles.markText}>B</Text>
        </View>
        <Text style={styles.title}>BERMI RENTALS</Text>
        <Text style={styles.subtitle}>TANZANIA</Text>
      </Animated.View>

      <View style={styles.footer}>
        <ActivityIndicator color="#5A9EFF" />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0C10',
    paddingHorizontal: 24,
  },
  mark: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#0B63F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    shadowColor: '#0B63F6',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  markText: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
  },
  title: {
    color: '#EEF0F5',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 6,
    color: '#707586',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
  },
  message: {
    marginTop: 12,
    color: '#9A9FB0',
    fontSize: 13,
  },
});
