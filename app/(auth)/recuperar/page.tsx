'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useFormValid } from '@/hooks/useFormValid';

const { Title, Text } = Typography;

export default function RecuperarPage() {
  const [form] = Form.useForm();
  const { hasErrors, formProps } = useFormValid(form);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onFinish(values: { email: string }) {
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      style={{
        width: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        border: 'none',
        borderRadius: 20,
      }}
      styles={{ body: { padding: '40px 36px' } }}
    >
      {sent ? (
        <Result
          status="success"
          title="Revisá tu email"
          subTitle="Si el email está registrado, te enviamos un enlace para restablecer tu contraseña. Revisá también la carpeta de spam."
          extra={
            <Link href="/login">
              <Button type="primary">Volver al login</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <Title level={3} style={{ marginBottom: 4, fontWeight: 700 }}>
              Recuperar contraseña
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Ingresá tu email y te enviaremos un enlace
            </Text>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            {...formProps}
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: 'email', message: 'Ingresá un email válido' }]}
            >
              <Input
                prefix={<MailOutlined style={{ color: '#a0aec0' }} />}
                placeholder="tu@empresa.com"
              />
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
                Enviar enlace
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Link href="/login" style={{ fontSize: 13, fontWeight: 600 }}>
              Volver al login
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}
