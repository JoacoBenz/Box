'use client';

import { useState } from 'react';
import { App, Modal, Form, Input } from 'antd';
import CuitInput from './CuitInput';
import PhoneInput from './PhoneInput';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (proveedor: any) => void;
}

export default function ProveedorCreateModal({ open, onClose, onCreated }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  async function handleOk() {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Error al crear proveedor');
      }

      const proveedor = await res.json();
      message.success('Proveedor creado');
      form.resetFields();
      onCreated(proveedor);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message ?? 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Nuevo Proveedor"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      okText="Crear"
      cancelText="Cancelar"
      confirmLoading={loading}
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          label="Nombre"
          name="nombre"
          rules={[{ required: true, message: 'El nombre es obligatorio' }]}
        >
          <Input placeholder="Nombre del proveedor" maxLength={255} />
        </Form.Item>

        <Form.Item
          label="CUIT"
          name="cuit"
          rules={[
            {
              pattern: /^\d{2}-\d{8}-\d{1}$/,
              message: 'Formato inválido. Usá: XX-XXXXXXXX-X',
            },
          ]}
        >
          <CuitInput />
        </Form.Item>

        <Form.Item label="Datos Bancarios (CBU / Alias / Banco)" name="datos_bancarios">
          <Input.TextArea
            rows={2}
            placeholder="CBU, alias, banco, tipo de cuenta"
            maxLength={500}
          />
        </Form.Item>

        <Form.Item
          label="Link de Página Web"
          name="link_pagina"
          rules={[{ type: 'url', message: 'Ingresá una URL válida (ej: https://...)' }]}
        >
          <Input placeholder="https://..." maxLength={500} />
        </Form.Item>

        <Form.Item label="Teléfono" name="telefono">
          <PhoneInput />
        </Form.Item>

        <Form.Item
          label="Email"
          name="email"
          rules={[{ type: 'email', message: 'Ingresá un email válido' }]}
        >
          <Input placeholder="email@proveedor.com" maxLength={255} />
        </Form.Item>

        <Form.Item label="Dirección" name="direccion">
          <Input placeholder="Dirección del proveedor" maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
