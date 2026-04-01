'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Result, AutoComplete } from 'antd';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const { Title, Text } = Typography;

interface OrgMatch {
  tenant_id: number;
  tenant_nombre: string;
  areas: { id: number; nombre: string }[];
}

export default function UnirsePage() {
  const searchParams = useSearchParams();
  const codigoParam = searchParams.get('codigo');

  const [step, setStep] = useState<'email' | 'form'>(codigoParam ? 'form' : 'email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgMatch, setOrgMatch] = useState<OrgMatch | null>(null);
  const [emailValue, setEmailValue] = useState('');
  const [codigoValue, setCodigoValue] = useState(codigoParam ?? '');
  const [registrado, setRegistrado] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [form] = Form.useForm();

  // Auto-validate code from URL param
  useEffect(() => {
    if (codigoParam) {
      validarCodigo(codigoParam);
    }
  }, [codigoParam]);

  async function buscarPorEmail() {
    if (!emailValue || !emailValue.includes('@')) {
      setError('Ingresá un email válido');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/unirse/dominio?email=${encodeURIComponent(emailValue)}`);
      const data = await res.json();
      if (data.match) {
        setOrgMatch(data);
        setStep('form');
        form.setFieldValue('email', emailValue);
      } else {
        setError('No se encontró una organización para tu dominio de email. Si tenés un código de invitación, ingresalo abajo.');
      }
    } catch {
      setError('Error al buscar organización');
    } finally {
      setLoading(false);
    }
  }

  async function validarCodigo(code: string) {
    if (!code || code.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/unirse/codigo?codigo=${encodeURIComponent(code)}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? 'Código inválido');
        return;
      }
      const data = await res.json();
      setOrgMatch(data);
      setCodigoValue(code);
      setStep('form');
    } catch {
      setError('Error al validar código');
    } finally {
      setLoading(false);
    }
  }

  async function onFinish(values: any) {
    if (values.password !== values.confirmarPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/unirse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: values.nombre,
          email: values.email || emailValue,
          password: values.password,
          area_texto: values.area_texto,
          ...(codigoValue && { codigo: codigoValue }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Error al registrarse');
        return;
      }
      setSuccessMsg(data.message);
      setRegistrado(true);
    } catch {
      setError('Error al registrarse');
    } finally {
      setLoading(false);
    }
  }

  if (registrado) {
    return (
      <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Result
          status="success"
          title="Cuenta creada"
          subTitle={successMsg}
          extra={<Link href="/login"><Button type="primary">Ingresar</Button></Link>}
        />
      </Card>
    );
  }

  return (
    <Card style={{ width: 480, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>Unirse a una Organización</Title>
        <Text type="secondary">Ingresá con tu email institucional o código de invitación</Text>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {step === 'email' && (
        <>
          <Form layout="vertical" onFinish={buscarPorEmail}>
            <Form.Item label="Email institucional">
              <Input
                placeholder="tu@escuela.edu.ar"
                size="large"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Buscar organización
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <Text type="secondary">— o —</Text>
          </div>

          <Form layout="vertical" onFinish={(v) => validarCodigo(v.codigo)}>
            <Form.Item label="Código de invitación" name="codigo">
              <Input placeholder="ABCD1234" size="large" maxLength={8} style={{ textTransform: 'uppercase' }} />
            </Form.Item>
            <Form.Item>
              <Button htmlType="submit" block size="large" loading={loading}>
                Validar código
              </Button>
            </Form.Item>
          </Form>
        </>
      )}

      {step === 'form' && orgMatch && (
        <>
          <Alert
            message={`Organización: ${orgMatch.tenant_nombre}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item name="nombre" label="Tu nombre completo" rules={[{ required: true, min: 2, message: 'Mínimo 2 caracteres' }]}>
              <Input placeholder="Juan Pérez" size="large" autoFocus />
            </Form.Item>

            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email inválido' }]}
              initialValue={emailValue}
            >
              <Input placeholder="tu@escuela.edu.ar" size="large" />
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
              <Input.Password placeholder="Repetí tu contraseña" size="large" />
            </Form.Item>

            <Form.Item name="area_texto" label="Tu área de trabajo" rules={[{ required: true, min: 2, message: 'Indicá tu área' }]}>
              <AutoComplete
                options={orgMatch.areas.map(a => ({ value: a.nombre }))}
                placeholder="Ej: Secretaría, Dirección, Preceptoría..."
                filterOption={(input, option) =>
                  (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                <Input size="large" />
              </AutoComplete>
            </Form.Item>

            <Form.Item style={{ marginBottom: 8 }}>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Crear cuenta
              </Button>
            </Form.Item>

            <Button type="link" block onClick={() => { setStep('email'); setOrgMatch(null); setError(null); }}>
              Volver
            </Button>
          </Form>
        </>
      )}

      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <Text type="secondary">¿Ya tenés cuenta? </Text>
        <Link href="/login">Ingresar</Link>
        <br />
        <Text type="secondary">¿Querés registrar una nueva organización? </Text>
        <Link href="/registro">Registrar</Link>
      </div>
    </Card>
  );
}
