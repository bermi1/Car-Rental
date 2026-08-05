import React from 'react';
import { LogoStacked } from './Logo';

/**
 * Shown while the session is being restored on boot.
 *
 * A branded hold beats a blank screen or a bare spinner: on a slow connection
 * the token check is the first thing that happens, and this is what the user
 * looks at while it does.
 */
export function Splash({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6">
      <div className="animate-slide-up flex flex-col items-center">
        <LogoStacked size={68} />

        <span
          className="mt-8 h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
          role="status"
          aria-label={message ?? 'Loading'}
        />
        {message && <p className="mt-3 text-[13px] text-fg-muted">{message}</p>}
      </div>
    </div>
  );
}
