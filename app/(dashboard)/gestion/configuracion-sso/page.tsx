'use client'

import { useEffect, useState, useCallback } from 'react'
import { App, Card, Form, Input, Switch, Button, Typography, Spin, Space } from 'antd'
import { useAdminTenant } from '@/components/admin/TenantSelector'
import { useFormValid } from '@/hooks/useFormValid'

const { Title, Text } = Typography

export default function ConfiguracionSSOPage() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { hasErrors, formProps } = useFormValid(form)
  const [selectedTenant] = useAdminTenant()

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/configuracion')
      if (!res.ok) throw new Error('Error al cargar configuración')
      const data = await res.json()
      form.setFieldsValue({
        sso_dominio: data.sso_dominio ?? '',
        sso_google_habilitado: data.sso_google_habilitado === 'true',
        sso_microsoft_habilitado: data.sso_microsoft_habilitado === 'true',
      })
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedTenant])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  async function saveKey(clave: string, valor: string) {
    const res = await fetch('/api/admin/configuracion', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, valor }),
    })
    if (!res.ok) throw new Error(`Error al guardar ${clave}`)
  }

  async function handleSave() {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await Promise.all([
        saveKey('sso_dominio', values.sso_dominio?.trim() ?? ''),
        saveKey('sso_google_habilitado', values.sso_google_habilitado ? 'true' : 'false'),
        saveKey('sso_microsoft_habilitado', values.sso_microsoft_habilitado ? 'true' : 'false'),
      ])
      message.success('Configuración guardada')
    } catch (err: any) {
      if (!err?.errorFields) message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <Title level={3} style={{ margin: 0, marginBottom: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
        Configuración SSO
      </Title>

      <Spin spinning={loading}>
      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" {...formProps}>
          <Form.Item
            label="Dominio institucional"
            name="sso_dominio"
            rules={[{ pattern: /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, message: 'Ingresá un dominio válido (ej: escuela.edu.ar)' }]}
            help="Dominio de email para auto-registro de empleados (ej: escuela.edu.ar). Los empleados que se registren con un email de este dominio serán asociados automáticamente a esta organización."
          >
            <Input placeholder="ejemplo.edu.ar" />
          </Form.Item>

          <Form.Item
            label="Login con Google"
            name="sso_google_habilitado"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 16, fontSize: 13 }}>
            Permite a los usuarios iniciar sesión con su cuenta de Google del dominio configurado.
          </Text>

          <Form.Item
            label="Login con Microsoft"
            name="sso_microsoft_habilitado"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Text type="secondary" style={{ display: 'block', marginTop: -16, marginBottom: 24, fontSize: 13 }}>
            Permite a los usuarios iniciar sesión con su cuenta de Microsoft (Entra ID) del dominio configurado.
          </Text>

          <Space>
            <Button type="primary" onClick={handleSave} loading={saving} disabled={hasErrors} style={{ fontWeight: 600 }}>
              Guardar
            </Button>
          </Space>
        </Form>
      </Card>
      </Spin>
    </div>
  )
}
