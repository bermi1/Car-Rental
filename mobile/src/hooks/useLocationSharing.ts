import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { api } from '../api/client';

/** How often a position is sent while sharing is on. */
const PING_INTERVAL_MS = 2 * 60 * 1000;

export interface LocationSharingState {
  /** Whether the booking has sharing switched on, as the server sees it. */
  enabled: boolean;
  /** True while the permission prompt or the toggle request is in flight. */
  busy: boolean;
  /** Set when the OS refused location access. */
  permissionDenied: boolean;
  /** When we last successfully sent a position, for showing the user. */
  lastSentAt: Date | null;
  toggle: (next: boolean) => Promise<void>;
}

/**
 * Shares the phone's position against one booking.
 *
 * Foreground only, deliberately: the app pings while the client has it open,
 * and the server drops anything sent outside an active rental. Nothing is
 * collected in the background, and nothing is collected before the client
 * turns this on — which is what they were told at handover.
 */
export function useLocationSharing(
  bookingId: string,
  bookingStatus: string,
  initialEnabled: boolean
): LocationSharingState {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep in step if the booking reloads with a different value.
  useEffect(() => setEnabled(initialEnabled), [initialEnabled]);

  const sendPing = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const res = await api.post<{ recorded: boolean }>('/tracking/pings', {
        booking_id: bookingId,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy_m: position.coords.accuracy ?? undefined,
        speed_kph:
          position.coords.speed != null && position.coords.speed >= 0
            ? position.coords.speed * 3.6
            : undefined,
      });
      if (res.recorded) setLastSentAt(new Date());
    } catch {
      // A dropped ping is not worth interrupting the client for; the next
      // tick will try again.
    }
  }, [bookingId]);

  useEffect(() => {
    const shouldPing = enabled && bookingStatus === 'active';
    if (!shouldPing) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }

    sendPing();
    timer.current = setInterval(sendPing, PING_INTERVAL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [enabled, bookingStatus, sendPing]);

  const toggle = useCallback(
    async (next: boolean) => {
      setBusy(true);
      try {
        if (next) {
          const { granted } = await Location.requestForegroundPermissionsAsync();
          if (!granted) {
            setPermissionDenied(true);
            return;
          }
          setPermissionDenied(false);
        }
        await api.put(`/tracking/bookings/${bookingId}/sharing`, { enabled: next });
        setEnabled(next);
      } finally {
        setBusy(false);
      }
    },
    [bookingId]
  );

  return { enabled, busy, permissionDenied, lastSentAt, toggle };
}
