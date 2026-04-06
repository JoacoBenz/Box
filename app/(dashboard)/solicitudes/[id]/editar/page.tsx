'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Space,
  Upload,
  message,
  Typography,
  Spin,
  Alert,
} from 'antd'
import { PlusOutlined, MinusCircleOutlined, UploadOutlined } from '@ant-design/icons'
import Link from 'next/link'
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
      background: 'var(--total-estimated-bg)',
      borderRadius: 8,
      border: '1px solid var(--total-estimated-border)',
      display: 'flex',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontWeight: 600, color: 'var(--total-estimated-text)', fontSize: 15 }}>
        Total Estimado:
      </span>
      <span style={{ fontWeight: 700, color: 'var(--total-estimated-text)', fontSize: 17 }}>
        ${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  )
}

export default function EditarSolicitudPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [form] = Form.useForm<SolicitudFormValues>()
  const { hasErrors, formProps } = useFormValid(form)
  const [loading, setLoading] = useState<'guardar' | 'enviar' | null>(null)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState<string>('')
  const [selectedProveedor, setSelectedProveedor] = useState<any>(null)
  const [presupuestoFile, setPresupuestoFile] = useState<File | null>(null)
  const [centrosCosto, setCentrosCosto] = useState<{ id: number; nombre: string; codigo: string; area_id: number | null; area?: { nombre: string } | null }[]>([])
  const [sessionAreaId, setSessionAreaId] = useState<number | null>(null)
  const [esResponsable, setEsResponsable] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      setSessionAreaId(s?.user?.areaId ?? null)
      const roles: string[] = s?.user?.roles ?? []
      setEsResponsable(roles.includes('responsable_area'))
    }).catch(() => {})
    fetch('/api/centros-costo').then(r => r.ok ? r.json() : []).then(setCentrosCosto).catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/solicitudes/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar la solicitud')
        return r.json()
      })
      .then(data => {
        if (!['borrador', 'devuelta_resp', 'devuelta_dir'].includes(data.estado)) {
          setError('Esta solicitud no se puede editar en su estado actual')
          return
        }
        setEstado(data.estado)
        if (data.proveedor) setSelectedProveedor(data.proveedor)
        form.setFieldsValue({
          titulo: data.titulo,
          descripcion: data.descripcion,
          justificacion: data.justificacion,
          urgencia: data.urgencia,
          proveedor_id: data.proveedor_id ?? undefined,
          centro_costo_id: data.centro_costo_id ?? undefined,
          items: data.items_solicitud.map((item: any) => ({
            descripcion: item.descripcion,
            cantidad: Number(item.cantidad),
            unidad: item.unidad,
            precio_estimado: item.precio_estimado != null ? Number(item.precio_estimado) : undefined,
            link_producto: item.link_producto ?? undefined,
          })),
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setFetching(false))
  }, [id, form])

  async function handleSubmit(accion: 'guardar' | 'enviar') {
    try {
      const values = await form.validateFields()
      setLoading(accion)

      // First save edits via PATCH
      const patchRes = await fetch(`/api/solicitudes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!patchRes.ok) {
        const err = await patchRes.json()
        throw new Error(err?.error?.message ?? 'Error al guardar')
      }

      // Upload presupuesto file if provided
      if (presupuestoFile) {
        const formData = new FormData()
        formData.append('archivo', presupuestoFile)
        formData.append('entidad', 'solicitud')
        formData.append('entidad_id', id)
        await fetch('/api/archivos', { method: 'POST', body: formData })
      }

      // If sending, also call the enviar endpoint
      if (accion === 'enviar') {
        const enviarRes = await fetch(`/api/solicitudes/${id}/enviar`, { method: 'POST' })
        if (!enviarRes.ok) {
          const err = await enviarRes.json()
          throw new Error(err?.error?.message ?? 'Error al enviar')
        }
        message.success('Solicitud corregida y enviada')
      } else {
        message.success('Cambios guardados')
      }

      if (accion === 'enviar') await new Promise(r => setTimeout(r, 3500))
      router.push(`/solicitudes/${id}`)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setLoading(null)
    }
  }

  if (fetching) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <Alert type="error" title={error} showIcon />
      <Link href={`/solicitudes/${id}`}><Button style={{ marginTop: 16 }}>Volver</Button></Link>
    </div>
  )

  const isDevuelta = estado === 'devuelta_resp' || estado === 'devuelta_dir'

  return (
    <div className="page-content" style={{ padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
        Editar Solicitud
      </Title>

      {isDevuelta && (
        <Alert
          type="warning"
          title={estado === 'devuelta_resp'
            ? 'Esta solicitud fue devuelta por el Responsable de Área. Corregí lo indicado y volvé a enviar.'
            : 'Esta solicitud fue devuelta por Dirección. Corregí lo indicado y volvé a enviar.'}
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Form form={form} layout="vertical" style={{ display: 'flex', flexDirection: 'column', gap: 24 }} {...formProps}>
        <Card title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Información General</span>} style={{ borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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

        <Card title={<span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Items Solicitados</span>} style={{ borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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
                      border: '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: '20px 20px 12px',
                      marginBottom: 16,
                      background: 'var(--bg-input)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Ítem {index + 1}</strong>
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
            onClick={() => handleSubmit('guardar')}
            loading={loading === 'guardar'}
            disabled={loading === 'enviar' || hasErrors}
          >
            Guardar Cambios
          </Button>
          <AnimatedSubmitButton
            variant="send"
            onClick={() => handleSubmit('enviar')}
            disabled={loading === 'guardar' || hasErrors}
          >
            Guardar y Enviar
          </AnimatedSubmitButton>
          <Button size="large" onClick={() => router.push(`/solicitudes/${id}`)} disabled={!!loading}>
            Cancelar
          </Button>
        </div>
      </Form>
    </div>
  )
}
