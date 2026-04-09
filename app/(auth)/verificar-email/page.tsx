'use client';

import { useEffect, useState } from 'react';
import { Card, Result, Spin, Button } from 'antd';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function VerificarEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Enlace inválido. No se encontró el token de verificación.');
      return;
    }

    const tipo = searchParams.get('tipo');
    const endpoint = tipo === 'unirse' ? '/api/unirse/verificar' : '/api/registro/verificar';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.message);
        } else {
          setStatus('error');
          setMessage(data.error?.message ?? 'Error al verificar el email');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Error de conexión. Intentá de nuevo.');
      });
  }, [token]);

  return (
    <Card
      style={{ width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none', borderRadius: 20 }}
      styles={{ body: { padding: '40px 36px' } }}
    >
      {status === 'loading' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p style={{ marginTop: 16, color: '#666' }}>Verificando tu email...</p>
        </div>
      )}

      {status === 'success' && (
        <Result
          status="success"
          title="Email verificado"
          subTitle={message}
          extra={<Link href="/login"><Button type="primary" size="large">Ir al login</Button></Link>}
        />
      )}

      {status === 'error' && (
        <Result
          status="error"
          title="No se pudo verificar"
          subTitle={message}
          extra={<Link href="/registro"><Button type="primary" size="large">Registrarse de nuevo</Button></Link>}
        />
      )}
    </Card>
  );
}
