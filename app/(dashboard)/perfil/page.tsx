'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Alert,
  Card,
  Form,
  Input,
  Button,
  Typography,
  Tag,
  Descriptions,
  message,
  Switch,
  Tabs,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SaveOutlined,
  MailOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import { useFormValid } from '@/hooks/useFormValid';
import { FacturacionContent } from '@/components/facturacion/FacturacionContent';

const { Title } = Typography;

interface Profile {
  nombre: string;
  email: string;
  area: string | null;
  organizacion: string | null;
  roles: string[];
  tienePassword: boolean;
  emailDigest: boolean;
}

const ROL_LABELS: Record<string, string> = {
  admin: 'Admin',
  director: 'Director',
  tesoreria: 'Tesorería',
  compras: 'Compras',
  responsable_area: 'Responsable de Área',
  solicitante: 'Solicitante',
};

/** Reasons that specifically indicate a billing redirect from the proxy. */
const BILLING_REASONS = new Set([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'no_subscription',
]);

export default function PerfilPage() {
  const searchParams = useSearchParams();
  // Support deep-links from Stripe checkout, SubscriptionBanner and the
  // proxy (which redirects here on expired/canceled subs). Only known
  // billing reasons open the Facturación tab — unrelated ?reason= values
  // leave the default "Mi cuenta" tab selected.
  const reasonParam = searchParams.get('reason');
  const initialTab =
    searchParams.get('tab') === 'facturacion' ||
    (reasonParam && BILLING_REASONS.has(reasonParam)) ||
    searchParams.get('checkout') === 'success'
      ? 'facturacion'
      : 'cuenta';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { hasErrors: hasNameErrors, formProps: nameFormProps } = useFormValid(form);
  const [passwordForm] = Form.useForm();
  const { hasErrors: hasPasswordErrors, formProps: passwordFormProps } = useFormValid(passwordForm);

  useEffect(() => {
    fetch('/api/auth/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProfile(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (profile) form.setFieldsValue({ nombre: profile.nombre });
  }, [profile, form]);

  const handleSaveNombre = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: values.nombre }),
      });
      if (res.ok) {
        message.success('Nombre actualizado');
        setProfile((prev) => (prev ? { ...prev, nombre: values.nombre } : prev));
      } else {
        const data = await res.json();
        message.error(data.error?.message ?? 'Error al guardar');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const values = await passwordForm.validateFields();
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passwordActual: values.passwordActual,
          passwordNuevo: values.passwordNuevo,
        }),
      });
      if (res.ok) {
        message.success('Contraseña actualizada');
        passwordForm.resetFields();
      } else {
        const data = await res.json();
        message.error(data.error?.message ?? 'Error al cambiar contraseña');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Cargando...</div>;
  if (!profile) return <div style={{ padding: 24 }}>Error al cargar el perfil</div>;

  const canManageBilling =
    profile.roles.includes('director') ||
    profile.roles.includes('admin') ||
    profile.roles.includes('super_admin');

  const cuentaTab = (
    <>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
          {!profile.roles.includes('admin') && (
            <Descriptions.Item label="Organización">
              {profile.organizacion ?? '—'}
            </Descriptions.Item>
          )}
          {!profile.roles.includes('admin') && (
            <Descriptions.Item label="Área">{profile.area ?? '—'}</Descriptions.Item>
          )}
          <Descriptions.Item label="Roles">
            {profile.roles.map((r) => (
              <Tag key={r} color="purple" style={{ marginBottom: 2 }}>
                {ROL_LABELS[r] ?? r}
              </Tag>
            ))}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Editar nombre" style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={handleSaveNombre} {...nameFormProps}>
          <Form.Item
            name="nombre"
            rules={[{ required: true, message: 'Requerido' }]}
            style={{ flex: 1 }}
          >
            <Input prefix={<UserOutlined />} placeholder="Nombre" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={hasNameErrors}
            >
              Guardar
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Notificaciones por email" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              <MailOutlined style={{ marginRight: 8 }} />
              Resumen diario de solicitudes pendientes
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Recibí un email con las solicitudes que esperan tu acción. Las urgentes (más de 3 días
              hábiles) se envían siempre.
            </div>
          </div>
          <Switch
            checked={profile.emailDigest}
            onChange={async (checked) => {
              const res = await fetch('/api/auth/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emailDigest: checked }),
              });
              if (res.ok) {
                setProfile((prev) => (prev ? { ...prev, emailDigest: checked } : prev));
                message.success(checked ? 'Emails activados' : 'Emails desactivados');
              } else {
                message.error('Error al guardar preferencia');
              }
            }}
          />
        </div>
      </Card>

      {(profile.tienePassword || profile.roles.includes('admin')) && (
        <Card title="Cambiar contraseña">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
            {...passwordFormProps}
          >
            {profile.tienePassword && (
              <Form.Item
                name="passwordActual"
                label="Contraseña actual"
                rules={[{ required: true, message: 'Requerido' }]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
            )}
            <Form.Item
              name="passwordNuevo"
              label="Nueva contraseña"
              rules={[
                { required: true, message: 'Requerido' },
                { min: 8, message: 'Mínimo 8 caracteres' },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>
            <Form.Item
              name="passwordConfirm"
              label="Confirmar contraseña"
              dependencies={['passwordNuevo']}
              rules={[
                { required: true, message: 'Requerido' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('passwordNuevo') === value)
                      return Promise.resolve();
                    return Promise.reject(new Error('Las contraseñas no coinciden'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<LockOutlined />}
              loading={saving}
              disabled={hasPasswordErrors}
            >
              Cambiar contraseña
            </Button>
          </Form>
        </Card>
      )}
    </>
  );

  const facturacionTab = (
    <Suspense fallback={null}>
      <FacturacionContent showHeading={false} />
    </Suspense>
  );

  const tabs = [
    {
      key: 'cuenta',
      label: (
        <span>
          <UserOutlined /> Mi cuenta
        </span>
      ),
      children: cuentaTab,
    },
    ...(canManageBilling
      ? [
          {
            key: 'facturacion',
            label: (
              <span>
                <CreditCardOutlined /> Facturación
              </span>
            ),
            children: facturacionTab,
          },
        ]
      : []),
  ];

  // When the proxy redirects a user without billing permissions here
  // because their tenant is blocked, explain the situation — the
  // Facturación tab won't exist for them to "just fix it".
  const blockedWithoutPermission =
    !canManageBilling &&
    reasonParam &&
    ['canceled', 'unpaid', 'no_subscription'].includes(reasonParam);

  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <Title
        level={3}
        style={{ margin: 0, marginBottom: 16, fontWeight: 700, color: 'var(--text-primary)' }}
      >
        Mi Perfil
      </Title>
      {blockedWithoutPermission && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="Tu organización no tiene acceso activo al sistema"
          description={
            <>
              La suscripción de <strong>{profile.organizacion ?? 'tu organización'}</strong> está
              inactiva. Contactá a la dirección para reactivar el plan.
            </>
          }
        />
      )}
      <Tabs defaultActiveKey={initialTab} items={tabs} size="large" />
    </div>
  );
}
