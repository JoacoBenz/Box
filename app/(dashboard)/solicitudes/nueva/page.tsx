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
  Upload,
  Alert,
  Typography,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons'
import AnimatedSubmitButton from '@/components/AnimatedSubmitButton'
import { useFormValid } from '@/hooks/useFormValid'
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
  items: ItemForm[]
}

function TotalItems({ form }: { form: ReturnType<typeof Form.useForm<any>>[0] }) {
  const items = Form.useWatch('items', form) as ItemForm[] | undefined
  const total = (items ?? []).reduce((acc, item) => {
    if (item?.precio_estimado && item?.cantidad) {
      return acc + Number(item.precio_estimado) * Number(item.cantidad)
    }
    return acc
  }, 0)

  if (total <= 0) return null

  return (
    <div style={{
      marginTop: 16,
      padding: '12px 16px',
      background: '#f0fdf4',
      borderRadius: 8,
      border: '1px solid #bbf7d0',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontWeight: 600, color: '#15803d', fontSize: 15 }}>
        Total Estimado:
      </span>
      <span style={{ fontWeight: 700, color: '#15803d', fontSize: 17 }}>
        ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  )
}

export default function NuevaSolicitudPage() {
  const { message } = App.useApp()
  const router = useRouter()
  const [form] = Form.useForm<SolicitudFormValues>()
  const { hasErrors, formProps } = useFormValid(form)
  const [loading, setLoading] = useState<'borrador' | 'enviar' | null>(null)
  const [selectedProveedor, setSelectedProveedor] = useState<any>(null)
  const [presupuestoFile, setPresupuestoFile] = useState<File | null>(null)
  const [centrosCosto, setCentrosCosto] = useState<{ id: number; nombre: string; codigo: string; area_id: number | null; area?: { nombre: string } | null }[]>([])
  const [sessionAreaId, setSessionAreaId] = useState<number | null>(null)
  const [esResponsable, setEsResponsable] = useState(false)
  useEffect(() => {
    // Fetch session to get user's area and default centro_costo
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      const areaId = s?.user?.areaId ?? null
      const ccId = s?.user?.centroCostoId ?? null
      const roles: string[] = s?.user?.roles ?? []
      setSessionAreaId(areaId)
      setEsResponsable(roles.includes('responsable_area'))
      if (ccId) form.setFieldValue('centro_costo_id', ccId)
    }).catch(() => {})
    fetch('/api/centros-costo').then(r => r.ok ? r.json() : []).then(setCentrosCosto).catch(() => {})
  }, [form])

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

      const solicitud = await res.json()

      // Upload presupuesto file if provided
      if (presupuestoFile) {
        const formData = new FormData()
        formData.append('archivo', presupuestoFile)
        formData.append('entidad', 'solicitud')
        formData.append('entidad_id', String(solicitud.id))
        await fetch('/api/archivos', { method: 'POST', body: formData })
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
      <Title level={3} style={{ marginBottom: 24, fontWeight: 700, color: '#1e293b' }}>
        Nueva Solicitud de Compra
      </Title>

      <Form form={form} layout="vertical" initialValues={{ urgencia: 'normal', items: [{ unidad: 'unidades', cantidad: 1 }] }} style={{ display: 'flex', flexDirection: 'column', gap: 24 }} {...formProps}>
        <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Información General</span>} style={{ borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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
            rules={[{ required: true, message: 'Seleccioná la urgencia' }]}
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

          <Form.Item label="Proveedor" name="proveedor_id">
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

          <Form.Item label="Presupuesto (opcional)">
            <Upload
              beforeUpload={(file) => { setPresupuestoFile(file); return false }}
              onRemove={() => setPresupuestoFile(null)}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              fileList={presupuestoFile ? [{ uid: '-1', name: presupuestoFile.name, status: 'done' as const }] : []}
            >
              <Button icon={<UploadOutlined />}>Adjuntar presupuesto</Button>
            </Upload>
          </Form.Item>

          {(() => {
            const filtered = centrosCosto.filter(cc => cc.area_id === sessionAreaId)
            return filtered.length > 0 ? (
              <Form.Item label="Centro de Costo" name="centro_costo_id">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Seleccionar centro de costo"
                  style={{ width: '100%' }}
                  options={filtered.map(c => ({
                    value: c.id,
                    label: `${c.codigo} — ${c.nombre}`,
                  }))}
                />
              </Form.Item>
            ) : null
          })()}
        </Card>

        <Card title={<span style={{ fontWeight: 700, color: '#1e293b' }}>Items Solicitados</span>} style={{ borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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
                        label="Precio Estimado"
                        name={[name, 'precio_estimado']}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0} precision={2} prefix="$" style={{ width: 160 }} placeholder="0.00" />
                      </Form.Item>
                    </Space>

                    <Form.Item
                      {...restField}
                      label="Link del producto"
                      name={[name, 'link_producto']}
                      rules={[{ type: 'url', message: 'Ingresá una URL válida (ej: https://...)' }]}
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

          <TotalItems form={form} />
        </Card>

        {esResponsable && (
          <Alert
            type="warning"
            showIcon
            title="Como responsable de área, esta solicitud irá directamente a Dirección para aprobación. Asegurate de que todos los datos sean correctos."
            style={{ borderRadius: 10 }}
          />
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 8 }}>
          <Button
            size="large"
            onClick={() => handleSubmit('borrador')}
            loading={loading === 'borrador'}
            disabled={loading === 'enviar' || hasErrors}
          >
            Guardar Borrador
          </Button>
          <AnimatedSubmitButton
            variant="send"
            onClick={() => handleSubmit('enviar')}
            disabled={loading === 'borrador' || hasErrors}
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
