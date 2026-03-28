'use client'

import { Table } from 'antd'

export interface ItemRow {
  id: number
  descripcion: string
  cantidad: number
  unidad: string
  precio_estimado: number | null
}

const columns = [
  { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
  { title: 'Cantidad', dataIndex: 'cantidad', key: 'cantidad', width: 100 },
  { title: 'Unidad', dataIndex: 'unidad', key: 'unidad', width: 110 },
  {
    title: 'Precio Est.',
    dataIndex: 'precio_estimado',
    key: 'precio_estimado',
    width: 130,
    render: (v: number | null) => (v != null ? `$${v.toFixed(2)}` : '—'),
  },
  {
    title: 'Subtotal Est.',
    key: 'subtotal',
    width: 130,
    render: (_: unknown, r: ItemRow) =>
      r.precio_estimado != null
        ? `$${(r.precio_estimado * r.cantidad).toFixed(2)}`
        : '—',
  },
]

export default function ItemsTable({ items }: { items: ItemRow[] }) {
  return <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="small" />
}
