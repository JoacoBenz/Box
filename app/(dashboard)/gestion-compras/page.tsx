'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, Tag, Button, Typography, Modal, Form, Select, Input, DatePicker, Space } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { ESTADOS_SOLICITUD, URGENCIAS } from '@/types'
import type { EstadoSolicitud, UrgenciaSolicitud } from '@/types'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input

interface Solicitud {
  id: number
  numero: string
  titulo: string
  urgencia: string
  estado: string
  tipo: string
  monto_estimado_total: number | null
  prioridad_compra: string | null
  dia_pago_programado: string | null
  area: { nombre: string } | null
  solicitante: { nombre: string }
}

export default function GestionComprasPage() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)

  const [procesarOpen, setProcesarOpen] = useState(false)
  const [programarOpen, setProgramarOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [procesarForm] = Form.useForm()
  const [programarForm] = Form.useForm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/solicitudes?estado=aprobada,en_compras,pago_programado&limit=100')
      if (res.ok) {
        const data = await res.json()
        setSolicitudes(data.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleProcesar(values: { prioridad_compra: string; observaciones?: string }) {
    if (!selectedId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/solicitudes/${selectedId}/procesar-compras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        Modal.error({ title: 'Error', content: data?.error?.message ?? `Error ${res.status}` })
      } else {
        setProcesarOpen(false)
        procesarForm.resetFields()
        fetchData()
      }
    } finally {
      setActionLoading(false)
    }
  }

  async function handleProgramar(values: { dia_pago_programado: any }) {
    if (!selectedId) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/solicitudes/${selectedId}/programar-pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dia_pago_programado: values.dia_pago_programado.toISOString() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        Modal.error({ title: 'Error', content: data?.error?.message ?? `Error ${res.status}` })
      } else {
        setProgramarOpen(false)
        programarForm.resetFields()
        fetchData()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const PRIORIDAD_COLORS: Record<string, string> = {
    urgente: 'red',
    normal: 'blue',
    programado: 'default',
  }

  const columns: ColumnsType<Solicitud> = [
    {
      title: 'N°',
      dataIndex: 'numero',
      width: 130,
      render: (val, row) => <Link href={`/solicitudes/${row.id}`}>{val}</Link>,
    },
    {
      title: 'Título',
      dataIndex: 'titulo',
      render: (val, row) => (
        <Space direction="vertical" size={2}>
          <Link href={`/solicitudes/${row.id}`} style={{ fontWeight: 500 }}>{val}</Link>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.area?.nombre ?? '—'} · {row.solicitante.nombre}</Text>
        </Space>
      ),
    },
    {
      title: 'Urgencia',
      dataIndex: 'urgencia',
      width: 100,
      render: (val: UrgenciaSolicitud) => {
        const info = URGENCIAS[val]
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{val}</Tag>
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      width: 140,
      render: (val: EstadoSolicitud) => {
        const info = ESTADOS_SOLICITUD[val]
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{val}</Tag>
      },
    },
    {
      title: 'Prioridad',
      dataIndex: 'prioridad_compra',
      width: 100,
      render: (val: string | null) =>
        val ? <Tag color={PRIORIDAD_COLORS[val] ?? 'default'}>{val.charAt(0).toUpperCase() + val.slice(1)}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Día de pago',
      dataIndex: 'dia_pago_programado',
      width: 120,
      render: (val: string | null) =>
        val ? new Date(val).toLocaleDateString('es-AR') : <Text type="secondary">—</Text>,
    },
    {
      title: 'Monto',
      dataIndex: 'monto_estimado_total',
      width: 110,
      render: (val: number | null) =>
        val != null ? `$${Number(val).toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : <Text type="secondary">—</Text>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 210,
      render: (_, row) => (
        <Space size="small" wrap>
          {['aprobada', 'en_compras'].includes(row.estado) && (
            <Button
              size="small"
              type="primary"
              onClick={() => { setSelectedId(row.id); setProcesarOpen(true) }}
            >
              Procesar
            </Button>
          )}
          {row.estado === 'en_compras' && (
            <Button
              size="small"
              style={{ background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' }}
              onClick={() => { setSelectedId(row.id); setProgramarOpen(true) }}
            >
              Programar Pago
            </Button>
          )}
          {row.estado === 'pago_programado' && (
            <Link href={`/compras/${row.id}`}>
              <Button size="small" type="primary" style={{ background: '#059669', borderColor: '#059669' }}>
                Registrar Compra
              </Button>
            </Link>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-content">
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Gestión de Compras</Title>
        <Text type="secondary">Pipeline de solicitudes aprobadas para procesar y pagar</Text>
      </div>

      <Table
        columns={columns}
        dataSource={solicitudes}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'No hay solicitudes pendientes en Compras' }}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      />

      {/* Modal: Procesar */}
      <Modal
        title="Procesar Solicitud"
        open={procesarOpen}
        onCancel={() => { setProcesarOpen(false); procesarForm.resetFields() }}
        onOk={() => procesarForm.submit()}
        okText="Procesar"
        okButtonProps={{ loading: actionLoading }}
        cancelText="Cancelar"
      >
        <Form form={procesarForm} layout="vertical" onFinish={handleProcesar}>
          <Form.Item name="prioridad_compra" label="Prioridad" rules={[{ required: true, message: 'Seleccioná la prioridad' }]}>
            <Select placeholder="Seleccionar prioridad" options={[
              { value: 'urgente', label: 'Urgente' },
              { value: 'normal', label: 'Normal' },
              { value: 'programado', label: 'Programado' },
            ]} />
          </Form.Item>
          <Form.Item name="observaciones" label="Observaciones (opcional)">
            <TextArea rows={3} placeholder="Notas internas de Compras..." maxLength={500} showCount />
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
        okButtonProps={{ loading: actionLoading }}
        cancelText="Cancelar"
      >
        <Form form={programarForm} layout="vertical" onFinish={handleProgramar}>
          <Form.Item
            name="dia_pago_programado"
            label="Fecha de pago"
            rules={[{ required: true, message: 'Seleccioná la fecha de pago' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(d) => d && d < dayjs().startOf('day')}
              placeholder="Seleccionar fecha"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
