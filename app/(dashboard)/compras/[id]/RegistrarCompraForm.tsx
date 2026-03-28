'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  DatePicker,
  Upload,
  Space,
  message,
  Divider,
  Typography,
  Card,
  Descriptions,
  Tag,
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload'
import type { Dayjs } from 'dayjs'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'

const { TextArea } = Input
const { Title } = Typography

interface SolicitudSummary {
  id: number
  numero: string
  titulo: string
  estado: string
  urgencia: string
  monto_estimado_total: number | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

interface Props {
  solicitud: SolicitudSummary
}

interface FormValues {
  proveedor_nombre: string
  proveedor_detalle?: string
  fecha_compra?: Dayjs
  monto_total: number
  medio_pago: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro'
  referencia_bancaria?: string
  numero_factura?: string
  observaciones?: string
}

export default function RegistrarCompraForm({ solicitud }: Props) {
  const router = useRouter()
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const medioPago = Form.useWatch('medio_pago', form)

  const estadoInfo = ESTADOS_SOLICITUD[solicitud.estado as EstadoSolicitud]
  const urgenciaInfo = URGENCIAS[solicitud.urgencia as UrgenciaSolicitud]

  async function handleSubmit() {
    try {
      const values = await form.validateFields()

      if (fileList.length === 0) {
        message.error('Debe adjuntar el comprobante de compra')
        return
      }

      setLoading(true)

      const formData = new FormData()
      formData.append('solicitud_id', String(solicitud.id))
      formData.append('proveedor_nombre', values.proveedor_nombre)
      if (values.proveedor_detalle) formData.append('proveedor_detalle', values.proveedor_detalle)
      if (values.fecha_compra) formData.append('fecha_compra', values.fecha_compra.toISOString())
      formData.append('monto_total', String(values.monto_total))
      formData.append('medio_pago', values.medio_pago)
      if (values.referencia_bancaria) formData.append('referencia_bancaria', values.referencia_bancaria)
      if (values.numero_factura) formData.append('numero_factura', values.numero_factura)
      if (values.observaciones) formData.append('observaciones', values.observaciones)

      const file = fileList[0]?.originFileObj
      if (file) formData.append('comprobante', file)

      const res = await fetch('/api/compras', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error?.message ?? 'Error al registrar la compra')
      }

      message.success('Compra registrada correctamente')
      router.push('/compras')
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 860 }}>
      <div style={{ marginBottom: 16, fontSize: 13, color: '#888' }}>
        <a onClick={() => router.push('/compras')} style={{ color: '#1677ff', cursor: 'pointer' }}>
          ← Volver a Compras
        </a>
      </div>

      <Title level={3} style={{ marginBottom: 24 }}>
        Registrar Compra
      </Title>

      {/* Solicitud summary */}
      <Card title="Solicitud" style={{ marginBottom: 24 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Número">{solicitud.numero}</Descriptions.Item>
          <Descriptions.Item label="Título">{solicitud.titulo}</Descriptions.Item>
          <Descriptions.Item label="Área">{solicitud.area?.nombre ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Solicitante">{solicitud.solicitante.nombre}</Descriptions.Item>
          <Descriptions.Item label="Estado">
            {estadoInfo && <Tag color={estadoInfo.color}>{estadoInfo.label}</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Urgencia">
            {urgenciaInfo && <Tag color={urgenciaInfo.color}>{urgenciaInfo.label}</Tag>}
          </Descriptions.Item>
          {solicitud.monto_estimado_total != null && (
            <Descriptions.Item label="Monto Estimado">
              ${Number(solicitud.monto_estimado_total).toFixed(2)}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Purchase form */}
      <Card title="Datos de la Compra">
        <Form form={form} layout="vertical">
          <Form.Item
            label="Proveedor"
            name="proveedor_nombre"
            rules={[{ required: true, message: 'El proveedor es obligatorio' }]}
          >
            <Input placeholder="Nombre del proveedor" maxLength={200} />
          </Form.Item>

          <Form.Item label="Detalle del Proveedor (opcional)" name="proveedor_detalle">
            <TextArea rows={2} placeholder="CUIT, dirección, teléfono, etc." maxLength={500} />
          </Form.Item>

          <Space style={{ width: '100%' }} size={24} wrap>
            <Form.Item
              label="Fecha de Compra"
              name="fecha_compra"
              rules={[{ required: true, message: 'La fecha es obligatoria' }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} />
            </Form.Item>

            <Form.Item
              label="Monto Total"
              name="monto_total"
              rules={[{ required: true, message: 'El monto es obligatorio' }]}
            >
              <InputNumber min={0} precision={2} prefix="$" style={{ width: 180 }} placeholder="0.00" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={24} wrap>
            <Form.Item
              label="Medio de Pago"
              name="medio_pago"
              rules={[{ required: true, message: 'El medio de pago es obligatorio' }]}
            >
              <Select
                style={{ width: 180 }}
                options={[
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'transferencia', label: 'Transferencia' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'tarjeta', label: 'Tarjeta' },
                  { value: 'otro', label: 'Otro' },
                ]}
                placeholder="Seleccionar"
              />
            </Form.Item>

            {(medioPago === 'transferencia' || medioPago === 'cheque') && (
              <Form.Item
                label="Referencia Bancaria"
                name="referencia_bancaria"
                rules={[{ required: true, message: 'La referencia bancaria es obligatoria para este medio de pago' }]}
              >
                <Input placeholder="N° de transferencia / cheque" style={{ width: 220 }} />
              </Form.Item>
            )}
          </Space>

          <Form.Item label="Número de Factura (opcional)" name="numero_factura">
            <Input placeholder="Ej: A-0001-00012345" style={{ width: 240 }} />
          </Form.Item>

          <Form.Item label="Observaciones (opcional)" name="observaciones">
            <TextArea rows={3} placeholder="Notas adicionales sobre la compra" maxLength={1000} showCount />
          </Form.Item>

          <Form.Item
            label="Comprobante (PDF, JPG o PNG — máx. 10 MB)"
            required
          >
            <Upload
              beforeUpload={(file) => {
                const isValidType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
                const isValidSize = file.size / 1024 / 1024 < 10
                if (!isValidType) {
                  message.error('Solo se aceptan archivos PDF, JPG o PNG')
                  return Upload.LIST_IGNORE
                }
                if (!isValidSize) {
                  message.error('El archivo no debe superar 10 MB')
                  return Upload.LIST_IGNORE
                }
                return false // prevent auto-upload
              }}
              fileList={fileList}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
            </Upload>
          </Form.Item>

          <Divider />

          <Space>
            <Button
              type="primary"
              size="large"
              onClick={handleSubmit}
              loading={loading}
            >
              Registrar Compra
            </Button>
            <Button size="large" onClick={() => router.push('/compras')} disabled={loading}>
              Cancelar
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
