'use client';

import Link from 'next/link';
import { useEffect, useState, useRef, useCallback } from 'react';

const FEATURES = [
  {
    icon: '📋',
    title: 'Solicitudes digitales',
    desc: 'Creá y gestioná pedidos de compra desde cualquier dispositivo. Sin papeles, sin demoras.',
  },
  {
    icon: '✅',
    title: 'Aprobaciones en cadena',
    desc: 'Responsables, directores y compras validan en orden. Cada paso queda registrado.',
  },
  {
    icon: '📊',
    title: 'Reportes en tiempo real',
    desc: 'Visualizá gastos por área, proveedor y período. Exportá a Excel en un click.',
  },
  {
    icon: '🔔',
    title: 'Notificaciones al instante',
    desc: 'Cada cambio de estado genera alertas. Nadie se pierde una solicitud pendiente.',
  },
  {
    icon: '🔒',
    title: 'Seguridad multi-tenant',
    desc: 'Cada organización tiene sus datos aislados. Roles, permisos y auditoría completa.',
  },
  {
    icon: '🚀',
    title: 'Sin instalación',
    desc: 'Funciona desde el navegador. Registrate y empezá a usar en minutos.',
  },
];

const SCREENS = [
  {
    title: 'Dashboard',
    caption: 'Métricas en tiempo real de tu organización',
    content: (
      <div style={{ padding: '20px 24px' }}>
        {/* Top stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Solicitudes', value: '24', color: '#4f46e5', icon: '📋' },
            { label: 'Aprobadas', value: '18', color: '#16a34a', icon: '✅' },
            { label: 'En proceso', value: '4', color: '#f59e0b', icon: '⏳' },
            { label: 'Gasto mensual', value: '$1.2M', color: '#0891b2', icon: '💰' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#333' }}>Gastos por mes</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
              {[40, 65, 50, 80, 70, 95, 60].map((h, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', height: h, borderRadius: 6, background: `linear-gradient(180deg, #00C2CB, #0891b2)`, opacity: 0.7 + i * 0.04 }} />
                  <span style={{ fontSize: 9, color: '#aaa' }}>{['E', 'F', 'M', 'A', 'M', 'J', 'J'][i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#333' }}>Por área</div>
            {[
              { name: 'Administración', pct: 35, color: '#4f46e5' },
              { name: 'Dirección', pct: 25, color: '#0891b2' },
              { name: 'Mantenimiento', pct: 22, color: '#f59e0b' },
              { name: 'Sistemas', pct: 18, color: '#16a34a' },
            ].map((a, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', marginBottom: 3 }}>
                  <span>{a.name}</span><span>{a.pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#f0f0f0' }}>
                  <div style={{ height: 6, borderRadius: 3, background: a.color, width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    title: 'Solicitudes',
    caption: 'Seguí el estado de cada pedido en tiempo real',
    content: (
      <div style={{ padding: '16px 24px' }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#aaa', border: '1px solid #e5e7eb' }}>🔍 Buscar solicitudes...</div>
          <div style={{ background: 'linear-gradient(135deg, #00C2CB, #0891b2)', color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600 }}>+ Nueva</div>
        </div>
        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 80px', padding: '10px 14px', background: '#f9fafb', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
            <span>#</span><span>Solicitud</span><span>Área</span><span>Monto</span><span>Estado</span>
          </div>
          {[
            { n: 'SC-0024', t: 'Resmas A4 x 500', area: 'Admin', monto: '$15.000', estado: 'Aprobada', color: '#16a34a', bg: '#f0fdf4' },
            { n: 'SC-0023', t: 'Toner HP LaserJet', area: 'Dirección', monto: '$45.000', estado: 'Validada', color: '#2563eb', bg: '#eff6ff' },
            { n: 'SC-0022', t: 'Sillas ergonómicas x5', area: 'Contaduría', monto: '$120.000', estado: 'En compras', color: '#f59e0b', bg: '#fefce8' },
            { n: 'SC-0021', t: 'Proyector Epson', area: 'Reuniones', monto: '$350.000', estado: 'Pendiente', color: '#888', bg: '#f5f5f5' },
            { n: 'SC-0020', t: 'Notebooks x3', area: 'Sistemas', monto: '$1.200.000', estado: 'Cerrada', color: '#059669', bg: '#ecfdf5' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 80px', padding: '12px 14px', borderTop: '1px solid #f0f0f0', fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: '#4f46e5', fontWeight: 600 }}>{r.n}</span>
              <span style={{ fontWeight: 600, color: '#333' }}>{r.t}</span>
              <span style={{ color: '#777' }}>{r.area}</span>
              <span style={{ fontWeight: 700, color: '#333' }}>{r.monto}</span>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: r.bg, color: r.color }}>{r.estado}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    title: 'Aprobaciones',
    caption: 'Aprobá o rechazá solicitudes con un click',
    content: (
      <div style={{ padding: '16px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#333', marginBottom: 14 }}>3 solicitudes pendientes de aprobación</div>
        {[
          { n: 'SC-0024', t: 'Resmas A4 x 500 hojas', area: 'Administración', solicitante: 'María López', monto: '$15.000', urgencia: 'Media', urgColor: '#ca8a04', urgBg: '#fefce8' },
          { n: 'SC-0023', t: 'Toner HP LaserJet Pro', area: 'Dirección', solicitante: 'Carlos García', monto: '$45.000', urgencia: 'Alta', urgColor: '#dc2626', urgBg: '#fef2f2' },
          { n: 'SC-0022', t: 'Sillas ergonómicas x5', area: 'Contaduría', solicitante: 'Ana Pérez', monto: '$120.000', urgencia: 'Baja', urgColor: '#16a34a', urgBg: '#f0fdf4' },
        ].map((r, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#4f46e5', fontWeight: 700, fontSize: 13 }}>{r.n}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: r.urgBg, color: r.urgColor }}>{r.urgencia}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#333', marginTop: 4 }}>{r.t}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{r.area} · {r.solicitante}</div>
              </div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1f2937' }}>{r.monto}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <div style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fca5a5', color: '#dc2626', cursor: 'pointer' }}>Rechazar</div>
              <div style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#16a34a', color: '#fff', cursor: 'pointer' }}>Aprobar ✓</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Reportes',
    caption: 'Exportá reportes detallados a Excel en un click',
    content: (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Reporte de gastos — Julio 2026</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: '1px solid #e5e7eb', color: '#555' }}>📅 Este mes</div>
            <div style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: '#16a34a', color: '#fff' }}>📥 Excel</div>
          </div>
        </div>
        {/* Big numbers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
          {[
            { label: 'Total gastado', value: '$2.450.000', color: '#4f46e5' },
            { label: 'Presupuesto', value: '$3.000.000', color: '#16a34a' },
            { label: 'Disponible', value: '$550.000', color: '#f59e0b' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 14, textAlign: 'center' as const, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 10, color: '#888', fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 60px', padding: '10px 14px', background: '#f9fafb', fontSize: 10, fontWeight: 600, color: '#888', textTransform: 'uppercase' as const }}>
            <span>Área</span><span>Gastado</span><span>Presupuesto</span><span>%</span>
          </div>
          {[
            { area: 'Administración', gastado: '$820.000', presupuesto: '$1.000.000', pct: 82 },
            { area: 'Dirección', gastado: '$650.000', presupuesto: '$800.000', pct: 81 },
            { area: 'Sistemas', gastado: '$530.000', presupuesto: '$600.000', pct: 88 },
            { area: 'Mantenimiento', gastado: '$450.000', presupuesto: '$600.000', pct: 75 },
          ].map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 60px', padding: '11px 14px', borderTop: '1px solid #f0f0f0', fontSize: 12, alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#333' }}>{r.area}</span>
              <span style={{ fontWeight: 700, color: '#1f2937' }}>{r.gastado}</span>
              <span style={{ color: '#888' }}>{r.presupuesto}</span>
              <span style={{ fontWeight: 700, color: r.pct > 85 ? '#dc2626' : r.pct > 75 ? '#f59e0b' : '#16a34a' }}>{r.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const STEPS = [
  { num: '1', title: 'Registrá tu organización', desc: 'Creá tu cuenta y configurá áreas, roles y centros de costo.' },
  { num: '2', title: 'Invitá a tu equipo', desc: 'Compartí un código o habilitá el ingreso por dominio institucional.' },
  { num: '3', title: 'Gestioná las compras', desc: 'Solicitudes, aprobaciones, compras y recepciones. Todo en un solo lugar.' },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function AppShowcase() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setActive(p => (p + 1) % SCREENS.length), 5000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (i: number) => { setActive(i); startTimer(); };

  return (
    <div className="lp-showcase">
      {/* Browser frame */}
      <div className="lp-browser-frame">
        {/* Title bar */}
        <div className="lp-browser-bar">
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div className="lp-browser-url">
            <span style={{ color: '#16a34a', marginRight: 4 }}>🔒</span>
            box.app/{SCREENS[active].title.toLowerCase()}
          </div>
          <div style={{ width: 50 }} />
        </div>
        {/* App header inside frame */}
        <div className="lp-app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#00C2CB' }}>Box</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {SCREENS.map((s, i) => (
              <button key={i} onClick={() => goTo(i)} className={`lp-app-tab ${active === i ? 'active' : ''}`}>
                {s.title}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🔔</span>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11 }}>JB</div>
          </div>
        </div>
        {/* Screen content */}
        <div className="lp-screen-content">
          {SCREENS.map((s, i) => (
            <div key={i} className={`lp-screen ${active === i ? 'active' : ''}`}>
              {s.content}
            </div>
          ))}
        </div>
      </div>
      {/* Caption */}
      <div className="lp-showcase-caption">{SCREENS[active].caption}</div>
      {/* Dots */}
      <div className="lp-showcase-dots">
        {SCREENS.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} className={`lp-dot ${active === i ? 'active' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function AnimatedSection({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .landing-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1a1a2e;
          overflow-x: hidden;
          background: #fff;
        }

        /* ---- NAV ---- */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 48px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.3s;
        }
        .lp-nav.scrolled { box-shadow: 0 4px 30px rgba(0,0,0,0.08); }
        .lp-nav-logo { font-weight: 800; font-size: 22px; letter-spacing: -0.5px; color: #00C2CB; }
        .lp-nav-links { display: flex; gap: 8px; }
        .lp-nav-links a {
          padding: 8px 20px; border-radius: 10px; font-weight: 600; font-size: 14px;
          text-decoration: none; transition: all 0.2s;
        }
        .lp-btn-ghost { color: #555; }
        .lp-btn-ghost:hover { background: #f5f5f5; color: #1a1a2e; }
        .lp-btn-primary {
          background: linear-gradient(135deg, #00C2CB, #0891b2);
          color: #fff !important; box-shadow: 0 4px 15px rgba(0,194,203,0.3);
        }
        .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,194,203,0.4); }

        /* ---- HERO ---- */
        .lp-hero {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          position: relative; padding: 120px 48px 80px; text-align: center;
          background: linear-gradient(180deg, #f0fdff 0%, #fff 100%);
          overflow: hidden;
        }
        .lp-hero-orb {
          position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.5;
          pointer-events: none;
        }
        .lp-hero-orb-1 { width: 600px; height: 600px; background: #00C2CB; top: -20%; right: -10%; animation: orbFloat1 20s ease-in-out infinite; }
        .lp-hero-orb-2 { width: 500px; height: 500px; background: #a78bfa; bottom: -15%; left: -8%; animation: orbFloat2 25s ease-in-out infinite; }
        .lp-hero-orb-3 { width: 300px; height: 300px; background: #f472b6; top: 30%; left: 60%; animation: orbFloat3 18s ease-in-out infinite; }

        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-60px, 40px); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(50px, -50px); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-40px, -30px); } }

        .lp-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; border-radius: 100px;
          background: rgba(0,194,203,0.1); color: #0891b2;
          font-weight: 600; font-size: 14px; margin-bottom: 24px;
          animation: fadeInDown 0.8s ease both;
        }
        .lp-hero-badge-dot { width: 8px; height: 8px; border-radius: 50%; background: #00C2CB; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .lp-hero h1 {
          font-size: clamp(40px, 6vw, 72px); font-weight: 900; line-height: 1.05;
          letter-spacing: -2px; margin: 0 auto 24px; max-width: 800px;
          animation: fadeInUp 0.8s ease 0.1s both;
        }
        .lp-hero h1 span {
          background: linear-gradient(135deg, #00C2CB, #0891b2, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-hero-sub {
          font-size: clamp(17px, 2vw, 20px); color: #666; max-width: 560px;
          margin: 0 auto 40px; line-height: 1.6;
          animation: fadeInUp 0.8s ease 0.2s both;
        }
        .lp-hero-ctas {
          display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;
          animation: fadeInUp 0.8s ease 0.3s both;
        }
        .lp-hero-ctas a {
          padding: 14px 32px; border-radius: 14px; font-weight: 700;
          font-size: 16px; text-decoration: none; transition: all 0.25s;
        }
        .lp-cta-main {
          background: linear-gradient(135deg, #00C2CB, #0891b2);
          color: #fff; box-shadow: 0 8px 30px rgba(0,194,203,0.35);
        }
        .lp-cta-main:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,194,203,0.45); }
        .lp-cta-secondary {
          background: #fff; color: #1a1a2e; border: 2px solid #e5e5e5;
        }
        .lp-cta-secondary:hover { border-color: #00C2CB; color: #0891b2; }

        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }

        /* ---- FLOATING CARDS (hero decoration) ---- */
        .lp-float-cards {
          display: flex; justify-content: center; gap: 24px;
          margin-top: 60px; animation: fadeInUp 0.8s ease 0.5s both;
        }
        .lp-float-card {
          background: rgba(255,255,255,0.9); backdrop-filter: blur(10px);
          border-radius: 16px; padding: 20px 24px; min-width: 180px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.05);
          animation: floatCard 6s ease-in-out infinite;
        }
        .lp-float-card:nth-child(2) { animation-delay: -2s; }
        .lp-float-card:nth-child(3) { animation-delay: -4s; }
        @keyframes floatCard { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        .lp-float-card-num { font-size: 28px; font-weight: 800; color: #00C2CB; }
        .lp-float-card-label { font-size: 13px; color: #888; font-weight: 500; margin-top: 2px; }

        /* ---- APP SHOWCASE ---- */
        .lp-showcase {
          padding: 0 48px 40px; max-width: 1000px; margin: -40px auto 0;
          position: relative; z-index: 2;
        }
        .lp-browser-frame {
          border-radius: 16px; overflow: hidden;
          box-shadow: 0 25px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
          background: #f7f7f8;
        }
        .lp-browser-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px; background: #e8e8ec; border-bottom: 1px solid #ddd;
        }
        .lp-browser-url {
          flex: 1; max-width: 340px; margin: 0 auto;
          background: #fff; border-radius: 6px; padding: 5px 14px;
          font-size: 12px; color: #666; text-align: center;
          border: 1px solid #ddd;
        }
        .lp-app-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 24px; background: #fff; border-bottom: 1px solid #f0f0f0;
        }
        .lp-app-tab {
          background: none; border: none; cursor: pointer;
          font-size: 12px; font-weight: 600; color: #888;
          padding: 6px 12px; border-radius: 8px; transition: all 0.2s;
        }
        .lp-app-tab:hover { color: #333; background: #f5f5f5; }
        .lp-app-tab.active { color: #0891b2; background: #f0fdff; }
        .lp-screen-content {
          position: relative; min-height: 340px; background: #f7f7f8;
          overflow: hidden;
        }
        .lp-screen {
          position: absolute; inset: 0;
          opacity: 0; transform: translateX(30px);
          transition: opacity 0.5s ease, transform 0.5s ease;
          pointer-events: none;
        }
        .lp-screen.active {
          opacity: 1; transform: translateX(0);
          pointer-events: auto; position: relative;
        }
        .lp-showcase-caption {
          text-align: center; margin-top: 20px;
          font-size: 16px; color: #666; font-weight: 500;
          min-height: 24px;
          transition: opacity 0.3s;
        }
        .lp-showcase-dots {
          display: flex; justify-content: center; gap: 8px; margin-top: 16px;
        }
        .lp-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #ddd; border: none; cursor: pointer;
          transition: all 0.3s; padding: 0;
        }
        .lp-dot.active {
          background: #00C2CB; width: 28px; border-radius: 5px;
        }

        /* ---- FEATURES ---- */
        .lp-features {
          padding: 40px 48px 60px; max-width: 1200px; margin: 0 auto;
        }
        .lp-section-title {
          text-align: center; font-size: clamp(30px, 4vw, 44px); font-weight: 800;
          letter-spacing: -1px; margin-bottom: 16px;
        }
        .lp-section-sub {
          text-align: center; font-size: 18px; color: #888; margin-bottom: 40px; max-width: 500px; margin-left: auto; margin-right: auto;
        }
        .lp-features-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 24px;
        }
        .lp-feature-card {
          padding: 32px; border-radius: 20px;
          background: #fafafa; border: 1px solid #f0f0f0;
          transition: all 0.3s;
        }
        .lp-feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.06);
          border-color: rgba(0,194,203,0.3);
        }
        .lp-feature-icon { font-size: 36px; margin-bottom: 16px; }
        .lp-feature-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
        .lp-feature-desc { font-size: 15px; color: #777; line-height: 1.6; }

        /* ---- STEPS ---- */
        .lp-steps {
          padding: 60px 48px;
          background: linear-gradient(180deg, #f8fdff 0%, #f0f9ff 100%);
        }
        .lp-steps-inner { max-width: 900px; margin: 0 auto; }
        .lp-steps-list { display: flex; flex-direction: column; gap: 0; position: relative; }
        .lp-steps-list::before {
          content: ''; position: absolute; left: 32px; top: 32px; bottom: 32px;
          width: 3px; background: linear-gradient(180deg, #00C2CB, #a78bfa); border-radius: 3px;
        }
        .lp-step {
          display: flex; gap: 28px; align-items: flex-start; padding: 32px 0;
        }
        .lp-step-num {
          width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, #00C2CB, #0891b2);
          color: #fff; font-weight: 800; font-size: 24px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 25px rgba(0,194,203,0.3);
          position: relative; z-index: 1;
        }
        .lp-step-content { padding-top: 8px; }
        .lp-step-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
        .lp-step-desc { font-size: 16px; color: #777; line-height: 1.6; }

        /* ---- CTA BOTTOM ---- */
        .lp-cta-section {
          padding: 100px 48px; text-align: center; position: relative; overflow: hidden;
          background: linear-gradient(135deg, #0e1825 0%, #1a1a2e 100%);
          color: #fff;
        }
        .lp-cta-section .lp-hero-orb { opacity: 0.2; }
        .lp-cta-section h2 {
          font-size: clamp(32px, 4vw, 48px); font-weight: 800; letter-spacing: -1px;
          margin-bottom: 16px; position: relative; z-index: 1;
        }
        .lp-cta-section p {
          font-size: 18px; color: rgba(255,255,255,0.6); margin-bottom: 40px;
          position: relative; z-index: 1;
        }
        .lp-cta-section .lp-hero-ctas { position: relative; z-index: 1; }

        /* ---- FOOTER ---- */
        .lp-footer {
          padding: 32px 48px; text-align: center; font-size: 14px; color: #aaa;
          background: #111; border-top: 1px solid rgba(255,255,255,0.05);
        }

        /* ---- WHATSAPP FAB ---- */
        .lp-wpp-fab {
          position: fixed; bottom: 24px; right: 24px; z-index: 999;
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #00C2CB, #0891b2); color: #fff;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 20px rgba(0,194,203,0.4);
          transition: transform 0.25s, box-shadow 0.25s;
          text-decoration: none;
        }
        .lp-wpp-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 28px rgba(0,194,203,0.55);
        }

        /* ---- RESPONSIVE ---- */
        @media (max-width: 768px) {
          .lp-nav { padding: 12px 20px; }
          .lp-hero, .lp-features, .lp-steps, .lp-cta-section { padding-left: 20px; padding-right: 20px; }
          .lp-float-cards { flex-direction: column; align-items: center; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-steps-list::before { left: 30px; }
          .lp-showcase { padding: 0 8px 40px; margin-top: -20px; }
          .lp-browser-frame { border-radius: 12px; }
          .lp-browser-bar { padding: 8px 12px; }
          .lp-browser-url { font-size: 11px; padding: 4px 10px; }
          .lp-app-header { padding: 8px 12px; }
          .lp-app-header > div:first-child span:last-child { font-size: 13px !important; }
          .lp-app-tab { font-size: 10px; padding: 4px 6px; }
          .lp-screen-content { min-height: auto; }
          /* Mobile: simplify dashboard grid */
          .lp-screen-content [style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, 1fr) !important; }
          .lp-screen-content [style*="grid-template-columns: 1.5fr"] { grid-template-columns: 1fr !important; }
          /* Mobile: make tables scrollable */
          .lp-screen-content [style*="grid-template-columns: 80px"] { grid-template-columns: 60px 1fr 60px 70px 65px !important; font-size: 10px !important; }
          .lp-screen-content [style*="grid-template-columns: 80px"] span { font-size: 10px !important; }
          /* Mobile: approval cards */
          .lp-screen-content [style*="justify-content: space-between"] > div:last-child { font-size: 14px !important; }
          /* Mobile: reportes grid */
          .lp-screen-content [style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
          .lp-screen-content [style*="grid-template-columns: 1fr 100px 100px 60px"] { grid-template-columns: 1fr 80px 80px 45px !important; font-size: 10px !important; }
          .lp-showcase-caption { font-size: 14px; }
        }
      `}</style>

      {/* NAV */}
      <nav className={`lp-nav ${scrollY > 20 ? 'scrolled' : ''}`}>
        <div className="lp-nav-logo">📦 Box</div>
        <div className="lp-nav-links">
          <Link href="/login" className="lp-nav-links lp-btn-ghost">Ingresar</Link>
          <Link href="/registro" className="lp-nav-links lp-btn-primary">Registrarse</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-hero-orb lp-hero-orb-1" style={{ transform: `translate(0, ${scrollY * 0.15}px)` }} />
        <div className="lp-hero-orb lp-hero-orb-2" style={{ transform: `translate(0, ${scrollY * -0.1}px)` }} />
        <div className="lp-hero-orb lp-hero-orb-3" style={{ transform: `translate(0, ${scrollY * 0.08}px)` }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="lp-hero-badge">
            <div className="lp-hero-badge-dot" />
            Plataforma de gestión de compras
          </div>
          <h1>
            Las compras de tu empresa,<br />
            <span>ordenadas y bajo control</span>
          </h1>
          <p className="lp-hero-sub">
            Digitalizá el proceso completo de compras: desde la solicitud hasta la recepción.
            Sin papeles, con aprobaciones automáticas y reportes al instante.
          </p>
          <div className="lp-hero-ctas">
            <Link href="/registro" className="lp-cta-main">Empezar ahora</Link>
            <Link href="/login" className="lp-cta-secondary">Ya tengo cuenta</Link>
          </div>

          <div className="lp-float-cards">
            <div className="lp-float-card">
              <div className="lp-float-card-num">100%</div>
              <div className="lp-float-card-label">Digital y sin papeles</div>
            </div>
            <div className="lp-float-card">
              <div className="lp-float-card-num">5 min</div>
              <div className="lp-float-card-label">Para empezar a usar</div>
            </div>
            <div className="lp-float-card">
              <div className="lp-float-card-num">24/7</div>
              <div className="lp-float-card-label">Disponible siempre</div>
            </div>
          </div>
        </div>
      </section>

      {/* APP SHOWCASE */}
      <AnimatedSection>
        <AppShowcase />
      </AnimatedSection>

      {/* FEATURES */}
      <section className="lp-features">
        <AnimatedSection>
          <h2 className="lp-section-title">Todo lo que necesitás</h2>
          <p className="lp-section-sub">Un sistema completo para gestionar las compras de tu organización.</p>
        </AnimatedSection>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <div className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-desc">{f.desc}</div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* STEPS */}
      <section className="lp-steps">
        <div className="lp-steps-inner">
          <AnimatedSection>
            <h2 className="lp-section-title">Arrancá en 3 pasos</h2>
            <p className="lp-section-sub">Ponelo en marcha en minutos, sin configuraciones complicadas.</p>
          </AnimatedSection>
          <div className="lp-steps-list">
            {STEPS.map((s, i) => (
              <AnimatedSection key={i} delay={i * 0.15}>
                <div className="lp-step">
                  <div className="lp-step-num">{s.num}</div>
                  <div className="lp-step-content">
                    <div className="lp-step-title">{s.title}</div>
                    <div className="lp-step-desc">{s.desc}</div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="lp-cta-section">
        <div className="lp-hero-orb lp-hero-orb-1" />
        <div className="lp-hero-orb lp-hero-orb-2" />
        <AnimatedSection>
          <h2>Transformá la gestión de compras de tu empresa</h2>
          <p>Registrate y empezá a digitalizar hoy mismo.</p>
          <div className="lp-hero-ctas">
            <Link href="/registro" className="lp-cta-main">Crear mi cuenta</Link>
            <Link href="/login" className="lp-cta-secondary" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', background: 'transparent' }}>Ya tengo cuenta</Link>
          </div>
        </AnimatedSection>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <p>&copy; {new Date().getFullYear()} Box — Sistema de gestión de compras</p>
      </footer>

      {/* WhatsApp FAB */}
      <a
        href="https://wa.me/5491123885910"
        target="_blank"
        rel="noopener noreferrer"
        className="lp-wpp-fab"
        aria-label="Contactar por WhatsApp"
      >
        <svg viewBox="0 0 32 32" width="28" height="28" fill="#fff">
          <path d="M16.004 2.003C8.27 2.003 2 8.27 2 16.003c0 2.48.648 4.9 1.88 7.036L2 30l7.167-1.88A13.94 13.94 0 0016.004 30C23.738 30 30 23.737 30 16.003S23.738 2.003 16.004 2.003zm0 25.53a11.49 11.49 0 01-5.87-1.608l-.42-.25-4.35 1.14 1.16-4.244-.274-.436a11.46 11.46 0 01-1.763-6.132c0-6.357 5.175-11.53 11.537-11.53 6.36 0 11.533 5.173 11.533 11.53-.003 6.36-5.176 11.53-11.553 11.53zm6.33-8.64c-.347-.174-2.053-1.013-2.372-1.13-.32-.114-.553-.173-.786.175-.232.347-.9 1.13-1.104 1.363-.203.232-.406.26-.753.087-.347-.174-1.465-.54-2.79-1.72-1.032-.918-1.728-2.053-1.93-2.4-.203-.347-.022-.534.153-.707.157-.156.347-.406.52-.608.174-.203.232-.348.348-.58.116-.232.058-.435-.03-.608-.087-.174-.785-1.893-1.075-2.593-.283-.68-.57-.588-.786-.6-.203-.01-.435-.012-.667-.012-.232 0-.608.087-.926.435-.32.347-1.217 1.188-1.217 2.9 0 1.71 1.246 3.363 1.42 3.595.173.232 2.45 3.742 5.94 5.248.83.36 1.48.574 1.985.735.834.265 1.593.228 2.193.138.67-.1 2.053-.84 2.342-1.65.29-.81.29-1.506.203-1.65-.087-.146-.32-.232-.667-.406z"/>
        </svg>
      </a>
    </div>
  );
}
