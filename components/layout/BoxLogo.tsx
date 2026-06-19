'use client';

import { useId } from 'react';

interface BoxLogoProps {
  /** When true, the "ox" slides left behind the B and only the B stays visible. */
  collapsed?: boolean;
  /** 'light' for light backgrounds, 'dark' for dark backgrounds. */
  variant?: 'light' | 'dark';
  /** One-shot pulse bounce on mount (uses the .sidebar-icon-pulse keyframes). */
  pulse?: boolean;
  /** Rendered height in px. Width is derived from the wordmark aspect ratio. */
  height?: number;
}

// Wordmark viewBox is "9.5 6 68 33" (aspect 68:33).
const VB_WIDTH = 68;
const VB_HEIGHT = 33;
// The "B" glyph spans roughly x≈11.7..35.5 — show up to x≈37 when collapsed.
const B_RIGHT_EDGE = 37;
// Clip the "ox" to everything to the right of the B so it vanishes at the B's edge.
const OX_CLIP_X = 36;
// Distance (in user units) the "ox" travels left to fully tuck behind the B.
const OX_SLIDE = 40;

/**
 * The "Box" wordmark logo. Collapsing animates the "ox" sliding left behind the
 * "B"; the B's right edge clips it so it disappears cleanly rather than showing
 * through the open strokes of the letter.
 */
export function BoxLogo({
  collapsed = false,
  variant = 'light',
  pulse = false,
  height = 30,
}: BoxLogoProps) {
  const clipId = useId();
  const bar = variant === 'dark' ? '#ffffff' : '#0f172a';
  const accent = variant === 'dark' ? '#38BDF8' : '#0284c7';

  const fullWidth = (height * VB_WIDTH) / VB_HEIGHT;
  const collapsedWidth = (height * (B_RIGHT_EDGE - 9.5)) / VB_HEIGHT;

  return (
    <div
      className={pulse ? 'sidebar-icon-pulse' : undefined}
      style={{
        height,
        width: collapsed ? collapsedWidth : fullWidth,
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(0.2, 0, 0, 1)',
        flexShrink: 0,
      }}
    >
      <svg
        width={fullWidth}
        height={height}
        viewBox="9.5 6 68 33"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={OX_CLIP_X} y={0} width={60} height={48} />
          </clipPath>
        </defs>

        {/* "ox" — clipped to the region right of the B; slides left to hide behind it */}
        <g clipPath={`url(#${clipId})`}>
          <g
            style={{
              transform: collapsed ? `translateX(-${OX_SLIDE}px)` : 'translateX(0)',
              transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
            }}
          >
            <circle cx="48" cy="28.5" r="8.5" stroke={bar} strokeWidth="3.2" fill="none" />
            <path d="M59.5 20.5 L74 37" stroke={bar} strokeWidth="3.2" />
            <path d="M74 20.5 L59.5 37" stroke={bar} strokeWidth="3.2" />
          </g>
        </g>

        {/* "B" — always visible, painted on top */}
        <g>
          <rect x="13" y="11" width="3" height="26" fill={bar} />
          <path
            d="M16 11 L27 11 L33 17.5 L27 24 L16 24"
            stroke={accent}
            strokeWidth="3"
            strokeLinejoin="miter"
            fill="none"
          />
          <path
            d="M16 24 L28 24 L34 30.5 L28 37 L16 37"
            stroke={accent}
            strokeWidth="3"
            strokeLinejoin="miter"
            fill="none"
          />
          <circle cx="14.5" cy="11" r="2.8" fill={bar} />
        </g>
      </svg>
    </div>
  );
}
