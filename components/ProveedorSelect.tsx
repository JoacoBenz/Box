'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Select, Button, Divider } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import ProveedorCreateModal from './ProveedorCreateModal'

interface Proveedor {
  id: number
  nombre: string
  cuit: string | null
}

interface Props {
  value?: number | null
  onChange?: (value: number | null, proveedor: Proveedor | null) => void
  disabled?: boolean
  placeholder?: string
}

export default function ProveedorSelect({ value, onChange, disabled, placeholder = 'Buscar proveedor...' }: Props) {
  const [options, setOptions] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProveedores = useCallback(async (search: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proveedores?search=${encodeURIComponent(search)}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setOptions(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Load initial options
  useEffect(() => {
    fetchProveedores('')
  }, [fetchProveedores])

  const handleSearch = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchProveedores(val), 300)
  }, [fetchProveedores])

  const handleChange = useCallback((val: number | undefined) => {
    if (!val) {
      onChange?.(null, null)
      return
    }
    const selected = options.find(p => p.id === val) ?? null
    onChange?.(val, selected)
  }, [options, onChange])

  const handleCreated = useCallback((proveedor: Proveedor) => {
    setOptions(prev => [proveedor, ...prev])
    onChange?.(proveedor.id, proveedor)
    setModalOpen(false)
  }, [onChange])

  return (
    <>
      <Select
        showSearch
        allowClear
        value={value ?? undefined}
        placeholder={placeholder}
        filterOption={false}
        onSearch={handleSearch}
        onChange={handleChange}
        loading={loading}
        disabled={disabled}
        style={{ width: '100%' }}
        options={options.map(p => ({
          value: p.id,
          label: p.cuit ? `${p.nombre} (${p.cuit})` : p.nombre,
        }))}
        popupRender={(menu) => (
          <>
            {menu}
            <Divider style={{ margin: '8px 0' }} />
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              style={{ width: '100%', textAlign: 'left', color: '#1677ff' }}
            >
              Crear nuevo proveedor
            </Button>
          </>
        )}
      />
      <ProveedorCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  )
}
