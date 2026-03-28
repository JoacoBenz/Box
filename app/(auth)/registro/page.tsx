'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, message } from 'antd';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: any) {
    if (values.password !== values.confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreColegio: values.nombreColegio,
          nombreUsuario: values.nombreUsuario,
          email: values.email,
          password: values.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Error al registrar el colegio');
        return;
      }

      message.success('¡Colegio registrado! Ya podés ingresar.');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3} style={{ marginBottom: 4 }}>Registrar Colegio</Title>
          <Text type="secondary">Creá el espacio de tu institución</Text>
        </div>

        {error && <Alert title={error} type="error" showIcon />}

        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="nombreColegio" label="Nombre del colegio" rules={[{ required: true, min: 3, message: 'Mínimo 3 caracteres' }]}>
            <Input placeholder="Colegio San Martín" size="large" />
          </Form.Item>

          <Form.Item name="nombreUsuario" label="Tu nombre" rules={[{ required: true, min: 2, message: 'Mínimo 2 caracteres' }]}>
            <Input placeholder="María González" size="large" />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}>
            <Input placeholder="director@colegio.edu.ar" size="large" />
          </Form.Item>

          <Form.Item name="password" label="Contraseña" rules={[{ required: true, min: 8, message: 'Mínimo 8 caracteres' }]}>
            <Input.Password placeholder="••••••••" size="large" />
          </Form.Item>

          <Form.Item name="confirmarPassword" label="Confirmar contraseña" rules={[{ required: true, message: 'Confirmá tu contraseña' }]}>
            <Input.Password placeholder="••••••••" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Registrar Colegio
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">¿Ya tenés cuenta? </Text>
          <Link href="/login">Ingresar</Link>
        </div>
      </Space>
    </Card>
  );
}
