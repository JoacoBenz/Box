import { z } from 'zod';

// Helper: reject strings that are only whitespace
const nonBlank = (min: number, msg: string) =>
  z.string().min(min, msg).refine((v) => v.trim().length >= min, msg);

// Shared strong password policy
const passwordSchema = z
  .string()
  .min(10, 'Mínimo 10 caracteres')
  .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
  .regex(/[a-z]/, 'Debe contener al menos una minúscula')
  .regex(/[0-9]/, 'Debe contener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial (!@#$%...)');

// CUIT argentino: XX-XXXXXXXX-X (con o sin guiones)
const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
const cuitSchema = z
  .string()
  .max(13)
  .refine((v) => !v || cuitRegex.test(v), 'CUIT inválido. Formato esperado: XX-XXXXXXXX-X')
  .optional()
  .nullable()
  .or(z.literal(''));

// Número de factura argentino: Letra-XXXX-XXXXXXXX (ej: A-0001-00012345)
const facturaRegex = /^[A-Z]-\d{4}-\d{8}$/;

export const registroSchema = z.object({
  nombreOrganizacion: nonBlank(3, 'Mínimo 3 caracteres').max(255),
  nombreUsuario: nonBlank(2, 'Mínimo 2 caracteres').max(150),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Ingresá tu contraseña'),
});

export const unirseSchema = z.object({
  nombre: nonBlank(2, 'Mínimo 2 caracteres').max(150),
  email: z.string().email('Email inválido'),
  password: passwordSchema,
  area_texto: nonBlank(2, 'Indicá tu área').max(150),
  codigo: z.string().max(8).optional(),
});

export const areaSchema = z.object({
  nombre: nonBlank(2, 'Mínimo 2 caracteres').max(100),
  responsable_id: z.number().int().positive().optional().nullable(),
  presupuesto_anual: z.number().nonnegative().max(999_999_999).optional().nullable(),
  presupuesto_mensual: z.number().nonnegative().max(999_999_999).optional().nullable(),
});

export const usuarioSchema = z.object({
  nombre: nonBlank(2, 'El nombre no puede estar vacío').max(150),
  email: z.string().email('Email inválido'),
  password: passwordSchema.optional(),
  area_id: z.number().int().positive(),
  centro_costo_id: z.number().int().positive().optional().nullable(),
  roles: z
    .array(z.enum(['solicitante', 'responsable_area', 'director', 'tesoreria', 'compras', 'admin']))
    .min(1, 'Asigná al menos un rol'),
});

export const itemSolicitudSchema = z.object({
  descripcion: nonBlank(2, 'La descripción del ítem es requerida').max(255),
  cantidad: z
    .number()
    .positive('La cantidad debe ser mayor a 0')
    .max(999999, 'Cantidad excesiva'),
  unidad: z.string().min(1, 'Unidad requerida').max(50).default('unidades'),
  precio_estimado: z
    .number()
    .nonnegative('El precio no puede ser negativo')
    .max(999_999_999, 'Precio excesivo')
    .optional()
    .nullable(),
  link_producto: z.string().url('URL inválida').max(500).optional().nullable().or(z.literal('')),
});

export const solicitudSchema = z.object({
  titulo: nonBlank(3, 'Mínimo 3 caracteres').max(255),
  descripcion: nonBlank(10, 'Describí con más detalle qué necesitás').max(2000),
  justificacion: nonBlank(10, 'Explicá por qué se necesita esta compra').max(2000),
  urgencia: z.enum(['normal', 'urgente', 'critica']),
  proveedor_sugerido: z.string().max(255).optional().nullable().or(z.literal('')),
  proveedor_id: z.number().int().positive().optional().nullable(),
  centro_costo_id: z.number().int().positive().optional().nullable(),
  items: z.array(itemSolicitudSchema).min(1, 'Agregá al menos un ítem').max(100, 'Máximo 100 ítems'),
});

export const proveedorSchema = z.object({
  nombre: nonBlank(2, 'Mínimo 2 caracteres').max(255),
  cuit: cuitSchema,
  datos_bancarios: z.string().max(500).optional().nullable().or(z.literal('')),
  link_pagina: z.string().url('URL inválida. Incluí https://').max(500).optional().nullable().or(z.literal('')),
  telefono: z
    .string()
    .max(12)
    .refine((v) => !v || /^\d{2}-\d{4}-\d{4}$/.test(v), 'Formato inválido. Usá: XX-XXXX-XXXX')
    .optional()
    .nullable()
    .or(z.literal('')),
  email: z.string().email('Email inválido').max(255).optional().nullable().or(z.literal('')),
  direccion: z.string().max(500).optional().nullable().or(z.literal('')),
});

export const compraSchema = z
  .object({
    solicitud_id: z.number().int().positive(),
    proveedor_id: z.number().int().positive().optional().nullable(),
    proveedor_nombre: nonBlank(2, 'Nombre del proveedor requerido').max(255),
    proveedor_detalle: z.string().max(500).optional().nullable(),
    fecha_compra: z.string().refine((val) => {
      if (isNaN(Date.parse(val))) return false;
      const d = new Date(val);
      const now = new Date();
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(now.getFullYear() - 5);
      return d <= now && d >= fiveYearsAgo;
    }, 'La fecha no puede ser futura ni tener más de 5 años de antigüedad'),
    monto_total: z
      .number()
      .positive('El monto debe ser mayor a 0')
      .max(999_999_999, 'Monto excesivo'),
    medio_pago: z.enum(['transferencia', 'efectivo', 'cheque', 'tarjeta', 'otro']),
    referencia_bancaria: z.string().max(100).optional().nullable(),
    numero_factura: z
      .string()
      .max(20)
      .refine(
        (v) => !v || facturaRegex.test(v),
        'Formato de factura inválido. Usá: A-0001-00012345'
      )
      .optional()
      .nullable()
      .or(z.literal('')),
    observaciones: z.string().max(2000).optional().nullable(),
  })
  .refine(
    (data) =>
      !['transferencia', 'cheque'].includes(data.medio_pago) || !!data.referencia_bancaria,
    {
      message: 'La referencia bancaria es obligatoria para transferencias y cheques',
      path: ['referencia_bancaria'],
    }
  );

export const procesarComprasSchema = z.object({
  prioridad_compra: z.enum(['urgente', 'normal', 'programado']),
  dia_pago_programado: z.string().refine((val) => !isNaN(Date.parse(val)), 'Fecha inválida'),
  observaciones: z.string().max(1000).optional().nullable(),
});

export const centroCostoSchema = z.object({
  nombre: nonBlank(2, 'Mínimo 2 caracteres').max(150),
  codigo: z
    .string()
    .min(1, 'Código requerido')
    .max(20)
    .refine(
      (v) => /^[A-Z0-9_-]+$/i.test(v),
      'El código solo puede contener letras, números, guiones y guiones bajos'
    )
    .refine((v) => v.trim() === v, 'El código no puede tener espacios'),
  presupuesto_anual: z.number().nonnegative().max(999_999_999).optional().nullable(),
  presupuesto_mensual: z.number().nonnegative().max(999_999_999).optional().nullable(),
  area_id: z.number().int().positive().optional().nullable(),
});

export const recepcionSchema = z
  .object({
    solicitud_id: z.number().int().positive(),
    conforme: z.boolean(),
    tipo_problema: z.enum(['faltante', 'dañado', 'diferente', 'otro']).optional().nullable(),
    observaciones: z.string().max(2000).optional().nullable(),
    items: z.array(z.object({
      item_solicitud_id: z.number().int().positive(),
      cantidad_recibida: z.number().positive('La cantidad debe ser mayor a 0'),
      conforme: z.boolean().default(true),
      observaciones: z.string().max(500).optional().nullable(),
    })).optional(),
  })
  .refine((data) => data.conforme || (data.tipo_problema && data.observaciones && data.observaciones.trim().length >= 10), {
    message: 'Si no es conforme, indicá el tipo de problema y describí qué pasó (mínimo 10 caracteres)',
  });

export const devolucionSchema = z.object({
  observaciones: nonBlank(10, 'Describí el motivo de la devolución (mínimo 10 caracteres)').max(2000),
});

export const rechazoSchema = z.object({
  motivo: nonBlank(10, 'Escribí el motivo del rechazo (mínimo 10 caracteres)').max(2000),
});
