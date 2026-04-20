'use client';

import { Card, Descriptions, Typography, Button } from 'antd';
import { ShopOutlined, LinkOutlined, EditOutlined } from '@ant-design/icons';
import { useTheme } from '@/components/ThemeProvider';

interface Proveedor {
  id: number;
  nombre: string;
  cuit?: string | null;
  datos_bancarios?: string | null;
  link_pagina?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
}

interface Props {
  proveedor: Proveedor;
  style?: React.CSSProperties;
  editable?: boolean;
  onEditBancarios?: () => void;
}

export default function ProveedorInfoCard({ proveedor, style, editable, onEditBancarios }: Props) {
  const { tokens } = useTheme();
  return (
    <Card
      size="small"
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShopOutlined style={{ color: tokens.colorPrimary }} />
          <span style={{ fontWeight: 600 }}>Proveedor: {proveedor.nombre}</span>
        </span>
      }
      style={{ borderRadius: 10, background: tokens.bgInput, ...style }}
    >
      <Descriptions column={1} size="small" colon={false}>
        {proveedor.cuit && <Descriptions.Item label="CUIT">{proveedor.cuit}</Descriptions.Item>}
        {proveedor.telefono && (
          <Descriptions.Item label="Teléfono">{proveedor.telefono}</Descriptions.Item>
        )}
        {proveedor.email && <Descriptions.Item label="Email">{proveedor.email}</Descriptions.Item>}
        {proveedor.direccion && (
          <Descriptions.Item label="Dirección">{proveedor.direccion}</Descriptions.Item>
        )}
        <Descriptions.Item
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Datos Bancarios
              {editable && (
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={onEditBancarios}
                  style={{ padding: 0, height: 'auto', fontSize: 12 }}
                >
                  Editar
                </Button>
              )}
            </span>
          }
        >
          {proveedor.datos_bancarios ? (
            <Typography.Text style={{ whiteSpace: 'pre-line' }}>
              {proveedor.datos_bancarios}
            </Typography.Text>
          ) : (
            <span style={{ color: tokens.textMuted }}>Sin datos bancarios</span>
          )}
        </Descriptions.Item>
        {proveedor.link_pagina && (
          <Descriptions.Item label="Web">
            <a
              href={proveedor.link_pagina}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <LinkOutlined /> {proveedor.link_pagina}
            </a>
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
}
