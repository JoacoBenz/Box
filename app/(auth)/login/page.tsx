'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const { Title, Text } = Typography;

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    setError(null);
    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email o contraseña incorrectos');
      } else {
        router.push('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideUpFadeIn {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .login-card {
          animation: slideUpFadeIn 300ms ease-out both;
        }
        .anim-field-1 {
          animation: fadeInUp 300ms ease-out 100ms both;
        }
        .anim-field-2 {
          animation: fadeInUp 300ms ease-out 200ms both;
        }
        .anim-field-3 {
          animation: fadeInUp 300ms ease-out 300ms both;
        }
      `}</style>
      <Card
        className="login-card"
        style={{
          width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          border: 'none',
          borderRadius: 20,
        }}
        styles={{ body: { padding: '40px 36px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <Title level={3} style={{ marginBottom: 4, fontWeight: 700 }}>Gestión de Compras</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>Ingresá con tu cuenta</Text>
        </div>

        {error && <Alert title={error} type="error" showIcon style={{ marginBottom: 20, borderRadius: 10 }} />}

        <Form layout="vertical" onFinish={onFinish} autoComplete="off" size="large">
          <div className="anim-field-1">
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Ingresá un email válido' }]}>
              <Input prefix={<UserOutlined style={{ color: '#a0aec0' }} />} placeholder="tu@empresa.com" />
            </Form.Item>
          </div>

          <div className="anim-field-2">
            <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Ingresá tu contraseña' }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#a0aec0' }} />} placeholder="••••••••" />
            </Form.Item>
          </div>

          <div className="anim-field-3">
            <Form.Item style={{ marginBottom: 16, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
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
                Ingresar
              </Button>
            </Form.Item>
          </div>
        </Form>

        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>¿Tu organización aún no está registrada?</Text>
          <Link href="/registro" style={{ fontSize: 13, fontWeight: 600 }}> Registrarse</Link>
        </div>
      </Card>
    </>
  );
}
