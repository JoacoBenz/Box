import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND, FONT, Problema, FormScene, Detalle, Dash, Cierre } from './BoxDemo';

// Same scene timings as the landscape cut (30fps)
const S1 = 0;
const S2 = 150;
const S3 = 330;
const S4 = 750;
const S5 = 1080;
const S6 = 1410;
const S7 = 1590;
export const DURATION_IG = 1740;

const STEPS = 4;

/**
 * Wraps a 1280x720 landscape scene into the 1080x1920 vertical canvas:
 * big headline on top, scaled app screen in the middle, step dots below.
 */
const Framed: React.FC<{
  headline: string;
  step: number;
  children: React.ReactNode;
}> = ({ headline, step, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 13 } });
  return (
    <AbsoluteFill style={{ background: BRAND.bg, fontFamily: FONT }}>
      {/* Headline */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          width: '100%',
          textAlign: 'center',
          padding: '0 70px',
          opacity: sp,
          transform: `translateY(${(1 - sp) * 30}px)`,
        }}
      >
        <div
          style={{
            display: 'inline-block',
            padding: '10px 26px',
            borderRadius: 999,
            background: BRAND.grad,
            color: '#fff',
            fontSize: 30,
            fontWeight: 800,
            marginBottom: 26,
          }}
        >
          Paso {step} de {STEPS}
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, color: BRAND.text, lineHeight: 1.15 }}>
          {headline}
        </div>
      </div>

      {/* Scaled landscape scene */}
      <div
        style={{
          position: 'absolute',
          top: 640,
          left: (1080 - 1280 * 0.84) / 2,
          width: 1280,
          height: 720,
          transform: 'scale(0.84)',
          transformOrigin: 'top left',
        }}
      >
        <div style={{ position: 'relative', width: 1280, height: 720 }}>{children}</div>
      </div>

      {/* Step dots */}
      <div
        style={{
          position: 'absolute',
          bottom: 200,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        {Array.from({ length: STEPS }).map((_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 === step ? 40 : 14,
              height: 14,
              borderRadius: 999,
              background: i + 1 === step ? BRAND.primary : '#cbd5e1',
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** Vertical-native intro: wrapped tagline sized for the 9:16 canvas. */
const IntroIG: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, mass: 0.7 } });
  const tagOp = interpolate(frame, [45, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tagY = interpolate(frame, [45, 75], [22, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        background: BRAND.bg,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
      }}
    >
      <div style={{ transform: `scale(${1.7 * s})`, transformOrigin: 'center' }}>
        <div style={{ width: 280, height: 136, display: 'flex', justifyContent: 'center' }}>
          <svg width={280} height={136} viewBox="9.5 6 68 33" fill="none">
            <g>
              <circle cx="48" cy="28.5" r="8.5" stroke="#0f172a" strokeWidth="3.2" fill="none" />
              <path d="M59.5 20.5 L74 37" stroke="#0f172a" strokeWidth="3.2" />
              <path d="M74 20.5 L59.5 37" stroke="#0f172a" strokeWidth="3.2" />
              <rect x="13" y="11" width="3" height="26" fill="#0f172a" />
              <path
                d="M16 11 L27 11 L33 17.5 L27 24 L16 24"
                stroke={BRAND.primary}
                strokeWidth="3"
                fill="none"
              />
              <path
                d="M16 24 L28 24 L34 30.5 L28 37 L16 37"
                stroke={BRAND.primary}
                strokeWidth="3"
                fill="none"
              />
              <circle cx="14.5" cy="11" r="2.8" fill="#0f172a" />
            </g>
          </svg>
        </div>
      </div>
      <div
        style={{
          marginTop: 90,
          maxWidth: 860,
          textAlign: 'center',
          fontSize: 56,
          fontWeight: 600,
          color: BRAND.text,
          lineHeight: 1.25,
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
        }}
      >
        Las compras de tu empresa,{' '}
        <span
          style={{
            background: BRAND.grad,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 800,
          }}
        >
          ordenadas y bajo control
        </span>
      </div>
    </AbsoluteFill>
  );
};

const ProblemaIG: React.FC = () => (
  <AbsoluteFill>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: 'scale(1.45)',
        transformOrigin: 'center',
      }}
    >
      <Problema />
    </div>
  </AbsoluteFill>
);

const CierreIG: React.FC = () => (
  <AbsoluteFill>
    <div
      style={{ position: 'absolute', inset: 0, transform: 'scale(1.5)', transformOrigin: 'center' }}
    >
      <Cierre />
    </div>
  </AbsoluteFill>
);

export const BoxDemoIG: React.FC = () => (
  <AbsoluteFill style={{ background: BRAND.bg }}>
    <Sequence from={S1} durationInFrames={S2 - S1}>
      <IntroIG />
    </Sequence>
    <Sequence from={S2} durationInFrames={S3 - S2}>
      <ProblemaIG />
    </Sequence>
    <Sequence from={S3} durationInFrames={S4 - S3}>
      <Framed headline="El equipo pide lo que necesita" step={1}>
        <FormScene />
      </Framed>
    </Sequence>
    <Sequence from={S4} durationInFrames={S5 - S4}>
      <Framed headline="El responsable del área valida" step={2}>
        <Detalle
          user="Martín Acosta"
          role="Responsable de Área"
          sidebarActive="Validaciones"
          sidebarItems={['Dashboard', 'Nueva Solicitud', 'Solicitudes', 'Validaciones', 'Reportes']}
          notif={1}
          fromTag={{ label: 'Enviada', color: '#1d4ed8', bg: '#dbeafe' }}
          toTag={{ label: 'Validada', color: '#0e7490', bg: '#cffafe' }}
          button="Validar"
          caption="El responsable del área revisa y valida la necesidad"
          clickAt={140}
        />
      </Framed>
    </Sequence>
    <Sequence from={S5} durationInFrames={S6 - S5}>
      <Framed headline="Dirección aprueba con un click" step={3}>
        <Detalle
          user="Carlos Pereyra"
          role="Director"
          sidebarActive="Aprobaciones"
          sidebarItems={['Dashboard', 'Solicitudes', 'Aprobaciones', 'Reportes']}
          fromTag={{ label: 'Validada', color: '#0e7490', bg: '#cffafe' }}
          toTag={{ label: 'Aprobada', color: '#15803d', bg: '#dcfce7' }}
          button="Aprobar"
          caption="✓ Quien solicita no valida; quien valida no aprueba"
          clickAt={130}
          heroGreen
          confetti
        />
      </Framed>
    </Sequence>
    <Sequence from={S6} durationInFrames={S7 - S6}>
      <Framed headline="Métricas y presupuesto en vivo" step={4}>
        <Dash />
      </Framed>
    </Sequence>
    <Sequence from={S7} durationInFrames={DURATION_IG - S7}>
      <CierreIG />
    </Sequence>
  </AbsoluteFill>
);
