'use client';

import { Button, Result } from 'antd';
import Link from 'next/link';

export default function AuthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Result
      status="error"
      title="Error"
      subTitle="Ocurrió un error. Intentá de nuevo."
      extra={[
        <Button key="retry" type="primary" onClick={reset}>
          Reintentar
        </Button>,
        <Link key="login" href="/login">
          <Button>Ir al login</Button>
        </Link>,
      ]}
    />
  );
}
