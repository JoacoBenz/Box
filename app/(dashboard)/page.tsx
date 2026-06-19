'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Empty } from 'antd';
import dynamic from 'next/dynamic';

import { DashboardSkeleton, Greeting } from './components/dashboard-shared';
import OrgAdminPanel from './components/OrgAdminPanel';
import PendingActionsSection from './components/PendingActionsSection';
import MisMetricasSection from './components/MisMetricasSection';
import PlatformAdminPanel from './components/PlatformAdminPanel';
import RoleTablesSection from './components/RoleTablesSection';
import AnalyticsChartsSection from './components/AnalyticsChartsSection';

const DirectorDashboard = dynamic(() => import('./components/DirectorDashboard'), {
  loading: () => <div style={{ textAlign: 'center', padding: 40 }}>Cargando dashboard...</div>,
  ssr: false,
});

export default function DashboardPage() {
  // Fields are populated conditionally by role — accessed within role-conditional blocks
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [directorAreaId, setDirectorAreaId] = useState<number | null>(null);

  const fetchDashboard = useCallback((areaId?: number | null) => {
    const params = new URLSearchParams();
    if (areaId) params.set('directorAreaId', String(areaId));
    const url = `/api/dashboard${params.toString() ? `?${params}` : ''}`;
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Re-fetch when admin switches tenant
  useEffect(() => {
    const handler = () => {
      setLoading(true);
      setDirectorAreaId(null);
      fetchDashboard();
    };
    window.addEventListener('admin-tenant-change', handler);
    return () => window.removeEventListener('admin-tenant-change', handler);
  }, [fetchDashboard]);

  const handleDirectorAreaChange = (value: number | null) => {
    setDirectorAreaId(value);
    fetchDashboard(value);
  };

  // Chart maxes (memoized to avoid recalculation on every render)
  const maxAreaTotal = useMemo(
    () => Math.max(...(data?.gastoPorArea ?? []).map((a: any) => a.total), 1),
    [data?.gastoPorArea],
  );
  const maxProvTotal = useMemo(
    () => Math.max(...(data?.topProveedores ?? []).map((p: any) => p.total), 1),
    [data?.topProveedores],
  );
  const maxMesTrend = useMemo(
    () => Math.max(...(data?.tendenciaMensual ?? []).map((m: any) => m.total), 1),
    [data?.tendenciaMensual],
  );

  if (loading) return <DashboardSkeleton />;
  if (!data)
    return <Empty description="No se pudo cargar el dashboard. Intentá recargar la página." />;

  // Role detection
  const hasAnalytics = data.gastoPorArea !== undefined;
  const hasSolicitante = data.misSolicitudes !== undefined;
  const hasResponsable = data.pendientesValidar !== undefined;
  const hasDirector = data.pendientesAprobar !== undefined;
  const hasCompras =
    data.solicitudesAprobadas !== undefined || data.solicitudesEnCompras !== undefined;
  const hasTesoreria = data.pendientesComprar !== undefined;
  const hasAdmin = data.adminPlatform !== undefined;
  const hasOrgAdmin = data.orgAdmin !== undefined;

  return (
    <div className="page-content">
      <Greeting />

      {/* ── Director dashboard (first for directors) ── */}
      {hasDirector && (
        <DirectorDashboard
          data={data}
          directorAreaId={directorAreaId}
          onAreaChange={handleDirectorAreaChange}
          onRefresh={() => fetchDashboard(directorAreaId)}
        />
      )}

      {/* ── Org admin dashboard ── */}
      {hasOrgAdmin && !hasDirector && (
        <DirectorDashboard data={data} directorAreaId={null} onAreaChange={() => {}} />
      )}
      {hasOrgAdmin && <OrgAdminPanel data={data} />}

      {/* ── 1. Mis Acciones Pendientes ── */}
      <PendingActionsSection
        data={data}
        hasSolicitante={hasSolicitante}
        hasResponsable={hasResponsable}
        hasCompras={hasCompras}
        hasTesoreria={hasTesoreria}
      />

      {/* ── 2. Mis Métricas ── */}
      <MisMetricasSection
        data={data}
        hasAnalytics={hasAnalytics}
        hasSolicitante={hasSolicitante}
        hasResponsable={hasResponsable}
        hasDirector={hasDirector}
        hasCompras={hasCompras}
        hasTesoreria={hasTesoreria}
        hasAdmin={hasAdmin}
        hasOrgAdmin={hasOrgAdmin}
      />

      {/* ── 2.6 Admin platform dashboard ── */}
      {hasAdmin && <PlatformAdminPanel data={data} />}

      {/* ── 3. Role-specific tables ── */}
      <RoleTablesSection
        data={data}
        hasSolicitante={hasSolicitante}
        hasResponsable={hasResponsable}
        hasDirector={hasDirector}
        hasCompras={hasCompras}
        hasTesoreria={hasTesoreria}
      />

      {/* ── 4. Analytics charts (role-filtered) ── */}
      <AnalyticsChartsSection
        data={data}
        hasAnalytics={hasAnalytics}
        hasDirector={hasDirector}
        hasOrgAdmin={hasOrgAdmin}
        hasCompras={hasCompras}
        hasTesoreria={hasTesoreria}
        hasAdmin={hasAdmin}
        maxAreaTotal={maxAreaTotal}
        maxProvTotal={maxProvTotal}
        maxMesTrend={maxMesTrend}
      />
    </div>
  );
}
