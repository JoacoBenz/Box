'use client';

import { Table } from 'antd';
import { useIsMobile } from '@/hooks/useIsMobile';

export interface ItemRow {
  id: number;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_estimado: number | null;
  link_producto?: string | null;
}

const columns = [
  { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion' },
  {
    title: 'Link',
    dataIndex: 'link_producto',
    key: 'link_producto',
    width: 80,
    render: (v: string | null) =>
      v ? (
        <a
          href={v}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)' }}
        >
          Ver
        </a>
      ) : null,
  },
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
      r.precio_estimado != null ? `$${(r.precio_estimado * r.cantidad).toFixed(2)}` : '—',
  },
];

function ItemCard({ item }: { item: ItemRow }) {
  const subtotal = item.precio_estimado != null ? item.precio_estimado * item.cantidad : null;
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: 10,
        border: '1px solid var(--border-color)',
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
        {item.descripcion}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: subtotal != null ? 8 : 0,
        }}
      >
        <span>
          {item.cantidad} {item.unidad}
        </span>
        {item.precio_estimado != null && <span>× ${item.precio_estimado.toFixed(2)}</span>}
        {item.link_producto && (
          <a
            href={item.link_producto}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-primary)', fontWeight: 500 }}
          >
            Ver producto ↗
          </a>
        )}
      </div>
      {subtotal != null && (
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
          ${subtotal.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export default function ItemsTable({ items }: { items: ItemRow[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return <Table rowKey="id" columns={columns} dataSource={items} pagination={false} size="small" />;
}
