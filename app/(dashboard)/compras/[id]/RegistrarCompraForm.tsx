'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  App,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  DatePicker,
  Upload,
  Space,
  Divider,
  Typography,
  Card,
  Descriptions,
  Tag,
  Modal,
  Alert,
} from 'antd'
import { UploadOutlined, WarningOutlined } from '@ant-design/icons'
import AnimatedSubmitButton from '@/components/AnimatedSubmitButton'
import { useFormValid } from '@/hooks/useFormValid'
import ProveedorInfoCard from '@/components/ProveedorInfoCard'
import { useTheme } from '@/components/ThemeProvider'
import type { UploadFile } from 'antd/es/upload'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'

const { TextArea } = Input
const { Title } = Typography

interface ProveedorData {
  id: number
  nombre: string
  cuit?: string | null
  datos_bancarios?: string | null
  link_pagina?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
}

interface SolicitudSummary {
  id: number
  numero: string
  titulo: string
  estado: string
  urgencia: string
  items_solicitud?: Array<{ cantidad: number; precio_estimado: number | null }>
  area: { nombre: string } | null
  solicitante: { nombre: string }
  proveedor?: ProveedorData | null
  proveedor_id?: number | null
  dia_pago_programado?: string | null
}

interface Archivo {
  id: number
  nombre_archivo: string
  tamanio_bytes: number | null
}

interface Props {
  solicitud: SolicitudSummary
  archivos?: Archivo[]
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

export default function RegistrarCompraForm({ solicitud, archivos = [] }: Props) {
  const { message } = App.useApp()
  const { tokens } = useTheme()
  const router = useRouter()
  const [form] = Form.useForm<FormValues>()
  const [loading, setLoading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const { hasErrors, formProps } = useFormValid(form)
  const medioPago = Form.useWatch('medio_pago', form)

  const [proveedorData, setProveedorData] = useState<ProveedorData | null | undefined>(solicitud.proveedor)
  const [editBancariosOpen, setEditBancariosOpen] = useState(false)
  const [savingBancarios, setSavingBancarios] = useState(false)
  const [bancariosForm] = Form.useForm()

  const prov = proveedorData
  const pagoDate = solicitud.dia_pago_programado ? dayjs(solicitud.dia_pago_programado) : null
  const canSubmit = !pagoDate || !pagoDate.startOf('day').isAfter(dayjs().startOf('day'))
  const necesitaDatosBancarios = (medioPago === 'transferencia' || medioPago === 'cheque') && prov && !prov.datos_bancarios

  // Auto-fill proveedor fields from solicitud's proveedor
  useEffect(() => {
    if (prov) {
      const detalle = [prov.cuit && `CUIT: ${prov.cuit}`, prov.datos_bancarios, prov.direccion && `Dir: ${prov.direccion}`, prov.telefono && `Tel: ${prov.telefono}`].filter(Boolean).join('\n')
      form.setFieldsValue({
        proveedor_nombre: prov.nombre,
        proveedor_detalle: detalle || undefined,
      })
    }
  }, [prov, form])

  const estadoInfo = ESTADOS_SOLICITUD[solicitud.estado as EstadoSolicitud]
  const urgenciaInfo = URGENCIAS[solicitud.urgencia as UrgenciaSolicitud]

  async function handleSubmit() {
    try {
      const values = await form.validateFields()

      if (fileList.length === 0) {
        message.error('Debe adjuntar el comprobante de compra')
        return
      }

      if ((values.medio_pago === 'transferencia' || values.medio_pago === 'cheque') && prov && !prov.datos_bancarios) {
        message.error('Debe cargar los datos bancarios del proveedor antes de registrar un pago por transferencia/cheque')
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
      await new Promise(r => setTimeout(r, 3500))
      router.push('/compras')
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  function openEditBancarios() {
    bancariosForm.setFieldsValue({
      datos_bancarios: prov?.datos_bancarios ?? '',
    })
    setEditBancariosOpen(true)
  }

  async function handleSaveBancarios() {
    if (!prov) return
    try {
      const values = await bancariosForm.validateFields()
      setSavingBancarios(true)
      const res = await fetch(`/api/proveedores/${prov.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datos_bancarios: values.datos_bancarios || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err?.error ?? 'Error al guardar')
      }
      const updated = await res.json()
      setProveedorData((prev) => prev ? { ...prev, datos_bancarios: updated.datos_bancarios ?? values.datos_bancarios } : prev)
      // Also update the proveedor_detalle form field
      const detalle = [prov.cuit && `CUIT: ${prov.cuit}`, values.datos_bancarios, prov.direccion && `Dir: ${prov.direccion}`, prov.telefono && `Tel: ${prov.telefono}`].filter(Boolean).join('\n')
      form.setFieldsValue({ proveedor_detalle: detalle || undefined })
      message.success('Datos bancarios actualizados')
      setEditBancariosOpen(false)
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err?.message ?? 'Error inesperado')
    } finally {
      setSavingBancarios(false)
    }
  }

  return (
    <div className="page-content" style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <a onClick={() => router.push('/compras')} style={{ color: tokens.colorPrimary, fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>
          ← Volver a Compras
        </a>
      </div>

      <Title level={3} style={{ marginBottom: 24, fontWeight: 700, color: tokens.textPrimary }}>
        Registrar Compra
      </Title>

      {/* Solicitud summary */}
      <Card title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Solicitud</span>} style={{ marginBottom: 24, borderRadius: 16 }}>
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
          {pagoDate && (
            <Descriptions.Item label="Fecha de Pago Programado">
              <Tag color={canSubmit ? 'green' : 'orange'}>
                {pagoDate.format('DD/MM/YYYY')}
              </Tag>
              {!canSubmit && <span style={{ color: 'var(--color-observation)', fontSize: 12, marginLeft: 8 }}>Aún no habilitado</span>}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* Proveedor info from solicitud */}
      {prov && (
        <ProveedorInfoCard proveedor={prov} style={{ marginBottom: 24 }} editable onEditBancarios={openEditBancarios} />
      )}

      {/* Modal editar datos bancarios */}
      <Modal
        title="Editar Datos Bancarios"
        open={editBancariosOpen}
        onCancel={() => setEditBancariosOpen(false)}
        onOk={handleSaveBancarios}
        confirmLoading={savingBancarios}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={bancariosForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="Datos Bancarios (CBU / Alias / Banco)"
            name="datos_bancarios"
            rules={[{ max: 500, message: 'Máximo 500 caracteres' }]}
          >
            <Input.TextArea rows={4} placeholder="CBU: 0000000000000000000000&#10;Alias: mi-alias&#10;Banco: Banco Nación" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Archivos adjuntos */}
      {archivos.length > 0 && (
        <Card size="small" title={<span style={{ fontWeight: 600, color: tokens.textPrimary }}>Presupuesto / Archivos</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
          {archivos.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ fontSize: 13, color: tokens.textSecondary }}>{a.nombre_archivo}</span>
              <a href={`/api/archivos/${a.id}`} target="_blank" rel="noopener noreferrer" style={{ color: tokens.colorPrimary, fontWeight: 600, fontSize: 13 }}>Descargar</a>
            </div>
          ))}
        </Card>
      )}

      {/* Purchase form */}
      <Card title={<span style={{ fontWeight: 700, color: tokens.textPrimary }}>Datos de la Compra</span>} style={{ borderRadius: 16 }}>
        <Form form={form} layout="vertical" {...formProps}>
          <Form.Item
            label="Proveedor"
            name="proveedor_nombre"
            rules={[
              { required: true, message: 'El proveedor es obligatorio' },
              { min: 2, message: 'Mínimo 2 caracteres' },
              { whitespace: true, message: 'El nombre no puede estar vacío' },
            ]}
          >
            <Input placeholder="Nombre del proveedor" maxLength={255} readOnly={!!prov} disabled={!!prov} />
          </Form.Item>

          <Form.Item label="Detalle del Proveedor" name="proveedor_detalle">
            <TextArea rows={2} placeholder="CUIT, dirección, teléfono, etc." maxLength={500} readOnly={!!prov} disabled={!!prov} />
          </Form.Item>

          <Space style={{ width: '100%' }} size={24} wrap>
            <Form.Item
              label="Fecha de Compra"
              name="fecha_compra"
              rules={[
                { required: true, message: 'La fecha es obligatoria' },
                {
                  validator: (_, value: Dayjs | null) => {
                    if (!value) return Promise.resolve();
                    if (value.isAfter(dayjs(), 'day'))
                      return Promise.reject('La fecha no puede ser futura');
                    if (value.isBefore(dayjs().subtract(5, 'year'), 'day'))
                      return Promise.reject('La fecha es demasiado antigua');
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: 180 }} disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
            </Form.Item>

            <Form.Item
              label="Monto Total"
              name="monto_total"
              rules={[
                { required: true, message: 'El monto es obligatorio' },
                { type: 'number', min: 0.01, message: 'El monto debe ser mayor a 0' },
                { type: 'number', max: 999_999_999, message: 'Monto excesivo' },
                ...(() => {
                  const totalEstimado = (solicitud.items_solicitud ?? []).reduce((acc, item) => acc + Number(item.cantidad) * Number(item.precio_estimado ?? 0), 0);
                  return totalEstimado > 0
                    ? [{
                        validator: (_: any, value: number) => {
                          if (!value) return Promise.resolve();
                          if (value > totalEstimado * 3)
                            return Promise.reject(`El monto ($${value.toFixed(2)}) supera 3x el estimado ($${totalEstimado.toFixed(2)}). Verificá si es correcto.`);
                          return Promise.resolve();
                        },
                      }]
                    : [];
                })(),
              ]}
            >
              <InputNumber min={0.01} precision={2} prefix="$" style={{ width: 180 }} placeholder="0.00" />
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

          {necesitaDatosBancarios && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 16 }}
              message="Datos bancarios requeridos"
              description={
                <span>
                  El proveedor <strong>{prov?.nombre}</strong> no tiene datos bancarios cargados.
                  Debe cargarlos antes de registrar el pago por {medioPago}.{' '}
                  <a onClick={openEditBancarios} style={{ fontWeight: 600 }}>Cargar datos bancarios</a>
                </span>
              }
            />
          )}

          <Form.Item
            label="Número de Factura"
            name="numero_factura"
            rules={[
              {
                pattern: /^[A-Z]-\d{4}-\d{8}$/,
                message: 'Formato inválido. Usá: A-0001-00012345',
              },
            ]}
            extra="Formato: A-0001-00012345"
          >
            <Input
              placeholder="A-0001-00012345"
              style={{ width: 240 }}
              maxLength={16}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                let formatted = ''
                for (let i = 0; i < raw.length && formatted.length < 16; i++) {
                  const c = raw[i]
                  if (formatted.length === 0) {
                    // First char: letter only
                    if (/[A-Z]/.test(c)) formatted += c
                  } else if (formatted.length === 1) {
                    // Auto-insert dash after letter
                    if (/\d/.test(c)) formatted += '-' + c
                  } else if (formatted.length >= 2 && formatted.length < 6) {
                    // 4 digits for punto de venta
                    if (/\d/.test(c)) formatted += c
                  } else if (formatted.length === 6) {
                    // Auto-insert dash after punto de venta
                    if (/\d/.test(c)) formatted += '-' + c
                  } else if (formatted.length >= 7 && formatted.length < 16) {
                    // 8 digits for número
                    if (/\d/.test(c)) formatted += c
                  }
                }
                form.setFieldValue('numero_factura', formatted)
              }}
            />
          </Form.Item>

          <Form.Item label="Observaciones" name="observaciones">
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

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <AnimatedSubmitButton
              variant="send"
              onClick={handleSubmit}
              disabled={loading || !canSubmit || hasErrors || !!necesitaDatosBancarios}
            >
              {canSubmit ? 'Registrar Pago' : `Habilitado el ${pagoDate?.format('DD/MM/YYYY') ?? ''}`}
            </AnimatedSubmitButton>
            <Button size="large" onClick={() => router.push('/compras')} disabled={loading}>
              Cancelar
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
