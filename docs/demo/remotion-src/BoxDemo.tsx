import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Easing,
} from 'remotion';
import { loadFont } from '@remotion/fonts';
import { JAKARTA_B64 } from './font';

loadFont({ family: 'Jakarta', url: `data:font/woff2;base64,${JAKARTA_B64}`, format: 'woff2' });

// ── Brand ──
const BRAND = {
  primary: '#0891b2',
  accent: '#00C2CB',
  grad: 'linear-gradient(135deg, #00C2CB, #0891b2)',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  text2: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
};
const FONT = 'Jakarta, sans-serif';

// Scene boundaries (frames @30fps)
const S1 = 0; // intro            5s
const S2 = 150; // problema         6s
const S3 = 330; // form            14s
const S4 = 750; // validar         11s
const S5 = 1080; // aprobar        11s
const S6 = 1410; // dashboard       6s
const S7 = 1590; // cierre          5s
export const DURATION = 1740;

// ── Box wordmark (from the app's BoxLogo) ──
const BoxLogo: React.FC<{ height?: number; oxShift?: number }> = ({ height = 60, oxShift = 0 }) => {
  const w = (height * 68) / 33;
  return (
    <svg width={w} height={height} viewBox="9.5 6 68 33" fill="none">
      <defs>
        <clipPath id="oxclip">
          <rect x={36} y={0} width={60} height={48} />
        </clipPath>
      </defs>
      <g clipPath="url(#oxclip)">
        <g style={{ transform: `translateX(${oxShift}px)` }}>
          <circle cx="48" cy="28.5" r="8.5" stroke="#0f172a" strokeWidth="3.2" fill="none" />
          <path d="M59.5 20.5 L74 37" stroke="#0f172a" strokeWidth="3.2" />
          <path d="M74 20.5 L59.5 37" stroke="#0f172a" strokeWidth="3.2" />
        </g>
      </g>
      <g>
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
  );
};

const Tag: React.FC<{ label: string; color: string; bg: string; flip?: number }> = ({
  label,
  color,
  bg,
  flip = 1,
}) => (
  <span
    style={{
      display: 'inline-block',
      padding: '4px 14px',
      borderRadius: 8,
      fontSize: 16,
      fontWeight: 700,
      color,
      background: bg,
      transform: `scaleY(${flip})`,
    }}
  >
    {label}
  </span>
);

const typed = (text: string, frame: number, from: number, cps = 1.2) => {
  const chars = Math.max(0, Math.floor((frame - from) * cps));
  return text.slice(0, chars);
};

const fmtMoney = (n: number) =>
  '$ ' + Math.round(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

// ── Shared chrome (sidebar + topbar) ──
const AppShell: React.FC<{
  active: string;
  user: string;
  role: string;
  notif?: number;
  notifShake?: number;
  children: React.ReactNode;
}> = ({ active, user, role, notif = 0, notifShake = 0, children }) => {
  const items = ['Dashboard', 'Nueva Solicitud', 'Solicitudes', 'Aprobaciones', 'Reportes'];
  return (
    <div
      style={{
        width: 1120,
        height: 600,
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: '0 30px 80px rgba(13,27,42,0.18)',
        display: 'flex',
        background: BRAND.bg,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 210,
          background: 'linear-gradient(180deg, #fafeff 0%, #ecfbfc 100%)',
          borderRight: `1px solid ${BRAND.border}`,
          padding: '22px 14px',
        }}
      >
        <div style={{ marginLeft: 8, marginBottom: 26 }}>
          <BoxLogo height={30} />
        </div>
        {items.map((it) => (
          <div
            key={it}
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              marginBottom: 4,
              fontSize: 14,
              fontWeight: it === active ? 700 : 500,
              color: it === active ? BRAND.primary : BRAND.text2,
              background: it === active ? 'rgba(0,194,203,0.13)' : 'transparent',
            }}
          >
            {it}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            height: 54,
            background: BRAND.card,
            borderBottom: `1px solid ${BRAND.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: BRAND.text }}>BEXOVAR</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ position: 'relative', transform: `rotate(${notifShake}deg)` }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3a6 6 0 0 0-6 6v3.5l-1.6 3a1 1 0 0 0 .9 1.5h13.4a1 1 0 0 0 .9-1.5l-1.6-3V9a6 6 0 0 0-6-6Z"
                  stroke="#64748b"
                  strokeWidth="1.8"
                  fill="none"
                />
                <path d="M9.8 19a2.3 2.3 0 0 0 4.4 0" stroke="#64748b" strokeWidth="1.8" />
              </svg>
              {notif > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    background: BRAND.red,
                    color: '#fff',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 6px',
                  }}
                >
                  {notif}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: BRAND.grad,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {user[0]}
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.text }}>{user}</div>
                <div style={{ fontSize: 11, color: BRAND.muted }}>{role}</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 24, overflow: 'hidden' }}>{children}</div>
      </div>
    </div>
  );
};

const ClickPulse: React.FC<{ frame: number; start: number; x: number; y: number }> = ({
  frame,
  start,
  x,
  y,
}) => {
  if (frame < start || frame > start + 25) return null;
  const t = (frame - start) / 25;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 60,
        height: 60,
        marginLeft: -30,
        marginTop: -30,
        borderRadius: 999,
        border: `3px solid ${BRAND.accent}`,
        opacity: 1 - t,
        transform: `scale(${0.4 + t * 1.3})`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ════════ Scene 1: Intro ════════
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, mass: 0.7 } });
  const oxShift = interpolate(
    spring({ frame: frame - 12, fps, config: { damping: 14 } }),
    [0, 1],
    [-40, 0],
  );
  const tagOp = interpolate(frame, [45, 75], [0, 1], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
  });
  const tagY = interpolate(frame, [45, 75], [16, 0], {
    extrapolateRight: 'clamp',
    extrapolateLeft: 'clamp',
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
      <div style={{ transform: `scale(${s})` }}>
        <BoxLogo height={130} oxShift={oxShift} />
      </div>
      <div
        style={{
          marginTop: 36,
          fontSize: 34,
          fontWeight: 600,
          color: BRAND.text,
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
          textAlign: 'center',
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

// ════════ Scene 2: Problema ════════
const Problema: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = ['¿Compras por WhatsApp?', '¿Aprobaciones por mail?', '¿Excel desactualizado?'];
  return (
    <AbsoluteFill
      style={{
        background: BRAND.bg,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        gap: 26,
      }}
    >
      {lines.map((l, i) => {
        const start = i * 14;
        const sp = spring({ frame: frame - start, fps, config: { damping: 12 } });
        const strike = interpolate(frame, [80 + i * 10, 105 + i * 10], [0, 100], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={l}
            style={{
              position: 'relative',
              background: BRAND.card,
              border: `1px solid ${BRAND.border}`,
              borderRadius: 14,
              padding: '22px 46px',
              fontSize: 34,
              fontWeight: 700,
              color: BRAND.text2,
              opacity: sp,
              transform: `translateY(${(1 - sp) * 40}px)`,
              boxShadow: '0 8px 24px rgba(13,27,42,0.06)',
            }}
          >
            {l}
            <div
              style={{
                position: 'absolute',
                left: '5%',
                top: '50%',
                height: 4,
                borderRadius: 2,
                background: BRAND.red,
                width: `${strike * 0.9}%`,
              }}
            />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ════════ Scene 3: Form ════════
const FormScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13 } });
  const titulo = typed('Notebooks para el equipo de ventas', frame, 25, 1.4);
  const item = typed('Notebook Lenovo ThinkPad E14 16GB RAM', frame, 90, 1.4);
  const qty = frame > 150 ? '3' : '';
  const price = frame > 170 ? '$ 950.000,00' : '';
  const total = interpolate(frame, [185, 245], [0, 2850000], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const toastSp = spring({ frame: frame - 330, fps, config: { damping: 13 } });
  const field = (v: string, ph: string, w: string | number = '100%') => (
    <div
      style={{
        border: `1.5px solid ${v ? BRAND.accent : BRAND.border}`,
        borderRadius: 9,
        padding: '10px 14px',
        fontSize: 15,
        color: v ? BRAND.text : BRAND.muted,
        background: '#fff',
        width: w,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {v || ph}
      {v && frame % 20 < 10 && <span style={{ color: BRAND.primary }}>|</span>}
    </div>
  );
  return (
    <AbsoluteFill
      style={{
        background: '#e8eef3',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
      }}
    >
      <div
        style={{ transform: `scale(${0.92 + enter * 0.08})`, opacity: enter, position: 'relative' }}
      >
        <AppShell active="Nueva Solicitud" user="Laura Gómez" role="Solicitante">
          <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.text, marginBottom: 16 }}>
            Nueva Solicitud de Compra
          </div>
          <div
            style={{
              background: BRAND.card,
              borderRadius: 12,
              border: `1px solid ${BRAND.border}`,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.text2 }}>* TÍTULO</div>
            {field(titulo, 'Ej: Resmas de papel A4')}
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.text2, marginTop: 4 }}>
              ÍTEM 1
            </div>
            {field(item, 'Descripción del producto')}
            <div style={{ display: 'flex', gap: 12 }}>
              {field(qty, 'Cantidad', 110)}
              {field(qty ? 'unidades' : '', 'Unidad', 130)}
              {field(price, 'Precio est.', 170)}
            </div>
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 9,
                padding: '10px 16px',
                textAlign: 'right',
                fontSize: 17,
                fontWeight: 800,
                color: '#15803d',
              }}
            >
              Total Estimado: {total > 0 ? fmtMoney(total) : '—'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <div
                style={{
                  padding: '10px 18px',
                  borderRadius: 9,
                  border: `1px solid ${BRAND.border}`,
                  fontSize: 14,
                  fontWeight: 600,
                  color: BRAND.text2,
                }}
              >
                Guardar Borrador
              </div>
              <div
                style={{
                  padding: '10px 22px',
                  borderRadius: 9,
                  background: BRAND.grad,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  transform: frame > 300 && frame < 315 ? 'scale(0.94)' : 'scale(1)',
                  boxShadow: '0 4px 15px rgba(0,194,203,0.35)',
                }}
              >
                Enviar Solicitud
              </div>
            </div>
          </div>
        </AppShell>
        <ClickPulse frame={frame} start={300} x={1010} y={520} />
        {frame > 330 && (
          <div
            style={{
              position: 'absolute',
              top: 18,
              right: 24,
              background: '#fff',
              borderLeft: `4px solid ${BRAND.green}`,
              borderRadius: 10,
              padding: '12px 18px',
              fontSize: 14,
              fontWeight: 600,
              color: BRAND.text,
              boxShadow: '0 10px 30px rgba(13,27,42,0.15)',
              opacity: toastSp,
              transform: `translateY(${(1 - toastSp) * -16}px)`,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                width: 20,
                height: 20,
                borderRadius: 999,
                background: '#22c55e',
                color: '#fff',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 800,
                marginRight: 8,
              }}
            >
              ✓
            </span>
            Solicitud SC-2026-0001 enviada
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ════════ Scenes 4 & 5: Detalle (validar / aprobar) ════════
const Detalle: React.FC<{
  user: string;
  role: string;
  fromTag: { label: string; color: string; bg: string };
  toTag: { label: string; color: string; bg: string };
  button: string;
  caption: string;
  clickAt: number;
  heroGreen?: boolean;
  confetti?: boolean;
  notif?: number;
}> = ({ user, role, fromTag, toTag, button, caption, clickAt, heroGreen, confetti, notif = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13 } });
  const flip = interpolate(frame, [clickAt + 18, clickAt + 30], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flip2 = interpolate(frame, [clickAt + 30, clickAt + 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const done = frame > clickAt + 30;
  const shake = notif > 0 && frame > 14 && frame < 38 ? Math.sin(frame * 1.6) * 9 : 0;
  const heroBg = done && heroGreen ? '#f0fdf4' : '#f0fdff';
  const capSp = spring({ frame: frame - clickAt - 45, fps, config: { damping: 13 } });
  return (
    <AbsoluteFill
      style={{
        background: '#e8eef3',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
      }}
    >
      <div
        style={{ transform: `scale(${0.92 + enter * 0.08})`, opacity: enter, position: 'relative' }}
      >
        <AppShell active="Solicitudes" user={user} role={role} notif={notif} notifShake={shake}>
          <div
            style={{
              background: heroBg,
              border: `1px solid ${BRAND.border}`,
              borderRadius: 12,
              padding: '18px 22px',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 21, fontWeight: 800, color: BRAND.text, marginBottom: 8 }}>
              Notebooks para el equipo de ventas
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: BRAND.muted, letterSpacing: 1 }}>
                SC-2026-0001
              </span>
              {!done ? <Tag {...fromTag} flip={flip} /> : <Tag {...toTag} flip={flip2} />}
              <span style={{ fontSize: 13, color: BRAND.text2 }}>Normal</span>
              <div style={{ flex: 1 }} />
              <div
                style={{
                  padding: '9px 22px',
                  borderRadius: 9,
                  background: BRAND.grad,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  transform: frame > clickAt && frame < clickAt + 14 ? 'scale(0.94)' : 'scale(1)',
                  boxShadow: '0 4px 15px rgba(0,194,203,0.35)',
                  opacity: done ? 0.35 : 1,
                }}
              >
                {button}
              </div>
            </div>
          </div>
          <div
            style={{
              background: BRAND.card,
              border: `1px solid ${BRAND.border}`,
              borderRadius: 12,
              padding: 18,
            }}
          >
            {[
              ['Solicitante', 'Laura Gómez'],
              ['Área', 'Administración'],
              ['Ítems', 'Notebook Lenovo ThinkPad E14 16GB RAM × 3'],
              ['Total estimado', '$ 2.850.000,00'],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  padding: '9px 0',
                  borderBottom: `1px solid #f1f5f9`,
                  fontSize: 14.5,
                }}
              >
                <span style={{ width: 150, color: BRAND.text2, fontWeight: 600 }}>{k}</span>
                <span style={{ color: BRAND.text, fontWeight: k === 'Total estimado' ? 800 : 500 }}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </AppShell>
        <ClickPulse frame={frame} start={clickAt} x={1010} y={175} />
        {confetti &&
          done &&
          Array.from({ length: 26 }).map((_, i) => {
            const t = (frame - clickAt - 30) / 50;
            if (t < 0 || t > 1) return null;
            const ang = (i / 26) * Math.PI * 2;
            const dist = t * (130 + (i % 5) * 40);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 560 + Math.cos(ang) * dist * 1.6,
                  top: 160 + Math.sin(ang) * dist - t * t * 60,
                  width: 9,
                  height: 9,
                  borderRadius: i % 2 ? 999 : 2,
                  background: [BRAND.accent, BRAND.green, BRAND.primary, '#a7f3d0'][i % 4],
                  opacity: 1 - t,
                  transform: `rotate(${t * 240 + i * 30}deg)`,
                }}
              />
            );
          })}
        <div
          style={{
            position: 'absolute',
            bottom: -24,
            left: '50%',
            transform: `translateX(-50%) translateY(${(1 - capSp) * 26}px)`,
            opacity: capSp,
            background: '#0f172a',
            color: '#fff',
            borderRadius: 12,
            padding: '13px 26px',
            fontSize: 16,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 14px 40px rgba(13,27,42,0.35)',
          }}
        >
          {caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ════════ Scene 6: Dashboard ════════
const Dash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 13 } });
  const v = (to: number) =>
    interpolate(frame, [10, 70], [0, to], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });
  const cards: [string, string, string][] = [
    ['GASTO DEL AÑO', fmtMoney(v(2850000)), BRAND.primary],
    ['GASTO DEL MES', fmtMoney(v(2850000)), BRAND.green],
    ['TIEMPO PROMEDIO', `${Math.round(v(2))} días`, BRAND.primary],
    ['PENDIENTES', `${Math.round(v(0))}`, '#f59e0b'],
  ];
  const bar = interpolate(frame, [25, 95], [0, 72], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill
      style={{
        background: '#e8eef3',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
      }}
    >
      <div style={{ transform: `scale(${0.92 + enter * 0.08})`, opacity: enter }}>
        <AppShell active="Dashboard" user="Carlos Pereyra" role="Director">
          <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.text, marginBottom: 18 }}>
            Todo el ciclo, trazable y auditado
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
            {cards.map(([t, val, c]) => (
              <div
                key={t}
                style={{
                  flex: 1,
                  background: BRAND.card,
                  border: `1px solid ${BRAND.border}`,
                  borderRadius: 14,
                  padding: '16px 18px',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: BRAND.muted,
                    letterSpacing: 0.8,
                    marginBottom: 8,
                  }}
                >
                  {t}
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: c, whiteSpace: 'nowrap' }}>
                  {val}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: BRAND.card,
              border: `1px solid ${BRAND.border}`,
              borderRadius: 14,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.text2, marginBottom: 10 }}>
              Presupuesto del área · Administración
            </div>
            <div
              style={{ height: 16, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${bar}%`,
                  background: BRAND.grad,
                  borderRadius: 999,
                }}
              />
            </div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 8 }}>
              {Math.round(bar)}% utilizado
            </div>
          </div>
        </AppShell>
      </div>
    </AbsoluteFill>
  );
};

// ════════ Scene 7: Cierre ════════
const Cierre: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  const fade = interpolate(frame, [115, 150], [1, 0], {
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
        opacity: fade,
      }}
    >
      <div style={{ transform: `scale(${s})` }}>
        <BoxLogo height={110} />
      </div>
      <div
        style={{
          marginTop: 34,
          padding: '16px 40px',
          borderRadius: 12,
          background: BRAND.grad,
          color: '#fff',
          fontSize: 24,
          fontWeight: 800,
          boxShadow: '0 10px 35px rgba(0,194,203,0.4)',
          opacity: interpolate(frame, [20, 45], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        Probalo gratis 14 días
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 19,
          fontWeight: 600,
          color: BRAND.text2,
          opacity: interpolate(frame, [35, 60], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        bexovar.com
      </div>
    </AbsoluteFill>
  );
};

// ════════ Master ════════
export const BoxDemo: React.FC = () => (
  <AbsoluteFill style={{ background: BRAND.bg }}>
    <Sequence from={S1} durationInFrames={S2 - S1}>
      <Intro />
    </Sequence>
    <Sequence from={S2} durationInFrames={S3 - S2}>
      <Problema />
    </Sequence>
    <Sequence from={S3} durationInFrames={S4 - S3}>
      <FormScene />
    </Sequence>
    <Sequence from={S4} durationInFrames={S5 - S4}>
      <Detalle
        user="Martín Acosta"
        role="Responsable de Área"
        notif={1}
        fromTag={{ label: 'Enviada', color: '#1d4ed8', bg: '#dbeafe' }}
        toTag={{ label: 'Validada', color: '#0e7490', bg: '#cffafe' }}
        button="Validar"
        caption="El responsable del área revisa y valida la necesidad"
        clickAt={140}
      />
    </Sequence>
    <Sequence from={S5} durationInFrames={S6 - S5}>
      <Detalle
        user="Carlos Pereyra"
        role="Director"
        fromTag={{ label: 'Validada', color: '#0e7490', bg: '#cffafe' }}
        toTag={{ label: 'Aprobada', color: '#15803d', bg: '#dcfce7' }}
        button="Aprobar"
        caption="✓ Quien solicita no valida; quien valida no aprueba"
        clickAt={130}
        heroGreen
        confetti
      />
    </Sequence>
    <Sequence from={S6} durationInFrames={S7 - S6}>
      <Dash />
    </Sequence>
    <Sequence from={S7} durationInFrames={DURATION - S7}>
      <Cierre />
    </Sequence>
  </AbsoluteFill>
);
