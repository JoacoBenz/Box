'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Screenshot = {
  src: string;
  label: string;
  caption: string;
};

type Role = {
  id: string;
  emoji: string;
  tabLabel: string;
  pillLabel: string;
  title: string;
  desc: string;
  capabilities: string[];
  screenshots: Screenshot[];
};

const ROLES: Role[] = [
  {
    id: 'solicitante',
    emoji: '🙋',
    tabLabel: 'Solicitante',
    pillLabel: '🙋 Solicitante',
    title: 'Pedí lo que necesitás en minutos',
    desc: 'Todo empleado puede crear solicitudes con título, descripción, items, precio estimado, urgencia y adjuntos. El área y centro de costo se cargan automáticamente.',
    capabilities: [
      'Crear solicitudes con múltiples items y adjuntar presupuestos',
      'Guardar borradores y editarlos antes de enviar',
      'Seguir el recorrido completo con timeline auditado',
      'Ver su tasa de aprobación y el estado de cada pedido',
    ],
    screenshots: [
      {
        src: '/demo/13-solicitante-detalle.png',
        label: 'Detalle',
        caption: 'Solicitudes / detalle',
      },
      { src: '/demo/10-solicitante-dashboard.png', label: 'Dashboard', caption: 'Dashboard' },
      { src: '/demo/11-solicitante-lista.png', label: 'Lista', caption: 'Mis solicitudes' },
      { src: '/demo/12-solicitante-nueva-form.png', label: 'Nueva', caption: 'Nueva solicitud' },
      { src: '/demo/13b-solicitante-editar.png', label: 'Editar', caption: 'Editar borrador' },
      { src: '/demo/14-solicitante-perfil.png', label: 'Perfil', caption: 'Perfil' },
    ],
  },
  {
    id: 'responsable',
    emoji: '👥',
    tabLabel: 'Responsable',
    pillLabel: '👥 Responsable de Área',
    title: 'El responsable del área valida antes de subir',
    desc: 'Es quien conoce al equipo. Recibe las solicitudes de su área, las valida o devuelve con comentario, y ve el gasto mensual y anual en tiempo real.',
    capabilities: [
      'Cola de validación solo con solicitudes de su área',
      'Validar o devolver con comentario para corrección',
      'Métricas del área: gasto mes, año, devueltas por dirección',
      'Gestionar los solicitantes del área',
    ],
    screenshots: [
      {
        src: '/demo/21-responsable-validaciones.png',
        label: 'Validaciones',
        caption: 'Validaciones',
      },
      { src: '/demo/20-responsable-dashboard.png', label: 'Dashboard', caption: 'Dashboard' },
      {
        src: '/demo/21b-responsable-detalle-validar.png',
        label: 'Detalle',
        caption: 'Detalle para validar',
      },
      { src: '/demo/22-responsable-mi-area.png', label: 'Mi área', caption: 'Mi área' },
    ],
  },
  {
    id: 'director',
    emoji: '🎯',
    tabLabel: 'Director',
    pillLabel: '🎯 Dirección',
    title: 'Aprobación con todo el contexto financiero',
    desc: 'Dirección no aprueba a ciegas. KPIs del año y mes, pipeline por etapa, gasto por área, tendencia mensual, top proveedores y presupuesto vs. ejecución — todo en un solo panel.',
    capabilities: [
      'Aprobar de a una o en lote con checkboxes',
      'Ver KPIs y charts financieros en tiempo real',
      'Analizar gasto por producto, área y proveedor',
      'Exportar reportes a Excel',
    ],
    screenshots: [
      {
        src: '/demo/30-director-dashboard.png',
        label: 'Dashboard',
        caption: 'Dashboard ejecutivo',
      },
      { src: '/demo/31-director-aprobaciones.png', label: 'Aprobaciones', caption: 'Aprobaciones' },
      {
        src: '/demo/31b-director-detalle-aprobar.png',
        label: 'Detalle',
        caption: 'Detalle para aprobar',
      },
      { src: '/demo/32-director-reportes.png', label: 'Reportes', caption: 'Reportes' },
    ],
  },
  {
    id: 'compras',
    emoji: '🛒',
    tabLabel: 'Compras',
    pillLabel: '🛒 Compras',
    title: 'Compras ejecuta lo aprobado',
    desc: 'Recibe las solicitudes aprobadas, las procesa con el proveedor y programa la fecha de pago. Con historial completo por proveedor para negociar desde datos reales.',
    capabilities: [
      'Workbench para programar pagos con prioridad y observaciones',
      'CRUD de proveedores con CUIT, contacto y datos bancarios',
      'Historial por proveedor: solicitudes, compras y totales',
      'Pipeline filtrable por estado',
    ],
    screenshots: [
      { src: '/demo/41-compras-gestion.png', label: 'Gestión', caption: 'Gestión de compras' },
      { src: '/demo/40-compras-dashboard.png', label: 'Dashboard', caption: 'Dashboard' },
      { src: '/demo/42-compras-proveedores.png', label: 'Proveedores', caption: 'Proveedores' },
      {
        src: '/demo/43-compras-proveedor-historial.png',
        label: 'Historial',
        caption: 'Historial por proveedor',
      },
    ],
  },
  {
    id: 'tesoreria',
    emoji: '💰',
    tabLabel: 'Tesorería',
    pillLabel: '💰 Tesorería',
    title: 'Paga en fecha y confirma recepción',
    desc: 'El botón "Registrar Pago" se habilita el día acordado. Al llegar la mercadería, tesorería marca recepción conforme o con observaciones item por item — cierre del ciclo.',
    capabilities: [
      'Cola de pagos ordenada por fecha, con habilitación automática',
      'Registrar recepción conforme o con observaciones item-level',
      'Ver próximos pagos (7 días) y recepciones pendientes',
      'Historial de últimas compras registradas',
    ],
    screenshots: [
      { src: '/demo/51-tesoreria-compras-lista.png', label: 'Pagos', caption: 'Pagos programados' },
      { src: '/demo/50-tesoreria-dashboard.png', label: 'Dashboard', caption: 'Dashboard' },
      { src: '/demo/52-tesoreria-recepciones.png', label: 'Recepciones', caption: 'Recepciones' },
    ],
  },
  {
    id: 'admin',
    emoji: '⚙️',
    tabLabel: 'Administración',
    pillLabel: '⚙️ Administración',
    title: 'La organización bajo control',
    desc: 'Usuarios, áreas, centros de costo, invitaciones y auditoría completa. Presupuestos por área y CC. Log de acciones críticas con fecha, usuario e IP.',
    capabilities: [
      'CRUD de usuarios, áreas y centros de costo',
      'Presupuestos anual y mensual por área y CC',
      'Códigos de invitación con tope de usos y expiración',
      'Auditoría con filtros por acción, entidad y modo crítico',
    ],
    screenshots: [
      {
        src: '/demo/65-admin-dashboard.png',
        label: 'Dashboard',
        caption: 'Panel de administración',
      },
      { src: '/demo/60-admin-usuarios.png', label: 'Usuarios', caption: 'Usuarios' },
      { src: '/demo/61-admin-areas.png', label: 'Áreas', caption: 'Áreas' },
      { src: '/demo/62-admin-centros-costo.png', label: 'CCs', caption: 'Centros de costo' },
      { src: '/demo/63-admin-invitaciones.png', label: 'Invitaciones', caption: 'Invitaciones' },
      { src: '/demo/64-admin-auditoria.png', label: 'Auditoría', caption: 'Auditoría' },
    ],
  },
];

const FLOW_NODES = [
  { icon: '📝', step: '01', title: 'Solicitud', tab: 'solicitante', tone: 'teal' },
  { icon: '✅', step: '02', title: 'Validación', tab: 'responsable', tone: 'purple' },
  { icon: '🎯', step: '03', title: 'Aprobación', tab: 'director', tone: 'pink' },
  { icon: '🛒', step: '04', title: 'Compra', tab: 'compras', tone: 'orange' },
  { icon: '💰', step: '05', title: 'Pago', tab: 'tesoreria', tone: 'amber' },
  { icon: '📦', step: '06', title: 'Recepción', tab: 'tesoreria', tone: 'green' },
];

const CROSS_FEATURES = [
  {
    icon: '🔔',
    title: 'Notificaciones',
    desc: 'Alertas de presupuesto, recordatorios de pago, devoluciones.',
  },
  {
    icon: '🔍',
    title: 'Búsqueda global',
    desc: 'Solicitudes y proveedores desde cualquier pantalla.',
  },
  { icon: '🌙', title: 'Light & dark', desc: 'Dos temas completos, con preferencia por usuario.' },
  { icon: '📱', title: 'Mobile-ready', desc: 'Aprobá solicitudes desde el teléfono.' },
  { icon: '📊', title: 'Presupuestos', desc: 'Anual y mensual por área, con alertas automáticas.' },
  { icon: '🔒', title: 'Roles', desc: 'Segregación real de funciones por rol.' },
  { icon: '📎', title: 'Adjuntos', desc: 'Presupuestos y comprobantes pegados a la solicitud.' },
  { icon: '💳', title: 'MercadoPago', desc: 'Facturación integrada con suscripción.' },
];

const ACCESS_CARDS = [
  { src: '/demo/01-landing.png', title: 'Landing', desc: 'La puerta de entrada.' },
  { src: '/demo/02-login.png', title: 'Login', desc: 'Credenciales + OAuth.' },
  { src: '/demo/03-registro.png', title: 'Registro', desc: 'Alta de organización.' },
  { src: '/demo/04-unirse.png', title: 'Unirse', desc: 'Con código o dominio.' },
  { src: '/demo/05-recuperar.png', title: 'Recuperar', desc: 'Reset por email.' },
];

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState(ROLES[0].id);
  const [activeShot, setActiveShot] = useState<Record<string, number>>(
    Object.fromEntries(ROLES.map((r) => [r.id, 0])),
  );
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const explorerRef = useRef<HTMLElement>(null);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeRole = ROLES.find((r) => r.id === activeTab) ?? ROLES[0];
  const activeShotIdx = activeShot[activeTab] ?? 0;
  const activeScreenshot = activeRole.screenshots[activeShotIdx];

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-cycle thumbnails every 5s when explorer is in view
  useEffect(() => {
    const explorerEl = explorerRef.current;
    if (!explorerEl) return;

    const start = () => {
      if (cycleTimer.current) return;
      cycleTimer.current = setInterval(() => {
        setActiveShot((prev) => {
          const cur = prev[activeTab] ?? 0;
          const total = ROLES.find((r) => r.id === activeTab)?.screenshots.length ?? 1;
          return { ...prev, [activeTab]: (cur + 1) % total };
        });
      }, 5000);
    };
    const stop = () => {
      if (cycleTimer.current) {
        clearInterval(cycleTimer.current);
        cycleTimer.current = null;
      }
    };
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) start();
        else stop();
      },
      { threshold: 0.4 },
    );
    obs.observe(explorerEl);
    return () => {
      obs.disconnect();
      stop();
    };
  }, [activeTab]);

  // Close lightbox on Esc
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox]);

  const jumpToTab = useCallback((tab: string) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const selectShot = (idx: number) => {
    setActiveShot((prev) => ({ ...prev, [activeTab]: idx }));
  };

  return (
    <div className="demo-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        .demo-page {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1a1a2e;
          background: #fff;
          overflow-x: hidden;
          min-height: 100vh;
        }

        /* ---- NAV ---- */
        .demo-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 48px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.06);
          transition: box-shadow 0.3s;
        }
        .demo-nav.scrolled { box-shadow: 0 4px 30px rgba(0,0,0,0.08); }
        .demo-nav-logo {
          font-weight: 800; font-size: 22px; letter-spacing: -0.5px;
          color: #00C2CB; text-decoration: none;
        }
        .demo-nav-links { display: flex; gap: 8px; align-items: center; }
        .demo-nav-links a {
          padding: 8px 20px; border-radius: 10px; font-weight: 600; font-size: 14px;
          text-decoration: none; transition: all 0.2s;
        }
        .demo-btn-ghost { color: #555; }
        .demo-btn-ghost:hover { background: #f5f5f5; color: #1a1a2e; }
        .demo-btn-primary {
          background: linear-gradient(135deg, #00C2CB, #0891b2);
          color: #fff !important; box-shadow: 0 4px 15px rgba(0,194,203,0.3);
        }
        .demo-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,194,203,0.4); }

        /* ---- HERO ---- */
        .demo-hero {
          padding: 140px 48px 60px; text-align: center;
          background: linear-gradient(180deg, #f0fdff 0%, #fff 100%);
          position: relative; overflow: hidden;
        }
        .demo-hero-orb {
          position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.45;
          pointer-events: none;
        }
        .demo-orb-1 { width: 500px; height: 500px; background: #00C2CB; top: -20%; right: -8%; }
        .demo-orb-2 { width: 400px; height: 400px; background: #a78bfa; bottom: -30%; left: -8%; }
        .demo-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px; border-radius: 100px;
          background: rgba(0,194,203,0.1); color: #0891b2;
          font-weight: 700; font-size: 12px; letter-spacing: 1.5px;
          text-transform: uppercase; margin-bottom: 20px;
          position: relative; z-index: 1;
        }
        .demo-hero h1 {
          font-size: clamp(36px, 5.5vw, 60px); font-weight: 900; line-height: 1.05;
          letter-spacing: -1.5px; margin: 0 auto 18px; max-width: 800px;
          position: relative; z-index: 1;
        }
        .demo-hero h1 span {
          background: linear-gradient(135deg, #00C2CB, #0891b2, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .demo-hero-tag {
          font-size: clamp(15px, 1.5vw, 18px); color: #666;
          max-width: 640px; margin: 0 auto 28px; line-height: 1.6;
          position: relative; z-index: 1;
        }
        .demo-hero-ctas {
          display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;
          position: relative; z-index: 1;
        }
        .demo-hero-ctas a {
          padding: 12px 24px; border-radius: 100px; font-weight: 700;
          font-size: 14px; text-decoration: none; transition: all 0.25s;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .demo-cta-main {
          background: linear-gradient(135deg, #00C2CB, #0891b2);
          color: #fff; box-shadow: 0 8px 24px rgba(0,194,203,0.3);
        }
        .demo-cta-main:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(0,194,203,0.4); }
        .demo-cta-ghost {
          background: #fff; color: #1a1a2e; border: 2px solid #e5e5e5;
        }
        .demo-cta-ghost:hover { border-color: #00C2CB; color: #0891b2; }

        /* ---- FLOW DIAGRAM ---- */
        .demo-flow-wrap {
          max-width: 1100px; margin: 32px auto 80px; padding: 0 16px;
        }
        .demo-flow {
          display: flex; align-items: stretch; gap: 0; flex-wrap: wrap;
          justify-content: center; padding: 24px 20px;
          background: linear-gradient(180deg, #fff, #fafafa);
          border: 1px solid #f0f0f0; border-radius: 24px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.04);
        }
        .demo-flow-node {
          flex: 1 1 130px; min-width: 130px; text-align: center;
          padding: 12px 8px; cursor: pointer; background: none; border: none;
          font-family: inherit; border-radius: 14px;
          transition: background 0.2s ease;
        }
        .demo-flow-node:hover { background: rgba(0,194,203,0.05); }
        .demo-flow-icon {
          width: 56px; height: 56px; margin: 0 auto 10px;
          border-radius: 16px; display: flex; align-items: center;
          justify-content: center; font-size: 26px;
          transition: all 0.3s ease; animation: floatY 4s ease-in-out infinite;
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .demo-flow-icon.tone-teal { background: rgba(0,194,203,0.1); border: 1px solid rgba(0,194,203,0.25); }
        .demo-flow-icon.tone-purple { background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.25); animation-delay: 0.3s; }
        .demo-flow-icon.tone-pink { background: rgba(236,72,153,0.1); border: 1px solid rgba(236,72,153,0.25); animation-delay: 0.6s; }
        .demo-flow-icon.tone-orange { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.25); animation-delay: 0.9s; }
        .demo-flow-icon.tone-amber { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); animation-delay: 1.2s; }
        .demo-flow-icon.tone-green { background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.25); animation-delay: 1.5s; }
        .demo-flow-node:hover .demo-flow-icon {
          transform: scale(1.08);
          box-shadow: 0 8px 20px rgba(0,194,203,0.2);
        }
        .demo-flow-step {
          font-size: 10px; font-weight: 700; letter-spacing: 1px;
          color: #aaa; text-transform: uppercase;
        }
        .demo-flow-title {
          font-weight: 700; font-size: 14px; color: #1a1a2e; margin-top: 2px;
        }
        .demo-flow-arrow {
          display: flex; align-items: center; justify-content: center;
          flex: 0 0 24px; color: #00C2CB; font-size: 18px;
          opacity: 0.6; animation: arrowSlide 1.6s ease-in-out infinite;
        }
        @keyframes arrowSlide {
          0%, 100% { transform: translateX(0); opacity: 0.4; }
          50% { transform: translateX(4px); opacity: 0.9; }
        }

        /* ---- EXPLORER (tabbed role viewer) ---- */
        .demo-explorer-wrap {
          max-width: 1200px; margin: 0 auto 96px; padding: 0 16px;
          scroll-margin-top: 80px;
        }
        .demo-explorer {
          background: #fff; border: 1px solid #f0f0f0;
          border-radius: 24px; overflow: hidden;
          box-shadow: 0 25px 80px rgba(0,0,0,0.08);
        }
        .demo-tabs {
          display: flex; gap: 4px; padding: 14px 14px 0;
          overflow-x: auto; overflow-y: hidden;
          scrollbar-width: none; -ms-overflow-style: none;
          border-bottom: 1px solid #f0f0f0;
          background: linear-gradient(180deg, #fafafa, #fff);
          justify-content: center;
        }
        .demo-tabs::-webkit-scrollbar { display: none; }
        .demo-tab {
          padding: 12px 18px; background: transparent; border: none;
          color: #888; font-size: 13.5px; font-weight: 600;
          cursor: pointer; border-radius: 10px 10px 0 0;
          white-space: nowrap; transition: color 0.2s ease;
          display: inline-flex; align-items: center; gap: 8px;
          position: relative; font-family: inherit; flex-shrink: 0;
        }
        .demo-tab:hover { color: #1a1a2e; }
        .demo-tab.active { color: #0891b2; }
        .demo-tab.active::after {
          content: ''; position: absolute;
          left: 14px; right: 14px; bottom: -1px;
          height: 3px; background: linear-gradient(90deg, #00C2CB, #0891b2);
          border-radius: 3px 3px 0 0;
          animation: tabIn 0.3s ease;
        }
        @keyframes tabIn {
          from { transform: scaleX(0.3); opacity: 0; }
          to { transform: scaleX(1); opacity: 1; }
        }
        .demo-tab .emoji { font-size: 16px; }

        .demo-panel {
          display: grid; grid-template-columns: 1.85fr 1fr;
          gap: 28px; padding: 28px;
          animation: panelIn 0.4s ease;
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .demo-stage {
          position: relative; border-radius: 16px; overflow: hidden;
          border: 1px solid #f0f0f0; background: #f7f7f8;
          cursor: zoom-in;
          box-shadow: 0 16px 40px rgba(0,0,0,0.08);
        }
        .demo-stage-scroll {
          max-height: 560px; overflow-y: auto; overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(0,194,203,0.5) transparent;
        }
        .demo-stage-scroll::-webkit-scrollbar { width: 6px; }
        .demo-stage-scroll::-webkit-scrollbar-track { background: transparent; }
        .demo-stage-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,194,203,0.4); border-radius: 3px;
        }
        .demo-stage-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0,194,203,0.7);
        }
        .demo-stage-img {
          width: 100%; height: auto; display: block;
          transition: opacity 0.3s ease;
        }
        .demo-stage::before {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0;
          height: 50px; background: linear-gradient(to top, rgba(255,255,255,0.85), transparent);
          pointer-events: none; z-index: 1;
        }
        .demo-stage::after {
          content: '⛶'; position: absolute; top: 12px; right: 12px;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(0,0,0,0.5); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; backdrop-filter: blur(6px);
          opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
        }
        .demo-stage:hover::after { opacity: 1; }
        .demo-stage-caption {
          position: absolute; left: 14px; bottom: 14px;
          padding: 7px 12px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 999px;
          font-size: 11.5px; font-weight: 600; color: #1a1a2e;
          font-family: 'SF Mono', monospace;
          letter-spacing: 0.02em; z-index: 2;
        }

        .demo-info {
          display: flex; flex-direction: column; gap: 16px;
          align-items: flex-start;
        }
        .demo-role-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 14px; border-radius: 999px;
          background: rgba(0,194,203,0.1);
          color: #0891b2; border: 1px solid rgba(0,194,203,0.25);
          font-size: 12px; font-weight: 700;
        }
        .demo-info h2 {
          font-size: clamp(22px, 2.4vw, 28px); font-weight: 800;
          letter-spacing: -0.5px; line-height: 1.2; margin: 0; color: #1a1a2e;
        }
        .demo-info-desc {
          color: #666; font-size: 15px; line-height: 1.65; margin: 0;
        }
        .demo-info h3 {
          font-size: 14px; font-weight: 700; color: #1a1a2e;
          margin: 4px 0 0; letter-spacing: -0.2px;
        }
        .demo-info ul {
          list-style: none; padding: 0; margin: 0;
          display: flex; flex-direction: column; gap: 8px; align-self: stretch;
        }
        .demo-info li {
          font-size: 14px; color: #555; line-height: 1.55;
          display: flex; gap: 10px; align-items: flex-start;
        }
        .demo-info li::before {
          content: '→'; color: #00C2CB; font-weight: 700;
          flex-shrink: 0; margin-top: 1px;
        }

        .demo-thumbs {
          display: flex; gap: 10px;
          overflow-x: auto; overflow-y: hidden;
          padding: 4px 0; margin-top: 4px;
          scrollbar-width: none; -ms-overflow-style: none;
          grid-column: 1 / -1;
        }
        .demo-thumbs::-webkit-scrollbar { display: none; }
        .demo-thumb {
          flex: 0 0 150px; aspect-ratio: 16 / 10;
          border-radius: 10px; overflow: hidden;
          border: 2px solid #f0f0f0;
          cursor: pointer; position: relative;
          background: #f7f7f8; padding: 0;
          transition: all 0.2s ease;
        }
        .demo-thumb:hover {
          border-color: #aaa; transform: translateY(-2px);
        }
        .demo-thumb.active {
          border-color: #00C2CB;
          box-shadow: 0 0 0 3px rgba(0,194,203,0.2);
        }
        .demo-thumb-img {
          object-fit: cover; object-position: top center;
        }
        .demo-thumb-label {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 4px 8px;
          background: linear-gradient(0deg, rgba(0,0,0,0.85), transparent);
          font-size: 10px; font-weight: 600; color: #fff;
          text-align: left; line-height: 1.2;
        }

        /* ---- SECTION INTRO ---- */
        .demo-section-intro {
          max-width: 1200px; margin: 0 auto 32px;
          padding: 0 16px; text-align: center;
        }
        .demo-eyebrow {
          display: inline-block; font-size: 11px; font-weight: 700;
          color: #0891b2; text-transform: uppercase;
          letter-spacing: 1.5px; margin-bottom: 8px;
        }
        .demo-section-intro h2 {
          font-size: clamp(28px, 3.4vw, 38px); font-weight: 800;
          letter-spacing: -1px; margin: 0 0 10px; color: #1a1a2e;
        }
        .demo-section-intro p {
          color: #666; max-width: 640px; margin: 0 auto; font-size: 15px;
        }

        /* ---- FEATURES ---- */
        .demo-features-wrap {
          max-width: 1200px; margin: 0 auto 80px; padding: 0 16px;
        }
        .demo-features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
        }
        .demo-feature {
          padding: 20px 22px; background: #fafafa;
          border: 1px solid #f0f0f0; border-radius: 16px;
          transition: all 0.3s ease;
        }
        .demo-feature:hover {
          transform: translateY(-3px);
          border-color: rgba(167,139,250,0.4);
          box-shadow: 0 12px 30px rgba(167,139,250,0.1);
        }
        .demo-feature-icon { font-size: 24px; margin-bottom: 8px; display: block; }
        .demo-feature h4 {
          font-size: 15px; font-weight: 700; margin: 0 0 4px; color: #1a1a2e;
        }
        .demo-feature p {
          color: #666; font-size: 13px; line-height: 1.5; margin: 0;
        }

        /* ---- ACCESS STRIP ---- */
        .demo-strip-wrap {
          max-width: 1200px; margin: 0 auto 80px; padding: 0 16px;
        }
        .demo-strip {
          display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px;
        }
        .demo-strip-card {
          background: #fff; border: 1px solid #f0f0f0;
          border-radius: 14px; overflow: hidden;
          cursor: pointer; transition: all 0.3s ease;
          padding: 0; font-family: inherit; text-align: left;
        }
        .demo-strip-card:hover {
          transform: translateY(-3px); border-color: #00C2CB;
          box-shadow: 0 12px 30px rgba(0,194,203,0.12);
        }
        .demo-strip-media {
          aspect-ratio: 4 / 3; overflow: hidden;
          background: #f7f7f8; position: relative;
        }
        .demo-strip-media img {
          object-fit: cover; object-position: top center;
          transition: transform 0.5s ease;
        }
        .demo-strip-card:hover .demo-strip-media img { transform: scale(1.05); }
        .demo-strip-body { padding: 12px 14px; }
        .demo-strip-body h4 {
          font-size: 13px; font-weight: 700; color: #1a1a2e; margin: 0;
        }
        .demo-strip-body p {
          font-size: 11px; color: #888; margin: 2px 0 0;
        }

        /* ---- CTA ---- */
        .demo-cta-wrap {
          max-width: 1200px; margin: 0 auto 80px; padding: 0 16px;
        }
        .demo-cta-section {
          padding: 56px 32px; text-align: center;
          background: linear-gradient(135deg, rgba(0,194,203,0.08), rgba(167,139,250,0.08));
          border: 1px solid rgba(0,194,203,0.2); border-radius: 24px;
          position: relative; overflow: hidden;
        }
        .demo-cta-section::before {
          content: ''; position: absolute; inset: -50%;
          background: conic-gradient(from 0deg, transparent, rgba(0,194,203,0.12), transparent 30%);
          animation: ctaSpin 12s linear infinite; pointer-events: none;
        }
        @keyframes ctaSpin { to { transform: rotate(360deg); } }
        .demo-cta-section > * { position: relative; z-index: 1; }
        .demo-cta-section h2 {
          font-size: clamp(26px, 3vw, 36px); font-weight: 800;
          margin: 0 0 10px; letter-spacing: -0.5px; color: #1a1a2e;
        }
        .demo-cta-section p {
          color: #666; max-width: 540px; margin: 0 auto 24px;
          font-size: 15px;
        }

        /* ---- FOOTER ---- */
        .demo-footer {
          padding: 28px 24px; text-align: center;
          font-size: 13px; color: #aaa;
          border-top: 1px solid #f0f0f0;
          max-width: 1200px; margin: 0 auto;
        }
        .demo-footer-links {
          display: flex; gap: 14px; justify-content: center;
          margin-bottom: 8px; flex-wrap: wrap;
        }
        .demo-footer-links a {
          color: #777; text-decoration: none;
          transition: color 0.2s ease;
        }
        .demo-footer-links a:hover { color: #0891b2; }
        .demo-footer-sep { opacity: 0.4; }

        /* ---- LIGHTBOX ---- */
        .demo-lightbox {
          position: fixed; inset: 0;
          background: rgba(10, 15, 30, 0.92);
          backdrop-filter: blur(12px);
          z-index: 200;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: lbIn 0.2s ease;
        }
        @keyframes lbIn { from { opacity: 0; } to { opacity: 1; } }
        .demo-lightbox-img {
          max-width: 95vw; max-height: 90vh;
          object-fit: contain; border-radius: 12px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        }
        .demo-lightbox-close {
          position: absolute; top: 18px; right: 22px;
          width: 42px; height: 42px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.08);
          color: #fff; font-size: 22px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s ease;
        }
        .demo-lightbox-close:hover {
          background: #ef4444; border-color: #ef4444; transform: scale(1.05);
        }

        /* ---- RESPONSIVE ---- */
        @media (max-width: 960px) {
          .demo-panel { grid-template-columns: 1fr; gap: 20px; }
        }
        @media (max-width: 768px) {
          .demo-nav { padding: 12px 20px; }
          .demo-nav-logo { font-size: 18px; }
          .demo-hero { padding: 110px 20px 40px; }
          .demo-flow-arrow { transform: rotate(90deg); flex: 0 0 100%; padding: 4px 0; }
          .demo-strip { grid-template-columns: repeat(2, 1fr); }
          .demo-panel { padding: 18px; gap: 18px; }
          .demo-tabs { padding: 8px 8px 0; justify-content: flex-start; }
          .demo-tab { padding: 10px 12px; font-size: 12.5px; }
          .demo-info h2 { font-size: 20px; }
          .demo-section-intro h2 { font-size: 26px; }
          .demo-cta-section { padding: 40px 20px; }
        }
      `}</style>

      {/* NAV */}
      <nav className={`demo-nav ${scrollY > 20 ? 'scrolled' : ''}`}>
        <Link href="/inicio" className="demo-nav-logo">
          📦 Box
        </Link>
        <div className="demo-nav-links">
          <Link href="/inicio" className="demo-btn-ghost">
            Volver al inicio
          </Link>
          <Link href="/registro" className="demo-btn-primary">
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="demo-hero">
        <div className="demo-hero-orb demo-orb-1" />
        <div className="demo-hero-orb demo-orb-2" />
        <div className="demo-hero-eyebrow">📦 Box · Demo del producto</div>
        <h1>
          El ciclo de compras
          <br />
          <span>de punta a punta</span>
        </h1>
        <p className="demo-hero-tag">
          Desde que alguien pide hasta que tesorería paga y se confirma la recepción. Trazabilidad
          completa, aprobaciones multinivel, presupuestos por área.
        </p>
        <div className="demo-hero-ctas">
          <Link href="/registro" className="demo-cta-main">
            Empezar prueba gratis →
          </Link>
          <a href="#explorer" className="demo-cta-ghost">
            Ver el producto
          </a>
        </div>
      </header>

      {/* FLOW */}
      <section className="demo-flow-wrap">
        <div className="demo-flow">
          {FLOW_NODES.map((n, i) => (
            <span key={i} style={{ display: 'contents' }}>
              <button
                className="demo-flow-node"
                onClick={() => jumpToTab(n.tab)}
                aria-label={`Ir a ${n.title}`}
              >
                <div className={`demo-flow-icon tone-${n.tone}`}>{n.icon}</div>
                <div className="demo-flow-step">{n.step}</div>
                <div className="demo-flow-title">{n.title}</div>
              </button>
              {i < FLOW_NODES.length - 1 && <div className="demo-flow-arrow">→</div>}
            </span>
          ))}
        </div>
      </section>

      {/* EXPLORER */}
      <section id="explorer" className="demo-explorer-wrap" ref={explorerRef}>
        <div className="demo-explorer">
          <div className="demo-tabs">
            {ROLES.map((r) => (
              <button
                key={r.id}
                className={`demo-tab ${activeTab === r.id ? 'active' : ''}`}
                onClick={() => setActiveTab(r.id)}
              >
                <span className="emoji">{r.emoji}</span>
                {r.tabLabel}
              </button>
            ))}
          </div>

          <div className="demo-panel" key={activeRole.id}>
            <div className="demo-stage" onClick={() => setLightbox(activeScreenshot.src)}>
              <div className="demo-stage-scroll">
                <Image
                  key={activeScreenshot.src}
                  src={activeScreenshot.src}
                  alt={activeScreenshot.caption}
                  width={1600}
                  height={1000}
                  sizes="(max-width: 960px) 100vw, 720px"
                  priority
                  className="demo-stage-img"
                />
              </div>
              <span className="demo-stage-caption">{activeScreenshot.caption}</span>
            </div>

            <div className="demo-info">
              <span className="demo-role-pill">{activeRole.pillLabel}</span>
              <h2>{activeRole.title}</h2>
              <p className="demo-info-desc">{activeRole.desc}</p>
              <h3>Lo que puede hacer</h3>
              <ul>
                {activeRole.capabilities.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="demo-thumbs">
              {activeRole.screenshots.map((s, i) => (
                <button
                  key={s.src}
                  className={`demo-thumb ${activeShotIdx === i ? 'active' : ''}`}
                  onClick={() => selectShot(i)}
                  aria-label={s.caption}
                >
                  <Image src={s.src} alt="" fill sizes="150px" className="demo-thumb-img" />
                  <span className="demo-thumb-label">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CROSS-CUTTING FEATURES */}
      <div className="demo-section-intro">
        <span className="demo-eyebrow">Features transversales</span>
        <h2>Detalles que hacen la diferencia</h2>
        <p>Cosas que vas a usar todos los días sin pensarlas.</p>
      </div>
      <section className="demo-features-wrap">
        <div className="demo-features-grid">
          {CROSS_FEATURES.map((f, i) => (
            <div key={i} className="demo-feature">
              <span className="demo-feature-icon">{f.icon}</span>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ACCESS STRIP */}
      <div className="demo-section-intro">
        <span className="demo-eyebrow">Acceso</span>
        <h2>Una entrada para cada camino</h2>
      </div>
      <section className="demo-strip-wrap">
        <div className="demo-strip">
          {ACCESS_CARDS.map((c, i) => (
            <button
              key={i}
              className="demo-strip-card"
              onClick={() => setLightbox(c.src)}
              aria-label={`Ampliar ${c.title}`}
            >
              <div className="demo-strip-media">
                <Image src={c.src} alt={c.title} fill sizes="(max-width: 720px) 50vw, 240px" />
              </div>
              <div className="demo-strip-body">
                <h4>{c.title}</h4>
                <p>{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="demo-cta-wrap">
        <div className="demo-cta-section">
          <h2>¿Listos para ver Box en acción?</h2>
          <p>
            14 días de prueba sin ingresar tarjeta. Sumás a tu equipo en minutos y empezás a
            procesar compras el mismo día.
          </p>
          <div className="demo-hero-ctas">
            <Link href="/registro" className="demo-cta-main">
              Empezar prueba gratis →
            </Link>
            <Link href="/login" className="demo-cta-ghost">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="demo-footer">
        <div className="demo-footer-links">
          <Link href="/inicio">Inicio</Link>
          <span className="demo-footer-sep">·</span>
          <Link href="/terminos">Términos</Link>
          <span className="demo-footer-sep">·</span>
          <Link href="/privacidad">Privacidad</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} Box — Sistema de gestión de compras</p>
      </footer>

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          className="demo-lightbox"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="demo-lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            aria-label="Cerrar"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="demo-lightbox-img"
            src={lightbox}
            alt="Screenshot ampliada"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
