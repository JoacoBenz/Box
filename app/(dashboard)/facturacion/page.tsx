import { Suspense } from 'react';
import { FacturacionContent } from '@/components/facturacion/FacturacionContent';

export default function FacturacionPage() {
  return (
    <Suspense fallback={null}>
      <FacturacionContent />
    </Suspense>
  );
}
