'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  App,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Space,
  Divider,
  Typography,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons'
import AnimatedSubmitButton from '@/components/AnimatedSubmitButton'
import ProveedorSelect from '@/components/ProveedorSelect'
import ProveedorInfoCard from '@/components/ProveedorInfoCard'

const { TextArea } = Input
const { Title } = Typography

interface ItemForm {
  descripcion: string
  cantidad: number
  unidad: string
  precio_estimado?: number
  link_producto?: string
}

interface SolicitudFormValues {
  titulo: string
  descripcion: string
  justificacion: string
  urgencia: 'normal' | 'urgente' | 'critica'
  proveedor_id?: number | null
  centro_costo_id?: number | null
  monto_estimado_total?: number
  items: ItemForm[]
}

export default function NuevaSolicitudPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const [form] = Form.useForm<SolicitudFormValues>()
  const [loading, setLoading] = useState<'borrador' | 'enviar' | null>(null)
  const [selectedProveedor, setSelectedProveedor] = useState<any>(null)
  const [centrosCosto, setCentrosCosto] = useState<{ id: number; nombre: string; codigo: string }[]>([])
  useEffect(() => {
    fetch('/api/centros-costo').then(r => r.ok ? r.json() : []).then(setCentrosCosto).catch(() => {})
  }, [])

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
      // Let the animated button finish before navigating
      if (accion === 'enviar') await new Promise(r => setTimeout(r, 3500))
      router.push('/solicitudes')
    } catch (err: any) {
      if (err?.errorFields) return // antd validation errors — already shown
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="page-content" style={{ padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 32, fontWeight: 700 }}>
        Nueva Solicitud de Compra
      </Title>

      <Form form={form} layout="vertical" initialValues={{ urgencia: 'normal', items: [{ unidad: 'unidades', cantidad: 1 }] }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card title={<span style={{ fontWeight: 600, fontSize: 15 }}>Información General</span>} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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

          <Form.Item label="Proveedor (opcional)" name="proveedor_id">
            <ProveedorSelect
              onChange={(id, prov) => {
                form.setFieldValue('proveedor_id', id)
                setSelectedProveedor(prov ? { ...prov, id } : null)
                // Fetch full proveedor details if selected
                if (id) {
                  fetch(`/api/proveedores/${id}`).then(r => r.json()).then(setSelectedProveedor).catch(() => {})
                }
              }}
            />
          </Form.Item>

          {selectedProveedor && selectedProveedor.id && (
            <ProveedorInfoCard proveedor={selectedProveedor} style={{ marginBottom: 16 }} />
          )}

          <Form.Item label="Monto Estimado Total (opcional)" name="monto_estimado_total">
            <InputNumber
              min={0}
              precision={2}
              prefix="$"
              style={{ width: 200 }}
              placeholder="0.00"
            />
          </Form.Item>

          {centrosCosto.length > 0 && (
            <Form.Item label="Centro de Costo (opcional)" name="centro_costo_id">
              <Select
                allowClear
                placeholder="Seleccionar centro de costo"
                style={{ width: 300 }}
                options={centrosCosto.map(c => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` }))}
              />
            </Form.Item>
          )}
        </Card>

        <Card title={<span style={{ fontWeight: 600, fontSize: 15 }}>Items Solicitados</span>} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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
                      border: '1px solid #e8e8e8',
                      borderRadius: 10,
                      padding: '20px 20px 12px',
                      marginBottom: 16,
                      background: '#fafbfc',
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

                    <Form.Item
                      {...restField}
                      label="Link del producto (opcional)"
                      name={[name, 'link_producto']}
                      style={{ marginTop: 12, marginBottom: 0 }}
                    >
                      <Input placeholder="https://pagina.com/producto" maxLength={500} />
                    </Form.Item>
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

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 8 }}>
          <Button
            size="large"
            onClick={() => handleSubmit('borrador')}
            loading={loading === 'borrador'}
            disabled={loading === 'enviar'}
          >
            Guardar Borrador
          </Button>
          <AnimatedSubmitButton
            variant="send"
            onClick={() => handleSubmit('enviar')}
            disabled={loading === 'borrador'}
          >
            Enviar Solicitud
          </AnimatedSubmitButton>
          <Button size="large" onClick={() => router.push('/solicitudes')} disabled={!!loading}>
            Cancelar
          </Button>
        </div>
      </Form>
    </div>
  )
}
