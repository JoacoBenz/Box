'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Tag,
  Descriptions,
  message,
  Divider,
  Switch,
} from 'antd';
import { UserOutlined, LockOutlined, SaveOutlined, MailOutlined } from '@ant-design/icons';
import { useFormValid } from '@/hooks/useFormValid';

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

export default function PerfilPage() {
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

  return (
    <div className="page-content" style={{ maxWidth: 640 }}>
      <Title
        level={3}
        style={{ margin: 0, marginBottom: 16, fontWeight: 700, color: 'var(--text-primary)' }}
      >
        Mi Perfil
      </Title>

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
    </div>
  );
}
