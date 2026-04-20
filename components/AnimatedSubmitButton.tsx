'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';

type AnimationState = 'idle' | 'morphing' | 'flying' | 'success' | 'done';
type Variant = 'send' | 'approve' | 'reject';

interface AnimatedSubmitButtonProps {
  children: React.ReactNode;
  onClick: () => Promise<void>;
  variant?: Variant;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

const STYLES = `
@keyframes asb-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes asb-fade-in {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes asb-fly-away {
  0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
  25% { opacity: 1; transform: translate(20px, -40px) rotate(-5deg) scale(0.95); }
  50% { opacity: 1; transform: translate(50px, -100px) rotate(-12deg) scale(0.75); }
  100% { opacity: 0; transform: translate(180px, -320px) rotate(-25deg) scale(0.15); }
}

@keyframes asb-particle {
  0% { opacity: 0.9; transform: scale(1); }
  60% { opacity: 0.5; transform: scale(0.5); }
  100% { opacity: 0; transform: scale(0.1); }
}

@keyframes asb-check-bounce {
  0% { opacity: 0; transform: scale(0); }
  40% { opacity: 1; transform: scale(1.3); }
  60% { transform: scale(0.85); }
  80% { transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes asb-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-8px); }
  30% { transform: translateX(8px); }
  45% { transform: translateX(-6px); }
  60% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  90% { transform: translateX(3px); }
}

@media (prefers-reduced-motion: reduce) {
  .asb-root * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;

const PaperPlaneIcon: React.FC = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);

const CheckIcon: React.FC<{ color?: string }> = ({ color = 'white' }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon: React.FC<{ color?: string }> = ({ color = 'white' }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export default function AnimatedSubmitButton({
  children,
  onClick,
  variant = 'send',
  disabled = false,
  style,
  className,
}: AnimatedSubmitButtonProps) {
  const { tokens } = useTheme();
  const [state, setState] = useState<AnimationState>('idle');
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [idleDims, setIdleDims] = useState<{ width: number; height: number } | null>(null);

  const clearTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const schedule = useCallback((fn: () => void, ms: number) => {
    timerRefs.current.push(setTimeout(fn, ms));
  }, []);

  const handleClick = useCallback(async () => {
    if (state !== 'idle' || disabled) return;

    // Capture button dimensions before morphing
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setIdleDims({ width: rect.width, height: rect.height });
    }

    // Fire the async action (non-blocking for animation)
    const actionPromise = onClick();

    if (reducedMotion) {
      setState('success');
      await actionPromise;
      schedule(() => setState('idle'), 800);
      return;
    }

    // Step 1: text fades out, button morphs to circle
    setState('morphing');

    // Step 2: after morph, show icon and fly/bounce/shake
    schedule(() => setState('flying'), 700);

    // Step 3: success state
    const flyDuration = variant === 'send' ? 1400 : variant === 'approve' ? 900 : 700;
    schedule(() => setState('success'), 700 + flyDuration);

    // Step 4: done -> wait for animation to finish, THEN let the action resolve
    const totalAnimTime = 700 + flyDuration + 1200;
    schedule(async () => {
      await actionPromise;
      setState('idle');
      setIdleDims(null);
    }, totalAnimTime);
  }, [state, disabled, onClick, reducedMotion, variant, schedule]);

  const height = idleDims?.height ?? 40;
  const width = idleDims?.width ?? 120;

  const isCircle = state === 'morphing' || state === 'flying';

  const variantColors: Record<Variant, { gradient: string; successBg: string }> = {
    send: {
      gradient: tokens.logoGradient,
      successBg: '#22c55e',
    },
    approve: {
      gradient: tokens.logoGradient,
      successBg: '#22c55e',
    },
    reject: {
      gradient: tokens.logoGradient,
      successBg: tokens.colorError,
    },
  };

  const colors = variantColors[variant];

  const buttonStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: disabled ? 'not-allowed' : state === 'idle' ? 'pointer' : 'default',
    fontWeight: 600,
    fontSize: 14,
    lineHeight: '22px',
    padding: state === 'idle' ? '4px 15px' : 0,
    color: 'white',
    background: state === 'success' ? colors.successBg : colors.gradient,
    borderRadius: isCircle || state === 'success' ? '50%' : 6,
    width: isCircle || state === 'success' ? height : width,
    height: height,
    minHeight: height,
    overflow: 'hidden',
    opacity: disabled ? 0.6 : 1,
    transition: [
      `border-radius 500ms ease`,
      `width 500ms ease`,
      `background 400ms ease`,
      `padding 350ms ease`,
    ].join(', '),
    boxShadow: '0 2px 0 rgba(0, 0, 0, 0.04)',
    ...style,
  };

  const particles =
    variant === 'send' && state === 'flying'
      ? [0, 1, 2, 3].map((i) => {
          const delay = i * 180;
          const offsetX = 30 + i * 30;
          const offsetY = -(50 + i * 50);
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                width: 6 - i,
                height: 6 - i,
                borderRadius: '50%',
                background: 'white',
                left: '50%',
                top: '50%',
                marginLeft: offsetX,
                marginTop: offsetY,
                animation: `asb-particle 1000ms ${delay}ms ease-out forwards`,
                opacity: 0,
                pointerEvents: 'none',
              }}
            />
          );
        })
      : null;

  const renderContent = () => {
    switch (state) {
      case 'idle':
        return <span style={{ whiteSpace: 'nowrap' }}>{children}</span>;

      case 'morphing':
        return <span style={{ animation: 'asb-fade-out 150ms ease forwards' }}>{children}</span>;

      case 'flying':
        if (variant === 'send') {
          return (
            <span
              style={{
                animation: 'asb-fly-away 1400ms cubic-bezier(0.25, 0, 0.15, 1) forwards',
                display: 'flex',
              }}
            >
              <span style={{ animation: 'asb-fade-in 300ms ease forwards', display: 'flex' }}>
                <PaperPlaneIcon />
              </span>
            </span>
          );
        }
        if (variant === 'approve') {
          return (
            <span style={{ animation: 'asb-check-bounce 900ms ease forwards', display: 'flex' }}>
              <CheckIcon color="white" />
            </span>
          );
        }
        // reject
        return (
          <span style={{ animation: 'asb-shake 700ms ease forwards', display: 'flex' }}>
            <XIcon color="white" />
          </span>
        );

      case 'success':
        return (
          <span style={{ animation: 'asb-check-bounce 500ms ease forwards', display: 'flex' }}>
            <CheckIcon color="white" />
          </span>
        );

      case 'done':
        return <span>{children}</span>;
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <button
        ref={buttonRef}
        type="button"
        className={`asb-root${className ? ` ${className}` : ''}`}
        style={buttonStyle}
        disabled={disabled || state !== 'idle'}
        onClick={handleClick}
        aria-busy={state !== 'idle' && state !== 'done'}
      >
        {renderContent()}
        {particles}
      </button>
    </>
  );
}
