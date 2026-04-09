'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { AutoComplete, Typography } from 'antd'

const { Text } = Typography

interface Producto {
  id: number
  nombre: string
  categoria: string | null
  unidad_defecto: string
  precio_referencia: string | number | null
  link_producto: string | null
}

interface Props {
  onSelect?: (producto: Producto) => void
  placeholder?: string
  disabled?: boolean
  /** Current text value for the input (controlled) */
  value?: string
  onChange?: (value: string) => void
}

export default function ProductoSelect({ onSelect, placeholder = 'Buscar producto o escribir descripción...', disabled, value, onChange }: Props) {
  const [options, setOptions] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchProductos = useCallback(async (search: string) => {
    if (!search || search.length < 2) {
      setOptions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/productos?q=${encodeURIComponent(search)}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setOptions(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSearch = useCallback((val: string) => {
    onChange?.(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchProductos(val), 300)
  }, [fetchProductos, onChange])

  const handleSelect = useCallback((_val: string, option: any) => {
    const producto = options.find(p => p.id === option.key)
    if (producto) {
      onChange?.(producto.nombre)
      onSelect?.(producto)
    }
  }, [options, onSelect, onChange])

  return (
    <AutoComplete
      value={value}
      onSearch={handleSearch}
      onSelect={handleSelect}
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: '100%' }}
      options={options.map(p => ({
        key: p.id,
        value: p.nombre,
        label: (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong>{p.nombre}</Text>
              {p.categoria && (
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  {p.categoria}
                </Text>
              )}
            </div>
            {p.precio_referencia != null && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                ${Number(p.precio_referencia).toLocaleString('es-AR')}
              </Text>
            )}
          </div>
        ),
      }))}
    />
  )
}
