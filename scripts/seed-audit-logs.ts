import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function seed() {
  const tenant = await prisma.tenants.findFirst({ where: { slug: 'colegio-demo' } });
  if (!tenant) {
    console.log('No tenant found');
    return;
  }

  const users = await prisma.usuarios.findMany({ where: { tenant_id: tenant.id }, take: 5 });
  if (users.length === 0) {
    console.log('No users found');
    return;
  }

  const solicitudes = await prisma.solicitudes.findMany({
    where: { tenant_id: tenant.id },
    take: 5,
  });
  const now = Date.now();
  const logs: any[] = [];

  // Login events
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'login_exitoso',
    entidad: 'sesion',
    datos_nuevos: { metodo: 'credentials' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 5),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[1].id,
    accion: 'login_exitoso',
    entidad: 'sesion',
    datos_nuevos: { metodo: 'google' },
    ip_address: '190.12.33.44',
    created_at: new Date(now - 1000 * 60 * 15),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'login_exitoso',
    entidad: 'sesion',
    datos_nuevos: { metodo: 'microsoft-entra-id' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60),
  });

  // Failed logins (critical)
  for (let i = 0; i < 5; i++) {
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[0].id,
      accion: 'login_fallido',
      entidad: 'sesion',
      datos_nuevos: { email: 'hacker@test.com', metodo: 'credentials' },
      ip_address: '45.33.12.99',
      created_at: new Date(now - 1000 * 60 * (30 - i)),
    });
  }

  // Solicitud lifecycle
  if (solicitudes.length > 0) {
    const s = solicitudes[0];
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[0].id,
      accion: 'crear_solicitud',
      entidad: 'solicitud',
      entidad_id: s.id,
      datos_nuevos: { titulo: s.titulo },
      ip_address: '181.47.22.105',
      created_at: new Date(now - 1000 * 60 * 60 * 2),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[0].id,
      accion: 'enviar_solicitud',
      entidad: 'solicitud',
      entidad_id: s.id,
      ip_address: '181.47.22.105',
      created_at: new Date(now - 1000 * 60 * 60 * 1.9),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[2]?.id || users[0].id,
      accion: 'validar_solicitud',
      entidad: 'solicitud',
      entidad_id: s.id,
      ip_address: '192.168.1.50',
      created_at: new Date(now - 1000 * 60 * 60 * 1.5),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[0].id,
      accion: 'aprobar_solicitud',
      entidad: 'solicitud',
      entidad_id: s.id,
      datos_nuevos: { monto: 152000 },
      ip_address: '181.47.22.105',
      created_at: new Date(now - 1000 * 60 * 60 * 1),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[3]?.id || users[0].id,
      accion: 'registrar_compra',
      entidad: 'solicitud',
      entidad_id: s.id,
      datos_nuevos: { monto_total: 148500, proveedor: 'Librería Central' },
      ip_address: '10.0.0.15',
      created_at: new Date(now - 1000 * 60 * 45),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[1].id,
      accion: 'confirmar_recepcion',
      entidad: 'solicitud',
      entidad_id: s.id,
      datos_nuevos: { conforme: true },
      ip_address: '190.12.33.44',
      created_at: new Date(now - 1000 * 60 * 20),
    });
  }

  if (solicitudes.length > 1) {
    const s = solicitudes[1];
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[0].id,
      accion: 'rechazar_solicitud',
      entidad: 'solicitud',
      entidad_id: s.id,
      datos_nuevos: { motivo: 'Presupuesto insuficiente para este trimestre' },
      ip_address: '181.47.22.105',
      created_at: new Date(now - 1000 * 60 * 60 * 3),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[2]?.id || users[1].id,
      accion: 'devolver_solicitud',
      entidad: 'solicitud',
      entidad_id: s.id,
      datos_nuevos: { motivo: 'Falta justificación detallada y cotización' },
      ip_address: '190.12.33.44',
      created_at: new Date(now - 1000 * 60 * 60 * 4),
    });
  }

  if (solicitudes.length > 2) {
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[0].id,
      accion: 'anular_solicitud',
      entidad: 'solicitud',
      entidad_id: solicitudes[2].id,
      datos_nuevos: { motivo: 'Solicitud duplicada, ya existe una similar aprobada' },
      ip_address: '181.47.22.105',
      created_at: new Date(now - 1000 * 60 * 60 * 5),
    });
  }

  // Bulk approve (critical)
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'aprobar_masivo',
    entidad: 'solicitud',
    datos_nuevos: { cantidad: 5, ids: [10, 11, 12, 13, 14] },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 8),
  });

  // User management
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'crear_usuario',
    entidad: 'usuario',
    entidad_id: users[1].id,
    datos_nuevos: { nombre: users[1].nombre, email: users[1].email, roles: ['solicitante'] },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 24),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'editar_usuario',
    entidad: 'usuario',
    entidad_id: users[2]?.id || users[1].id,
    datos_anteriores: { roles: ['solicitante'] },
    datos_nuevos: { roles: ['responsable_area', 'solicitante'] },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 20),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'desactivar_usuario',
    entidad: 'usuario',
    entidad_id: users[4]?.id || users[1].id,
    datos_anteriores: { activo: true, nombre: 'Usuario Desactivado' },
    datos_nuevos: { activo: false },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 10),
  });

  // Delegation (critical)
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'crear_delegacion',
    entidad: 'delegacion',
    datos_nuevos: {
      delegante: users[0].nombre,
      delegado: users[1].nombre,
      rol: 'director',
      hasta: '2026-04-15',
    },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 12),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'desactivar_delegacion',
    entidad: 'delegacion',
    datos_anteriores: { delegado: users[1].nombre, rol: 'director' },
    datos_nuevos: { motivo: 'Regreso de licencia' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 6),
  });

  // Area & proveedor management
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'crear_area',
    entidad: 'area',
    datos_nuevos: { nombre: 'Laboratorio', responsable: 'Prof. García' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 48),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'editar_area',
    entidad: 'area',
    datos_anteriores: { responsable: null },
    datos_nuevos: { responsable: 'Prof. Martínez' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 40),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'crear_proveedor',
    entidad: 'proveedor',
    datos_nuevos: { nombre: 'Librería Central', cuit: '30-71234567-9' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 36),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'editar_proveedor',
    entidad: 'proveedor',
    datos_anteriores: { telefono: null },
    datos_nuevos: { telefono: '011-4555-1234' },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 35),
  });

  // Centro de costo
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'crear_centro_costo',
    entidad: 'centro_costo',
    datos_nuevos: { nombre: 'Mantenimiento', codigo: 'MNT-001', presupuesto_anual: 500000 },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 30),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[0].id,
    accion: 'editar_centro_costo',
    entidad: 'centro_costo',
    datos_anteriores: { presupuesto_anual: 500000 },
    datos_nuevos: { presupuesto_anual: 750000 },
    ip_address: '181.47.22.105',
    created_at: new Date(now - 1000 * 60 * 60 * 25),
  });

  // Password change & email verification
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[1].id,
    accion: 'cambiar_password',
    entidad: 'usuario',
    entidad_id: users[1].id,
    ip_address: '190.12.33.44',
    created_at: new Date(now - 1000 * 60 * 60 * 6),
  });
  logs.push({
    tenant_id: tenant.id,
    usuario_id: users[1].id,
    accion: 'verificar_email',
    entidad: 'usuario',
    entidad_id: users[1].id,
    ip_address: '190.12.33.44',
    created_at: new Date(now - 1000 * 60 * 60 * 24 * 2),
  });

  // Procesar compras & programar pago
  if (solicitudes.length > 0) {
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[3]?.id || users[0].id,
      accion: 'procesar_compras',
      entidad: 'solicitud',
      entidad_id: solicitudes[0].id,
      datos_nuevos: { prioridad: 'normal', dia_pago: '2026-04-15' },
      ip_address: '10.0.0.15',
      created_at: new Date(now - 1000 * 60 * 60 * 1.2),
    });
    logs.push({
      tenant_id: tenant.id,
      usuario_id: users[4]?.id || users[0].id,
      accion: 'programar_pago',
      entidad: 'solicitud',
      entidad_id: solicitudes[0].id,
      datos_nuevos: { prioridad: 'urgente', fecha_pago: '2026-04-12' },
      ip_address: '10.0.0.20',
      created_at: new Date(now - 1000 * 60 * 50),
    });
  }

  await prisma.log_auditoria.createMany({ data: logs });
  console.log(`Created ${logs.length} audit log entries`);
}

seed()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });
