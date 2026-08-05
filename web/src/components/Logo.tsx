import React from 'react';

/**
 * Bermi Rentals mark — the rounded-square "B" with the car cut into its bowl,
 * drawn as inline SVG so it stays crisp at any size and needs no network fetch.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect width="100" height="100" rx="26" fill="#0B63F6" />
      {/* B stem and bowls */}
      <path
        d="M34 24h24c9.4 0 15.6 5 15.6 12.6 0 5-2.6 8.6-7 10.4 5.6 1.6 9 5.8 9 11.8 0 8.4-6.6 13.8-17 13.8H41.6C33.4 72.6 28 67.4 28 58.8c0-1 .1-2 .2-3L34 24z"
        fill="#fff"
      />
      {/* Car silhouette sitting in the lower bowl */}
      <path
        d="M36 56.5h30a1 1 0 0 0 1-1.2l-.7-3.6a3 3 0 0 0-1.6-2.1l-5.4-2.6a5 5 0 0 0-2.2-.5H46.4a5 5 0 0 0-3.3 1.2l-5.6 4.9a3 3 0 0 0-1 2.3v.6a1 1 0 0 0 1 1z"
        fill="#0B63F6"
      />
      <circle cx="55.5" cy="59.5" r="4.2" fill="#0B63F6" />
      <circle cx="55.5" cy="59.5" r="1.8" fill="#fff" />
    </svg>
  );
}

/** Mark plus wordmark, matching the brand lockup. */
export function Logo({
  size = 40,
  showSystem = true,
  className,
}: {
  size?: number;
  showSystem?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-[15px] font-bold leading-tight tracking-[-0.01em]">
          <span className="text-fg">Bermi </span>
          <span className="text-accent">Rentals</span>
        </span>
        {showSystem && (
          <span className="block text-[9px] font-semibold uppercase leading-tight tracking-[0.35em] text-fg-subtle">
            System
          </span>
        )}
      </span>
    </div>
  );
}

/** Stacked lockup for the login and splash screens. */
export function LogoStacked({ size = 72 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center">
      <LogoMark size={size} />
      <span className="mt-4 text-xl font-bold tracking-[-0.01em]">
        <span className="text-fg">Bermi </span>
        <span className="text-accent">Rentals</span>
      </span>
      <span className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.4em] text-fg-subtle">
        <span className="h-px w-5 bg-accent/40" />
        System
        <span className="h-px w-5 bg-accent/40" />
      </span>
    </div>
  );
}
