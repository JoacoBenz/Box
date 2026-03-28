import { z } from 'zod';

export const registroSchema = z.object({
  nombreColegio: z.string().min(3, 'Mínimo 3 caracteres').max(255),
  nombreUsuario: z.string().min(2, 'Mínimo 2 caracteres').max(150),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export const areaSchema = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  responsable_id: z.number().int().positive().optional().nullable(),
});

export const usuarioSchema = z.object({
  nombre: z.string().min(2).max(150),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  area_id: z.number().int().positive(),
  roles: z
    .array(z.enum(['solicitante', 'responsable_area', 'director', 'tesoreria', 'admin']))
    .min(1, 'Asigná al menos un rol'),
});

export const itemSolicitudSchema = z.object({
  descripcion: z.string().min(1, 'Descripción requerida').max(255),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
  unidad: z.string().max(50).default('unidades'),
  precio_estimado: z.number().nonnegative().optional().nullable(),
});

export const solicitudSchema = z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres').max(255),
  descripcion: z.string().min(10, 'Describí con más detalle qué necesitás'),
  justificacion: z.string().min(10, 'Explicá por qué se necesita esta compra'),
  urgencia: z.enum(['normal', 'urgente', 'critica']),
  proveedor_sugerido: z.string().max(255).optional().nullable(),
  items: z.array(itemSolicitudSchema).min(1, 'Agregá al menos un ítem'),
});

export const compraSchema = z.object({
  solicitud_id: z.number().int().positive(),
  proveedor_nombre: z.string().min(2, 'Nombre del proveedor requerido').max(255),
  proveedor_detalle: z.string().optional().nullable(),
  fecha_compra: z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha inválida'),
  monto_total: z.number().positive('El monto debe ser mayor a 0'),
  medio_pago: z.enum(['transferencia', 'efectivo', 'cheque', 'tarjeta', 'otro']),
  referencia_bancaria: z.string().max(100).optional().nullable(),
  numero_factura: z.string().max(50).optional().nullable(),
  observaciones: z.string().optional().nullable(),
});

export const recepcionSchema = z
  .object({
    solicitud_id: z.number().int().positive(),
    conforme: z.boolean(),
    tipo_problema: z.enum(['faltante', 'dañado', 'diferente', 'otro']).optional().nullable(),
    observaciones: z.string().optional().nullable(),
  })
  .refine((data) => data.conforme || (data.tipo_problema && data.observaciones), {
    message: 'Si no es conforme, indicá el tipo de problema y observaciones',
  });

export const devolucionSchema = z.object({
  observaciones: z.string().min(5, 'Escribí el motivo de la devolución'),
});

export const rechazoSchema = z.object({
  motivo: z.string().min(5, 'Escribí el motivo del rechazo'),
});
