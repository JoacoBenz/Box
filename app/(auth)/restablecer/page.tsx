'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Result } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useFormValid } from '@/hooks/useFormValid';

const { Title, Text } = Typography;

export default function RestablecerPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [form] = Form.useForm();
  const { hasErrors, formProps } = useFormValid(form);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <Card style={{ width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none', borderRadius: 20 }} styles={{ body: { padding: '40px 36px' } }}>
        <Result
          status="error"
          title="Enlace inválido"
          subTitle="Este enlace no contiene un token válido."
          extra={<Link href="/recuperar"><Button type="primary">Solicitar nuevo enlace</Button></Link>}
        />
      </Card>
    );
  }

  async function onFinish(values: { password: string }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Error al restablecer la contraseña');
      } else {
        setSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card style={{ width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none', borderRadius: 20 }} styles={{ body: { padding: '40px 36px' } }}>
        <Result
          status="success"
          title="Contraseña restablecida"
          subTitle="Ya podés iniciar sesión con tu nueva contraseña."
          extra={<Link href="/login"><Button type="primary">Ir al login</Button></Link>}
        />
      </Card>
    );
  }

  return (
    <Card
      style={{ width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: 'none', borderRadius: 20 }}
      styles={{ body: { padding: '40px 36px' } }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4, fontWeight: 700 }}>Nueva contraseña</Title>
        <Text type="secondary" style={{ fontSize: 14 }}>Mínimo 10 caracteres, mayúscula, minúscula, número y especial</Text>
      </div>

      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16, borderRadius: 10 }} />}

      <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off" size="large" {...formProps}>
        <Form.Item
          name="password"
          label="Nueva contraseña"
          rules={[
            { required: true, message: 'Ingresá tu nueva contraseña' },
            { min: 10, message: 'Mínimo 10 caracteres' },
            { pattern: /[A-Z]/, message: 'Debe contener al menos una mayúscula' },
            { pattern: /[a-z]/, message: 'Debe contener al menos una minúscula' },
            { pattern: /[0-9]/, message: 'Debe contener al menos un número' },
            { pattern: /[^A-Za-z0-9]/, message: 'Debe contener al menos un carácter especial' },
          ]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: '#a0aec0' }} />} placeholder="••••••••••" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="Confirmar contraseña"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Confirmá tu contraseña' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('Las contraseñas no coinciden'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined style={{ color: '#a0aec0' }} />} placeholder="••••••••••" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            disabled={hasErrors || loading}
            style={{
              height: 46,
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
            }}
          >
            Restablecer contraseña
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
