'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

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

        /* ---- FEATURES ---- */
        .lp-features {
          padding: 100px 48px; max-width: 1200px; margin: 0 auto;
        }
        .lp-section-title {
          text-align: center; font-size: clamp(30px, 4vw, 44px); font-weight: 800;
          letter-spacing: -1px; margin-bottom: 16px;
        }
        .lp-section-sub {
          text-align: center; font-size: 18px; color: #888; margin-bottom: 64px; max-width: 500px; margin-left: auto; margin-right: auto;
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
          padding: 100px 48px;
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

        /* ---- RESPONSIVE ---- */
        @media (max-width: 768px) {
          .lp-nav { padding: 12px 20px; }
          .lp-hero, .lp-features, .lp-steps, .lp-cta-section { padding-left: 20px; padding-right: 20px; }
          .lp-float-cards { flex-direction: column; align-items: center; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-steps-list::before { left: 30px; }
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
    </div>
  );
}
