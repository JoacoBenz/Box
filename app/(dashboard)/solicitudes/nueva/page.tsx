'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Space,
  Divider,
  message,
  Typography,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'

const { TextArea } = Input
const { Title } = Typography

interface ItemForm {
  descripcion: string
  cantidad: number
  unidad: string
  precio_estimado?: number
}

interface SolicitudFormValues {
  titulo: string
  descripcion: string
  justificacion: string
  urgencia: 'normal' | 'urgente' | 'critica'
  proveedor_sugerido?: string
  monto_estimado_total?: number
  items: ItemForm[]
}

export default function NuevaSolicitudPage() {
  const router = useRouter()
  const [form] = Form.useForm<SolicitudFormValues>()
  const [loading, setLoading] = useState<'borrador' | 'enviar' | null>(null)

  async function handleSubmit(accion: 'borrador' | 'enviar') {
    try {
      const values = await form.validateFields()
      setLoading(accion)

      const body = { ...values, accion }

      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al guardar la solicitud')
      }

      message.success(
        accion === 'borrador' ? 'Borrador guardado correctamente' : 'Solicitud enviada correctamente'
      )
      router.push('/solicitudes')
    } catch (err: any) {
      if (err?.errorFields) return // antd validation errors — already shown
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Title level={3} style={{ marginBottom: 24 }}>
        Nueva Solicitud de Compra
      </Title>

      <Form form={form} layout="vertical" initialValues={{ urgencia: 'normal', items: [{ unidad: 'unidades', cantidad: 1 }] }}>
        <Card title="Información General" style={{ marginBottom: 24 }}>
          <Form.Item
            label="Título"
            name="titulo"
            rules={[{ required: true, message: 'El título es obligatorio' }]}
          >
            <Input placeholder="Ej: Resmas de papel A4 para impresoras" maxLength={200} showCount />
          </Form.Item>

          <Form.Item
            label="Descripción"
            name="descripcion"
            rules={[{ required: true, message: 'La descripción es obligatoria' }]}
          >
            <TextArea rows={3} placeholder="Descripción detallada de la solicitud" maxLength={1000} showCount />
          </Form.Item>

          <Form.Item
            label="Justificación"
            name="justificacion"
            rules={[{ required: true, message: 'La justificación es obligatoria' }]}
          >
            <TextArea rows={3} placeholder="¿Por qué se necesita esta compra?" maxLength={1000} showCount />
          </Form.Item>

          <Form.Item
            label="Urgencia"
            name="urgencia"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'urgente', label: 'Urgente' },
                { value: 'critica', label: 'Crítica' },
              ]}
              style={{ width: 200 }}
            />
          </Form.Item>

          <Form.Item label="Proveedor Sugerido (opcional)" name="proveedor_sugerido">
            <Input placeholder="Nombre del proveedor" maxLength={200} />
          </Form.Item>

          <Form.Item label="Monto Estimado Total (opcional)" name="monto_estimado_total">
            <InputNumber
              min={0}
              precision={2}
              prefix="$"
              style={{ width: 200 }}
              placeholder="0.00"
            />
          </Form.Item>
        </Card>

        <Card title="Items Solicitados" style={{ marginBottom: 24 }}>
          <Form.List
            name="items"
            rules={[
              {
                validator: async (_, items) => {
                  if (!items || items.length === 0) {
                    return Promise.reject(new Error('Debe agregar al menos un ítem'))
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <div
                    key={key}
                    style={{
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: 16,
                      marginBottom: 12,
                      background: '#fafafa',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong style={{ color: '#666' }}>Ítem {index + 1}</strong>
                      {fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                          size="small"
                        >
                          Quitar
                        </Button>
                      )}
                    </div>

                    <Form.Item
                      {...restField}
                      label="Descripción"
                      name={[name, 'descripcion']}
                      rules={[{ required: true, message: 'Descripción requerida' }]}
                    >
                      <Input placeholder="Descripción del ítem" />
                    </Form.Item>

                    <Space style={{ width: '100%' }} size={16} wrap>
                      <Form.Item
                        {...restField}
                        label="Cantidad"
                        name={[name, 'cantidad']}
                        rules={[{ required: true, message: 'Cantidad requerida' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={1} precision={0} style={{ width: 120 }} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        label="Unidad"
                        name={[name, 'unidad']}
                        rules={[{ required: true, message: 'Unidad requerida' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input style={{ width: 140 }} placeholder="unidades" />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        label="Precio Estimado (opcional)"
                        name={[name, 'precio_estimado']}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0} precision={2} prefix="$" style={{ width: 160 }} placeholder="0.00" />
                      </Form.Item>
                    </Space>
                  </div>
                ))}

                <Form.ErrorList errors={errors} />

                <Button
                  type="dashed"
                  onClick={() => add({ unidad: 'unidades', cantidad: 1 })}
                  icon={<PlusOutlined />}
                  block
                  style={{ marginTop: 8 }}
                >
                  Agregar Ítem
                </Button>
              </>
            )}
          </Form.List>
        </Card>

        <Space>
          <Button
            size="large"
            onClick={() => handleSubmit('borrador')}
            loading={loading === 'borrador'}
            disabled={loading === 'enviar'}
          >
            Guardar Borrador
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={() => handleSubmit('enviar')}
            loading={loading === 'enviar'}
            disabled={loading === 'borrador'}
          >
            Enviar Solicitud
          </Button>
          <Button size="large" onClick={() => router.push('/solicitudes')} disabled={!!loading}>
            Cancelar
          </Button>
        </Space>
      </Form>
    </div>
  )
}
