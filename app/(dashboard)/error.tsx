'use client';

import { useEffect } from 'react';
import { Button, Result } from 'antd';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}
    >
      <Result
        status="error"
        title="Error en la aplicación"
        subTitle="No se pudo cargar esta sección. Intentá de nuevo."
        extra={
          <Button type="primary" onClick={reset}>
            Reintentar
          </Button>
        }
      />
    </div>
  );
}
