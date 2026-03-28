'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Space, Modal, Form, Input, Radio, Select, Typography, Tag } from 'antd'
import Link from 'next/link'

const { TextArea } = Input

interface Props {
  solicitudId: number
  estado: string
  solicitanteId: number
  solicitudAreaId: number | null
  sessionUserId: number
  sessionRoles: string[]
  sessionAreaId: number | null
}

export default function SolicitudActionButtons({
  solicitudId,
  estado,
  solicitanteId,
  solicitudAreaId,
  sessionUserId,
  sessionRoles,
  sessionAreaId,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [devolverOpen, setDevolverOpen] = useState(false)
  const [devolverForm] = Form.useForm<{ motivo: string }>()

  const [rechazarOpen, setRechazarOpen] = useState(false)
  const [rechazarForm] = Form.useForm<{ motivo: string }>()

  const [recepcionOpen, setRecepcionOpen] = useState(false)
  const [recepcionForm] = Form.useForm<{ conforme: 'si' | 'no'; tipo_problema?: string; observaciones?: string }>()

  const roles = sessionRoles
  const isOwner = solicitanteId === sessionUserId
  const isSolicitante = roles.includes('solicitante')
  const isResponsable = roles.includes('responsable_area')
  const isDirector = roles.includes('director')
  const isTesoreria = roles.includes('tesoreria')
  const isAdmin = roles.includes('admin')
  const isSameArea = isAdmin || (solicitudAreaId != null && sessionAreaId === solicitudAreaId)

  // Button visibility must match backend role checks exactly to avoid 403s
  const canEnviar = isSolicitante && isOwner && ['borrador', 'devuelta_resp', 'devuelta_dir'].includes(estado)
  const canValidar = isResponsable && isSameArea && ['enviada', 'devuelta_dir'].includes(estado)
  const canDevolver = (isResponsable && isSameArea && estado === 'enviada') || (isDirector && estado === 'validada')
  const canAprobar = isDirector && estado === 'validada'
  const canRechazar = isDirector && estado === 'validada'
  const canRegistrarCompra = isTesoreria && estado === 'aprobada'
  const canConfirmarRecepcion = (isSolicitante || isResponsable) && (isOwner || isSameArea) && estado === 'comprada'
  const canCerrar = (isTesoreria || isAdmin) && estado === 'recibida_con_obs'
  const isCerrada = estado === 'cerrada'

  const hasAnyAction =
    canEnviar || canValidar || canDevolver || canAprobar ||
    canRechazar || canRegistrarCompra || canConfirmarRecepcion || canCerrar || isCerrada

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
    await postAction(`/api/solicitudes/${solicitudId}/enviar`)
  }

  async function handleValidar() {
    await postAction(`/api/solicitudes/${solicitudId}/validar`)
  }

  async function handleDevolver(values: { motivo: string }) {
    // Determine origen from the current state, not the role (a user may have both roles)
    const origen = estado === 'validada' ? 'director' : 'responsable'
    await postAction(`/api/solicitudes/${solicitudId}/devolver`, { observaciones: values.motivo, origen })
    setDevolverOpen(false)
    devolverForm.resetFields()
  }

  async function handleAprobar() {
    await postAction(`/api/solicitudes/${solicitudId}/aprobar`)
  }

  async function handleRechazar(values: { motivo: string }) {
    await postAction(`/api/solicitudes/${solicitudId}/rechazar`, { motivo: values.motivo })
    setRechazarOpen(false)
    rechazarForm.resetFields()
  }

  async function handleConfirmarRecepcion(values: { conforme: 'si' | 'no'; tipo_problema?: string; observaciones?: string }) {
    await postAction(`/api/recepciones`, {
      solicitud_id: solicitudId,
      conforme: values.conforme === 'si',
      tipo_problema: values.conforme === 'no' ? (values.tipo_problema ?? null) : null,
      observaciones: values.observaciones ?? null,
    })
    setRecepcionOpen(false)
    recepcionForm.resetFields()
  }

  if (!hasAnyAction) return null

  return (
    <>
      <Space wrap>
        {isCerrada && <Tag color="default">Cerrada</Tag>}

        {canEnviar && (
          <Button type="primary" loading={loading} onClick={handleEnviar}>
            Enviar
          </Button>
        )}

        {canValidar && (
          <Button
            type="primary"
            style={{ background: '#13c2c2', borderColor: '#13c2c2' }}
            loading={loading}
            onClick={handleValidar}
          >
            Validar
          </Button>
        )}

        {canDevolver && (
          <Button danger onClick={() => setDevolverOpen(true)}>
            Devolver
          </Button>
        )}

        {canAprobar && (
          <Button
            type="primary"
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            loading={loading}
            onClick={handleAprobar}
          >
            Aprobar
          </Button>
        )}

        {canRechazar && (
          <Button danger onClick={() => setRechazarOpen(true)}>
            Rechazar
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
      </Space>

      {/* Modal: Devolver */}
      <Modal
        title="Devolver Solicitud"
        open={devolverOpen}
        onCancel={() => { setDevolverOpen(false); devolverForm.resetFields() }}
        onOk={() => devolverForm.submit()}
        okText="Devolver"
        okButtonProps={{ danger: true, loading }}
        cancelText="Cancelar"
        destroyOnHidden
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
        destroyOnHidden
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

      {/* Modal: Confirmar Recepción */}
      <Modal
        title="Confirmar Recepción"
        open={recepcionOpen}
        onCancel={() => { setRecepcionOpen(false); recepcionForm.resetFields() }}
        onOk={() => recepcionForm.submit()}
        okText="Confirmar"
        okButtonProps={{ loading }}
        cancelText="Cancelar"
        destroyOnHidden
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
        </Form>
      </Modal>
    </>
  )
}
