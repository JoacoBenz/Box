'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  App,
  Table,
  Button,
  Modal,
  Form,
  Space,
  Popconfirm,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { FormInstance } from 'antd/es/form'
import { useAdminTenant } from '@/components/admin/TenantSelector'
import { useFormValid } from '@/hooks/useFormValid'

const { Title } = Typography

export interface AdminCrudTableProps<T extends { id: number }> {
  /** Page title */
  title: string
  /** API endpoint for GET (list) and POST (create) */
  apiUrl: string
  /** Optional separate API for fetching secondary data (e.g., users for a select) */
  secondaryApiUrl?: string
  /** Extract data array from API response */
  extractData?: (response: any) => T[]
  /** Extract secondary data from API response */
  extractSecondaryData?: (response: any) => any[]
  /** Column definitions */
  columns: (selectedTenant: number | null, helpers: { openEdit: (item: T) => void; handleDeactivate: (item: T) => void }) => ColumnsType<T>
  /** Render modal form fields */
  renderForm: (form: FormInstance, editing: T | null, secondaryData: any[]) => ReactNode
  /** Map form values to API payload */
  mapPayload?: (values: any, editing: T | null) => any
  /** Map item to form values when editing */
  mapToForm?: (item: T) => any
  /** PATCH URL builder for updates */
  patchUrl?: (item: T) => string
  /** Deactivation URL builder */
  deactivateUrl?: (item: T) => string
  /** Deactivation payload builder */
  deactivatePayload?: (item: T) => any
  /** Modal width */
  modalWidth?: number
  /** Create button label */
  createLabel?: string
  /** Entity name for messages */
  entityName?: string
  /** Use form.submit() instead of manual validate (for onFinish pattern) */
  useFormSubmit?: boolean
}

export default function AdminCrudTable<T extends { id: number }>({
  title: pageTitle,
  apiUrl,
  secondaryApiUrl,
  extractData,
  extractSecondaryData,
  columns,
  renderForm,
  mapPayload,
  mapToForm,
  patchUrl,
  deactivateUrl,
  deactivatePayload,
  modalWidth,
  createLabel,
  entityName = 'registro',
  useFormSubmit,
}: AdminCrudTableProps<T>) {
  const { message } = App.useApp()
  const [items, setItems] = useState<T[]>([])
  const [secondaryData, setSecondaryData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const { hasErrors, formProps } = useFormValid(form)
  const [adminTenant] = useAdminTenant()
  const [ownTenantId, setOwnTenantId] = useState<number | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      const roles: string[] = s?.user?.roles ?? []
      setIsAdmin(roles.includes('admin'))
      setOwnTenantId(s?.user?.tenantId ?? null)
    }).catch(() => {})
  }, [])

  // For admins, selectedTenant comes from cookie (TenantSelector).
  // For directors/others, use their own tenant automatically.
  // isAdmin === null means still loading session
  const selectedTenant = isAdmin === null ? null : isAdmin ? adminTenant : ownTenantId
  const hasTenant = selectedTenant !== null

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const promises: Promise<Response>[] = [fetch(apiUrl)]
      if (secondaryApiUrl) promises.push(fetch(secondaryApiUrl))

      const responses = await Promise.all(promises)

      const mainRes = responses[0]
      if (!mainRes.ok) throw new Error(`Error al cargar ${entityName}s`)
      const mainData = await mainRes.json()
      setItems(extractData ? extractData(mainData) : (Array.isArray(mainData) ? mainData : mainData.data ?? []))

      if (secondaryApiUrl && responses[1]) {
        const secRes = responses[1]
        if (secRes.ok) {
          const secData = await secRes.json()
          setSecondaryData(extractSecondaryData ? extractSecondaryData(secData) : (Array.isArray(secData) ? secData : secData.data ?? []))
        }
      }
    } catch (err: any) {
      message.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedTenant, apiUrl, secondaryApiUrl])

  useEffect(() => { fetchData() }, [fetchData])

  function openCreate() {
    if (!hasTenant) {
      message.warning(`Seleccioná una organización antes de crear`)
      return
    }
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  function openEdit(item: T) {
    setEditing(item)
    form.setFieldsValue(mapToForm ? mapToForm(item) : item)
    setModalOpen(true)
  }

  async function handleSave(formValues?: any) {
    try {
      const values = formValues ?? await form.validateFields()
      setSaving(true)

      const url = editing && patchUrl ? patchUrl(editing) : apiUrl
      const method = editing ? 'PATCH' : 'POST'
      const payload = mapPayload ? mapPayload(values, editing) : values

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Error al guardar`)
      }

      message.success(editing ? `${entityName} actualizado` : `${entityName} creado correctamente`)
      setModalOpen(false)
      form.resetFields()
      fetchData()
    } catch (err: any) {
      if (err?.errorFields) return
      message.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeactivate(item: T) {
    try {
      const url = deactivateUrl ? deactivateUrl(item) : `${apiUrl}/${item.id}`
      const payload = deactivatePayload ? deactivatePayload(item) : { activo: false }

      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? 'Error al actualizar')
      }
      message.success('Actualizado correctamente')
      fetchData()
    } catch (err: any) {
      message.error(err.message)
    }
  }

  const resolvedColumns = columns(selectedTenant, { openEdit, handleDeactivate })

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>{pageTitle}</Title>
        {hasTenant && (
          <Button type="primary" onClick={openCreate} style={{ fontWeight: 600 }}>
            {createLabel ?? `+ Nuevo`}
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={resolvedColumns}
        dataSource={items}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        size="middle"
      />

      <Modal
        title={editing ? `Editar ${entityName}` : `Nuevo ${entityName}`}
        open={modalOpen}
        onOk={useFormSubmit ? () => form.submit() : () => handleSave()}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        confirmLoading={saving}
        okButtonProps={{ disabled: hasErrors }}
        okText={editing ? 'Guardar' : 'Crear'}
        cancelText="Cancelar"
        destroyOnHidden={false}
        width={modalWidth}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
          onFinish={useFormSubmit ? handleSave : undefined}
          {...formProps}
        >
          {renderForm(form, editing, secondaryData)}
        </Form>
      </Modal>
    </div>
  )
}
