'use client'

import { Card, Descriptions, Typography } from 'antd'
import { ShopOutlined, LinkOutlined } from '@ant-design/icons'

interface Proveedor {
  id: number
  nombre: string
  cuit?: string | null
  datos_bancarios?: string | null
  link_pagina?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
}

interface Props {
  proveedor: Proveedor
  style?: React.CSSProperties
}

export default function ProveedorInfoCard({ proveedor, style }: Props) {
  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShopOutlined style={{ color: '#1677ff' }} />
          <span style={{ fontWeight: 600 }}>Proveedor: {proveedor.nombre}</span>
        </span>
      }
      style={{ borderRadius: 10, background: '#f8fafc', ...style }}
    >
      <Descriptions column={1} size="small" colon={false}>
        {proveedor.cuit && (
          <Descriptions.Item label="CUIT">{proveedor.cuit}</Descriptions.Item>
        )}
        {proveedor.telefono && (
          <Descriptions.Item label="Teléfono">{proveedor.telefono}</Descriptions.Item>
        )}
        {proveedor.email && (
          <Descriptions.Item label="Email">{proveedor.email}</Descriptions.Item>
        )}
        {proveedor.direccion && (
          <Descriptions.Item label="Dirección">{proveedor.direccion}</Descriptions.Item>
        )}
        {proveedor.datos_bancarios && (
          <Descriptions.Item label="Datos Bancarios">
            <Typography.Text style={{ whiteSpace: 'pre-line' }}>{proveedor.datos_bancarios}</Typography.Text>
          </Descriptions.Item>
        )}
        {proveedor.link_pagina && (
          <Descriptions.Item label="Web">
            <a href={proveedor.link_pagina} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <LinkOutlined /> {proveedor.link_pagina}
            </a>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  )
}
