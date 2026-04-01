'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space, Result } from 'antd';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function RegistroPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrado, setRegistrado] = useState(false);

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
          nombreOrganizacion: values.nombreOrganizacion,
          nombreUsuario: values.nombreUsuario,
          email: values.email,
          password: values.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Error al registrar la organización');
        return;
      }

      setRegistrado(true);
    } finally {
      setLoading(false);
    }
  }

  if (registrado) {
    return (
      <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Result
          status="success"
          title="Registro enviado"
          subTitle="Tu organización fue registrada y está pendiente de aprobación. Te notificaremos cuando sea activada."
          extra={<Link href="/login"><Button type="primary">Volver al inicio</Button></Link>}
        />
      </Card>
    );
  }

  return (
    <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3} style={{ marginBottom: 4 }}>Registrar Organización</Title>
          <Text type="secondary">Creá el espacio de tu organización</Text>
        </div>

        {error && <Alert title={error} type="error" showIcon />}

        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Form.Item name="nombreOrganizacion" label="Nombre de la organización" rules={[{ required: true, min: 3, message: 'Mínimo 3 caracteres' }]}>
            <Input placeholder="Mi Empresa S.A." size="large" />
          </Form.Item>

          <Form.Item name="nombreUsuario" label="Tu nombre" rules={[{ required: true, min: 2, message: 'Mínimo 2 caracteres' }]}>
            <Input placeholder="María González" size="large" />
          </Form.Item>

          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}>
            <Input placeholder="admin@empresa.com" size="large" />
          </Form.Item>

          <Form.Item name="password" label="Contraseña" rules={[
            { required: true, message: 'La contraseña es obligatoria' },
            { min: 10, message: 'Mínimo 10 caracteres' },
            { pattern: /[A-Z]/, message: 'Debe contener al menos una mayúscula' },
            { pattern: /[a-z]/, message: 'Debe contener al menos una minúscula' },
            { pattern: /[0-9]/, message: 'Debe contener al menos un número' },
            { pattern: /[^A-Za-z0-9]/, message: 'Debe contener al menos un carácter especial' },
          ]}>
            <Input.Password placeholder="Mínimo 10 caracteres" size="large" />
          </Form.Item>

          <Form.Item name="confirmarPassword" label="Confirmar contraseña" rules={[{ required: true, message: 'Confirmá tu contraseña' }]}>
            <Input.Password placeholder="••••••••" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Registrar Organización
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">¿Ya tenés cuenta? </Text>
          <Link href="/login">Ingresar</Link>
          <br />
          <Text type="secondary">¿Querés unirte a una organización existente? </Text>
          <Link href="/unirse">Unirse</Link>
        </div>
      </Space>
    </Card>
  );
}
