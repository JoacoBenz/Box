'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Space, Modal, Form, Input, Radio, Select, Typography, Tag, DatePicker, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import Link from 'next/link'
import AnimatedSubmitButton from '@/components/AnimatedSubmitButton'

const { TextArea } = Input

interface Props {
  solicitudId: number
  estado: string
  solicitanteId: number
  solicitudAreaId: number | null
  sessionUserId: number
  sessionRoles: string[]
  sessionAreaId: number | null
  isAreaResponsable: boolean
  skipValidacion?: boolean
  updatedAt?: string
}

export default function SolicitudActionButtons({
  solicitudId,
  estado,
  solicitanteId,
  solicitudAreaId,
  sessionUserId,
  sessionRoles,
  sessionAreaId,
  isAreaResponsable,
  skipValidacion = false,
  updatedAt,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [devolverOpen, setDevolverOpen] = useState(false)
  const [devolverForm] = Form.useForm<{ motivo: string }>()

  const [rechazarOpen, setRechazarOpen] = useState(false)
  const [rechazarForm] = Form.useForm<{ motivo: string }>()

  const [recepcionOpen, setRecepcionOpen] = useState(false)
  const [recepcionForm] = Form.useForm<{ conforme: 'si' | 'no'; tipo_problema?: string; observaciones?: string }>()

  const [procesarOpen, setProcesarOpen] = useState(false)
  const [procesarForm] = Form.useForm<{ prioridad_compra: string; observaciones?: string }>()

  const [programarOpen, setProgramarOpen] = useState(false)
  const [programarForm] = Form.useForm<{ dia_pago_programado: any }>()

  const roles = sessionRoles
  const isOwner = solicitanteId === sessionUserId
  const isSolicitante = roles.includes('solicitante')
  const isResponsable = roles.includes('responsable_area')
  const isDirector = roles.includes('director')
  const isTesoreria = roles.includes('tesoreria')
  const isCompras = roles.includes('compras')
  const isAdmin = roles.includes('admin')
  const isSameArea = isAdmin || (solicitudAreaId != null && sessionAreaId === solicitudAreaId)

  // Button visibility must match backend role checks exactly to avoid 403s
  const canEditar = isSolicitante && isOwner && ['borrador', 'devuelta_resp', 'devuelta_dir'].includes(estado)
  const canEnviar = isSolicitante && isOwner && ['borrador', 'devuelta_resp', 'devuelta_dir'].includes(estado)
  const canValidar = isResponsable && isAreaResponsable && ['enviada', 'devuelta_dir'].includes(estado)
  const canDevolver = (isResponsable && isAreaResponsable && estado === 'enviada') || (isDirector && estado === 'validada')
  const canAprobar = isDirector && (estado === 'validada' || (skipValidacion && estado === 'enviada'))
  const canRechazar = isDirector && (estado === 'validada' || (skipValidacion && estado === 'enviada'))
  const canProcesarCompras = isCompras && ['aprobada', 'en_compras'].includes(estado)
  const canProgramarPago = isCompras && estado === 'en_compras'
  const canRegistrarCompra = (isTesoreria || isCompras) && ['aprobada', 'pago_programado', 'en_compras'].includes(estado)
  const canConfirmarRecepcion = ((isSolicitante && isOwner) || (isResponsable && isAreaResponsable)) && estado === 'comprada'
  const canCerrar = (isTesoreria || isAdmin) && estado === 'recibida_con_obs'
  const isCerrada = estado === 'cerrada'

  const hasAnyAction =
    canEditar || canEnviar || canValidar || canDevolver || canAprobar ||
    canRechazar || canProcesarCompras || canProgramarPago || canRegistrarCompra || canConfirmarRecepcion || canCerrar || isCerrada

  async function postAction(path: string, body?: Record<string, unknown>) {
    setLoading(true)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        Modal.error({ title: 'Error', content: data?.error?.message ?? `Error ${res.status}` })
      } else {
        router.refresh()
      }
    } catch {
      Modal.error({ title: 'Error', content: 'Error de red. Intente nuevamente.' })
    } finally {
      setLoading(false)
    }
  }

  async function handleEnviar() {
    await postAction(`/api/solicitudes/${solicitudId}/enviar`, { updated_at: updatedAt })
  }

  async function handleValidar() {
    await postAction(`/api/solicitudes/${solicitudId}/validar`, { updated_at: updatedAt })
  }

  async function handleDevolver(values: { motivo: string }) {
    // Determine origen from the current state, not the role (a user may have both roles)
    const origen = estado === 'validada' ? 'director' : 'responsable'
    await postAction(`/api/solicitudes/${solicitudId}/devolver`, { observaciones: values.motivo, origen, updated_at: updatedAt })
    setDevolverOpen(false)
    devolverForm.resetFields()
  }

  async function handleAprobar() {
    await postAction(`/api/solicitudes/${solicitudId}/aprobar`, { updated_at: updatedAt })
  }

  async function handleRechazar(values: { motivo: string }) {
    await postAction(`/api/solicitudes/${solicitudId}/rechazar`, { motivo: values.motivo, updated_at: updatedAt })
    setRechazarOpen(false)
    rechazarForm.resetFields()
  }

  async function handleProcesarCompras(values: { prioridad_compra: string; observaciones?: string }) {
    await postAction(`/api/solicitudes/${solicitudId}/procesar-compras`, { ...values, updated_at: updatedAt })
    setProcesarOpen(false)
    procesarForm.resetFields()
  }

  async function handleProgramarPago(values: { dia_pago_programado: any }) {
    await postAction(`/api/solicitudes/${solicitudId}/programar-pago`, { dia_pago_programado: values.dia_pago_programado.toISOString(), updated_at: updatedAt })
    setProgramarOpen(false)
    programarForm.resetFields()
  }

  async function handleConfirmarRecepcion(values: { conforme: 'si' | 'no'; tipo_problema?: string; observaciones?: string; remito?: any }) {
    setLoading(true)
    try {
      const remitoFile = values.remito?.fileList?.[0]?.originFileObj ?? null
      let res: Response

      if (remitoFile) {
        const fd = new FormData()
        fd.append('solicitud_id', String(solicitudId))
        fd.append('conforme', values.conforme === 'si' ? 'true' : 'false')
        if (values.conforme === 'no') {
          fd.append('tipo_problema', values.tipo_problema ?? '')
          fd.append('observaciones', values.observaciones ?? '')
        }
        fd.append('remito', remitoFile)
        res = await fetch('/api/recepciones', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/recepciones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            solicitud_id: solicitudId,
            conforme: values.conforme === 'si',
            tipo_problema: values.conforme === 'no' ? (values.tipo_problema ?? null) : null,
            observaciones: values.observaciones ?? null,
          }),
        })
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        Modal.error({ title: 'Error', content: data?.error?.message ?? `Error ${res.status}` })
      } else {
        router.refresh()
      }
    } catch {
      Modal.error({ title: 'Error', content: 'Error de red. Intente nuevamente.' })
    } finally {
      setLoading(false)
    }
    setRecepcionOpen(false)
    recepcionForm.resetFields()
  }

  return (
    <>
      {!hasAnyAction ? null : <Space wrap>
        {isCerrada && <Tag color="default">Cerrada</Tag>}

        {canEditar && (
          <Link href={`/solicitudes/${solicitudId}/editar`}>
            <Button>Editar</Button>
          </Link>
        )}

        {canEnviar && (
          <AnimatedSubmitButton variant="send" onClick={handleEnviar}>
            Enviar
          </AnimatedSubmitButton>
        )}

        {canValidar && (
          <AnimatedSubmitButton variant="approve" onClick={handleValidar}>
            Validar
          </AnimatedSubmitButton>
        )}

        {canDevolver && (
          <Button danger onClick={() => setDevolverOpen(true)}>
            Devolver
          </Button>
        )}

        {canAprobar && (
          <AnimatedSubmitButton variant="approve" onClick={handleAprobar}>
            Aprobar
          </AnimatedSubmitButton>
        )}

        {canRechazar && (
          <Button danger onClick={() => setRechazarOpen(true)}>
            Rechazar
          </Button>
        )}

        {canProcesarCompras && (
          <Button type="primary" onClick={() => setProcesarOpen(true)}>
            Procesar
          </Button>
        )}

        {canProgramarPago && (
          <Button
            style={{ background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' }}
            onClick={() => setProgramarOpen(true)}
          >
            Programar Pago
          </Button>
        )}

        {canRegistrarCompra && (
          <Link href={`/compras/${solicitudId}`}>
            <Button type="primary">Registrar Compra</Button>
          </Link>
        )}

        {canConfirmarRecepcion && (
          <Button
            type="primary"
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => setRecepcionOpen(true)}
          >
            Confirmar Recepción
          </Button>
        )}
      </Space>}

      {/* Modal: Devolver */}
      <Modal
        title="Devolver Solicitud"
        open={devolverOpen}
        onCancel={() => { setDevolverOpen(false); devolverForm.resetFields() }}
        onOk={() => devolverForm.submit()}
        okText="Devolver"
        okButtonProps={{ danger: true, loading }}
        cancelText="Cancelar"
        destroyOnHidden={false}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Ingrese el motivo por el cual se devuelve esta solicitud al solicitante.
        </Typography.Paragraph>
        <Form form={devolverForm} layout="vertical" onFinish={handleDevolver}>
          <Form.Item
            name="motivo"
            label="Motivo de devolución"
            rules={[{ required: true, message: 'El motivo es requerido.' }]}
          >
            <TextArea rows={4} placeholder="Describa el motivo..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Rechazar */}
      <Modal
        title="Rechazar Solicitud"
        open={rechazarOpen}
        onCancel={() => { setRechazarOpen(false); rechazarForm.resetFields() }}
        onOk={() => rechazarForm.submit()}
        okText="Rechazar"
        okButtonProps={{ danger: true, loading }}
        cancelText="Cancelar"
        destroyOnHidden={false}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Ingrese el motivo por el cual se rechaza esta solicitud.
        </Typography.Paragraph>
        <Form form={rechazarForm} layout="vertical" onFinish={handleRechazar}>
          <Form.Item
            name="motivo"
            label="Motivo de rechazo"
            rules={[{ required: true, message: 'El motivo es requerido.' }]}
          >
            <TextArea rows={4} placeholder="Describa el motivo..." maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Procesar Compras */}
      <Modal
        title="Procesar Solicitud"
        open={procesarOpen}
        onCancel={() => { setProcesarOpen(false); procesarForm.resetFields() }}
        onOk={() => procesarForm.submit()}
        okText="Procesar"
        okButtonProps={{ loading }}
        cancelText="Cancelar"
        destroyOnHidden={false}
      >
        <Form form={procesarForm} layout="vertical" onFinish={handleProcesarCompras}>
          <Form.Item name="prioridad_compra" label="Prioridad" rules={[{ required: true, message: 'Seleccioná la prioridad' }]}>
            <Select placeholder="Seleccionar prioridad" options={[
              { value: 'urgente', label: 'Urgente' },
              { value: 'normal', label: 'Normal' },
              { value: 'programado', label: 'Programado' },
            ]} />
          </Form.Item>
          <Form.Item name="observaciones" label="Observaciones (opcional)">
            <TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Programar Pago */}
      <Modal
        title="Programar Pago"
        open={programarOpen}
        onCancel={() => { setProgramarOpen(false); programarForm.resetFields() }}
        onOk={() => programarForm.submit()}
        okText="Programar"
        okButtonProps={{ loading }}
        cancelText="Cancelar"
        destroyOnHidden={false}
      >
        <Form form={programarForm} layout="vertical" onFinish={handleProgramarPago}>
          <Form.Item
            name="dia_pago_programado"
            label="Fecha de pago"
            rules={[{ required: true, message: 'Seleccioná la fecha' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(d) => d && d < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal: Confirmar Recepción */}
      <Modal
        title="Confirmar Recepción"
        open={recepcionOpen}
        onCancel={() => { setRecepcionOpen(false); recepcionForm.resetFields() }}
        onOk={() => recepcionForm.submit()}
        okText="Confirmar"
        okButtonProps={{ loading }}
        cancelText="Cancelar"
        destroyOnHidden={false}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          Confirme si los artículos fueron recibidos correctamente.
        </Typography.Paragraph>
        <Form
          form={recepcionForm}
          layout="vertical"
          onFinish={handleConfirmarRecepcion}
          initialValues={{ conforme: 'si' }}
        >
          <Form.Item
            name="conforme"
            label="¿Recibido conforme?"
            rules={[{ required: true, message: 'Seleccione una opción.' }]}
          >
            <Radio.Group>
              <Radio.Button value="si">Sí, conforme</Radio.Button>
              <Radio.Button value="no">No, con observaciones</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.conforme !== cur.conforme}>
            {({ getFieldValue }) =>
              getFieldValue('conforme') === 'no' && (
                <Form.Item
                  name="tipo_problema"
                  label="Tipo de problema"
                  rules={[{ required: true, message: 'Seleccione el tipo de problema' }]}
                >
                  <Select placeholder="Seleccionar tipo de problema" options={[
                    { value: 'faltante', label: 'Faltante' },
                    { value: 'dañado', label: 'Dañado' },
                    { value: 'diferente', label: 'Diferente al pedido' },
                    { value: 'otro', label: 'Otro' },
                  ]} />
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item name="observaciones" label="Observaciones (opcional)">
            <TextArea rows={3} placeholder="Ingrese observaciones si las hubiera..." maxLength={500} showCount />
          </Form.Item>
          <Form.Item name="remito" label="Remito / comprobante (opcional)">
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              accept=".pdf,.jpg,.jpeg,.png"
            >
              <Button icon={<UploadOutlined />}>Adjuntar remito</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
