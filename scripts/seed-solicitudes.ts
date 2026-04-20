/**
 * Seed realistic purchase requests in various states
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-solicitudes.ts
 */
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Load users
  const users = await prisma.usuarios.findMany({
    where: { activo: true },
    include: { usuarios_roles: { include: { rol: true } }, area: true },
  });
  const areas = await prisma.areas.findMany();
  const tenants = await prisma.tenants.findMany({ where: { estado: 'activo' } });

  console.log('\n📋 Existing data:');
  console.log(`  Tenants: ${tenants.map((t) => `${t.id}:${t.nombre}`).join(', ')}`);
  console.log(`  Areas: ${areas.map((a) => `${a.id}:${a.nombre}(t${a.tenant_id})`).join(', ')}`);
  console.log(
    `  Users: ${users.map((u) => `${u.id}:${u.nombre}[${u.usuarios_roles.map((r) => r.rol.nombre).join(',')}](area${u.area_id})`).join(', ')}`,
  );

  if (tenants.length === 0 || users.length === 0) {
    console.log('\n❌ No tenants or users found. Run import-store first.');
    return;
  }

  // Try tenant 4 (Escuela Test) first, which has all roles
  const tenant = tenants.find((t) => t.nombre.includes('Escuela')) ?? tenants[0];
  const tenantId = tenant.id;

  // Find users by role
  const findByRole = (role: string) =>
    users.find(
      (u) => u.tenant_id === tenantId && u.usuarios_roles.some((r) => r.rol.nombre === role),
    );

  const solicitante = users.find(
    (u) =>
      u.tenant_id === tenantId &&
      u.usuarios_roles.some((r) => r.rol.nombre === 'solicitante') &&
      !u.usuarios_roles.some((r) =>
        ['admin', 'director', 'responsable_area', 'compras', 'tesoreria'].includes(r.rol.nombre),
      ),
  );
  const responsable = findByRole('responsable_area');
  const directora = users.find(
    (u) => u.tenant_id === tenantId && u.usuarios_roles.some((r) => r.rol.nombre === 'director'),
  );
  const compras = findByRole('compras');
  const tesoreria = findByRole('tesoreria');

  if (!solicitante || !responsable || !directora) {
    console.log('\n❌ Missing required users (solicitante, responsable, directora)');
    console.log(
      'Available:',
      users.map((u) => `${u.nombre}:[${u.usuarios_roles.map((r) => r.rol.nombre)}]`),
    );
    return;
  }

  console.log(`\n🏫 Using tenant: ${tenant.nombre} (id=${tenantId})`);
  console.log(
    `  Solicitante: ${solicitante.nombre} (id=${solicitante.id}, area=${solicitante.area_id})`,
  );
  console.log(`  Responsable: ${responsable.nombre} (id=${responsable.id})`);
  console.log(`  Directora: ${directora.nombre} (id=${directora.id})`);
  if (compras) console.log(`  Compras: ${compras.nombre} (id=${compras.id})`);
  if (tesoreria) console.log(`  Tesorería: ${tesoreria.nombre} (id=${tesoreria.id})`);

  // Get next numero
  const lastSol = await prisma.solicitudes.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { id: 'desc' },
  });
  let nextNum = lastSol ? parseInt(lastSol.numero?.replace(/\D/g, '') || '0') + 1 : 1;
  const makeNumero = () => `SOL-${String(nextNum++).padStart(5, '0')}`;

  const areaId = solicitante.area_id!;
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

  // Helper to create solicitud + items in one go
  async function createFull(data: {
    numero: string;
    titulo: string;
    descripcion: string;
    justificacion: string;
    urgencia: string;
    estado: string;
    solicitante_id: number;
    area_id: number;
    validado_por_id?: number | null;
    aprobado_por_id?: number | null;
    rechazado_por_id?: number | null;
    procesado_por_id?: number | null;
    fecha_envio?: Date | null;
    fecha_validacion?: Date | null;
    fecha_aprobacion?: Date | null;
    fecha_rechazo?: Date | null;
    fecha_procesamiento?: Date | null;
    dia_pago_programado?: Date | null;
    prioridad_compra?: string | null;
    observaciones_responsable?: string | null;
    observaciones_director?: string | null;
    motivo_rechazo?: string | null;
    centro_costo_id?: number | null;
    created_at?: Date;
    items: { descripcion: string; cantidad: number; unidad: string; precio_estimado: number }[];
  }) {
    const { items, ...solData } = data;
    const sol = await prisma.solicitudes.create({
      data: {
        tenant_id: tenantId,
        ...solData,
        items_solicitud: {
          create: items.map((i) => ({ tenant_id: tenantId, ...i })),
        },
      },
    });
    return sol;
  }

  console.log('\n🌱 Creating solicitudes...\n');

  // ────────────────────────────────────────────────────────────
  // 1. BORRADOR — Pedido de útiles de oficina
  // ────────────────────────────────────────────────────────────
  const s1 = await createFull({
    numero: makeNumero(),
    titulo: 'Útiles de oficina para administración',
    descripcion:
      'Se necesitan útiles de oficina para el área de administración: resmas de papel, carpetas, marcadores y artículos de escritorio varios para el trimestre.',
    justificacion:
      'Stock agotado. Última reposición hace 4 meses. Se necesitan para el funcionamiento diario del área.',
    urgencia: 'normal',
    estado: 'borrador',
    solicitante_id: solicitante.id,
    area_id: areaId,
    created_at: daysAgo(1),
    items: [
      {
        descripcion: 'Resma de papel A4 75g (x500)',
        cantidad: 10,
        unidad: 'resma',
        precio_estimado: 4500,
      },
      {
        descripcion: 'Carpeta oficio con ganchos',
        cantidad: 50,
        unidad: 'unidad',
        precio_estimado: 350,
      },
      {
        descripcion: 'Marcador para pizarra (set x4)',
        cantidad: 12,
        unidad: 'set',
        precio_estimado: 2800,
      },
      {
        descripcion: 'Cinta adhesiva transparente',
        cantidad: 20,
        unidad: 'unidad',
        precio_estimado: 450,
      },
    ],
  });
  console.log(`  ✅ Borrador: "${s1.titulo}" (id=${s1.id})`);

  // ────────────────────────────────────────────────────────────
  // 2. ENVIADA — Material didáctico para laboratorio
  // ────────────────────────────────────────────────────────────
  const s2 = await createFull({
    numero: makeNumero(),
    titulo: 'Material didáctico para laboratorio de ciencias',
    descripcion:
      'Materiales para las prácticas de laboratorio de ciencias naturales del segundo cuatrimestre. Incluye reactivos básicos, vidriería de reposición y elementos de seguridad.',
    justificacion:
      'Necesarios para cumplir con la planificación pedagógica del segundo cuatrimestre. Sin estos materiales no se pueden realizar las prácticas obligatorias.',
    urgencia: 'alta',
    estado: 'enviada',
    solicitante_id: solicitante.id,
    area_id: areaId,
    fecha_envio: daysAgo(3),
    created_at: daysAgo(4),
    items: [
      {
        descripcion: 'Kit de reactivos básicos (ácidos y bases)',
        cantidad: 5,
        unidad: 'kit',
        precio_estimado: 15000,
      },
      {
        descripcion: 'Tubo de ensayo pyrex 20ml (caja x50)',
        cantidad: 3,
        unidad: 'caja',
        precio_estimado: 8500,
      },
      {
        descripcion: 'Guantes de nitrilo talle M (caja x100)',
        cantidad: 5,
        unidad: 'caja',
        precio_estimado: 6200,
      },
      {
        descripcion: 'Gafas de seguridad transparentes',
        cantidad: 30,
        unidad: 'unidad',
        precio_estimado: 3500,
      },
      {
        descripcion: 'Mechero Bunsen a gas',
        cantidad: 4,
        unidad: 'unidad',
        precio_estimado: 12000,
      },
    ],
  });
  console.log(`  ✅ Enviada: "${s2.titulo}" (id=${s2.id})`);

  // ────────────────────────────────────────────────────────────
  // 3. VALIDADA — Equipamiento informático
  // ────────────────────────────────────────────────────────────
  const s3 = await createFull({
    numero: makeNumero(),
    titulo: 'Reposición de teclados y mouse para sala de informática',
    descripcion:
      'Varios equipos periféricos de la sala de informática están dañados o faltan. Se necesita reponer para que todos los puestos estén operativos para los cursos.',
    justificacion:
      'De 25 puestos, 8 tienen teclados rotos y 5 no tienen mouse. Los alumnos deben compartir equipos, afectando el aprendizaje.',
    urgencia: 'normal',
    estado: 'validada',
    solicitante_id: solicitante.id,
    area_id: areaId,
    validado_por_id: responsable.id,
    fecha_envio: daysAgo(7),
    fecha_validacion: daysAgo(5),
    created_at: daysAgo(8),
    items: [
      {
        descripcion: 'Teclado USB español Logitech K120',
        cantidad: 8,
        unidad: 'unidad',
        precio_estimado: 8500,
      },
      {
        descripcion: 'Mouse óptico USB Logitech M100',
        cantidad: 10,
        unidad: 'unidad',
        precio_estimado: 5200,
      },
      {
        descripcion: 'Pad mouse antideslizante',
        cantidad: 25,
        unidad: 'unidad',
        precio_estimado: 1200,
      },
    ],
  });
  console.log(`  ✅ Validada: "${s3.titulo}" (id=${s3.id})`);

  // ────────────────────────────────────────────────────────────
  // 4. EN_COMPRAS — Artículos de limpieza
  // ────────────────────────────────────────────────────────────
  const s4 = await createFull({
    numero: makeNumero(),
    titulo: 'Artículos de limpieza mensual',
    descripcion:
      'Pedido mensual de productos de limpieza e higiene para mantener las instalaciones del establecimiento en condiciones adecuadas.',
    justificacion:
      'Reposición mensual obligatoria según protocolo de higiene. Stock actual para 5 días.',
    urgencia: 'alta',
    estado: 'en_compras',
    solicitante_id: solicitante.id,
    area_id: areaId,
    validado_por_id: responsable.id,
    aprobado_por_id: directora.id,
    fecha_envio: daysAgo(10),
    fecha_validacion: daysAgo(9),
    fecha_aprobacion: daysAgo(7),
    created_at: daysAgo(11),
    items: [
      {
        descripcion: 'Lavandina concentrada 5L',
        cantidad: 20,
        unidad: 'bidón',
        precio_estimado: 2800,
      },
      {
        descripcion: 'Detergente líquido 5L',
        cantidad: 10,
        unidad: 'bidón',
        precio_estimado: 3500,
      },
      {
        descripcion: 'Papel higiénico institucional (bolsón x8)',
        cantidad: 15,
        unidad: 'bolsón',
        precio_estimado: 4200,
      },
      {
        descripcion: 'Bolsas de residuos 80x100 (x100)',
        cantidad: 10,
        unidad: 'paquete',
        precio_estimado: 3800,
      },
      {
        descripcion: 'Jabón líquido para dispenser 5L',
        cantidad: 8,
        unidad: 'bidón',
        precio_estimado: 4500,
      },
      {
        descripcion: 'Alcohol en gel 500ml',
        cantidad: 20,
        unidad: 'unidad',
        precio_estimado: 2200,
      },
    ],
  });
  console.log(`  ✅ En compras: "${s4.titulo}" (id=${s4.id})`);

  // ────────────────────────────────────────────────────────────
  // 5. PAGO_PROGRAMADO — Libros de texto
  // ────────────────────────────────────────────────────────────
  const s5 = compras
    ? await createFull({
        numero: makeNumero(),
        titulo: 'Libros de texto para biblioteca',
        descripcion:
          'Adquisición de ejemplares de los libros de texto adoptados para el ciclo lectivo actual, destinados al programa de préstamo de la biblioteca escolar.',
        justificacion:
          'La biblioteca tiene solo 10 ejemplares por título y hay 35 alumnos por curso. Se necesitan más copias para cubrir la demanda del programa de préstamo.',
        urgencia: 'normal',
        estado: 'pago_programado',
        solicitante_id: solicitante.id,
        area_id: areaId,
        validado_por_id: responsable.id,
        aprobado_por_id: directora.id,
        procesado_por_id: compras.id,
        fecha_envio: daysAgo(15),
        fecha_validacion: daysAgo(14),
        fecha_aprobacion: daysAgo(12),
        fecha_procesamiento: daysAgo(10),
        prioridad_compra: 'normal',
        dia_pago_programado: new Date('2026-04-20'),
        created_at: daysAgo(16),
        items: [
          {
            descripcion: 'Matemática 1 - Ed. Santillana (2026)',
            cantidad: 25,
            unidad: 'unidad',
            precio_estimado: 12000,
          },
          {
            descripcion: 'Lengua y Literatura 1 - Ed. Kapelusz',
            cantidad: 25,
            unidad: 'unidad',
            precio_estimado: 11500,
          },
          {
            descripcion: 'Ciencias Naturales 1 - Ed. Estrada',
            cantidad: 20,
            unidad: 'unidad',
            precio_estimado: 13000,
          },
          {
            descripcion: 'Historia 1 - Ed. Aique',
            cantidad: 20,
            unidad: 'unidad',
            precio_estimado: 10800,
          },
        ],
      })
    : null;
  if (s5) console.log(`  ✅ Pago programado: "${s5.titulo}" (id=${s5.id})`);

  // ────────────────────────────────────────────────────────────
  // 6. ABONADA — Impresora multifunción (esperando entrega)
  // ────────────────────────────────────────────────────────────
  let s6: any = null;
  if (compras && tesoreria) {
    s6 = await createFull({
      numero: makeNumero(),
      titulo: 'Impresora multifunción para secretaría',
      descripcion:
        'La impresora actual de secretaría tiene fallas constantes y el costo de reparación supera el 60% del valor de una nueva. Se solicita reemplazo.',
      justificacion:
        'La impresora HP LaserJet Pro de secretaría tiene 7 años de uso y falla semanalmente. El servicio técnico indicó que no conviene repararla.',
      urgencia: 'urgente',
      estado: 'abonada',
      solicitante_id: solicitante.id,
      area_id: areaId,
      validado_por_id: responsable.id,
      aprobado_por_id: directora.id,
      procesado_por_id: compras.id,
      fecha_envio: daysAgo(20),
      fecha_validacion: daysAgo(19),
      fecha_aprobacion: daysAgo(17),
      fecha_procesamiento: daysAgo(15),
      prioridad_compra: 'urgente',
      dia_pago_programado: new Date('2026-04-01'),
      created_at: daysAgo(21),
      items: [
        {
          descripcion: 'Impresora multifunción HP LaserJet Pro MFP M428fdw',
          cantidad: 1,
          unidad: 'unidad',
          precio_estimado: 450000,
        },
        {
          descripcion: 'Tóner original HP 58A (x2)',
          cantidad: 2,
          unidad: 'unidad',
          precio_estimado: 85000,
        },
        {
          descripcion: 'Cable USB tipo A-B 2m',
          cantidad: 1,
          unidad: 'unidad',
          precio_estimado: 2500,
        },
      ],
    });

    // Create the compra record
    await prisma.compras.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s6.id,
        ejecutado_por_id: tesoreria.id,
        proveedor_nombre: 'Librería y Tecnología Escolar SRL',
        fecha_compra: daysAgo(8),
        monto_total: 535000,
        medio_pago: 'transferencia',
        referencia_bancaria: 'TRF-20260401-001',
        numero_factura: 'A-0001-00045892',
        created_at: daysAgo(8),
      },
    });
    console.log(`  ✅ Abonada: "${s6.titulo}" (id=${s6.id})`);
  }

  // ────────────────────────────────────────────────────────────
  // 7. CERRADA — Sillas para aulas (completada exitosamente)
  // ────────────────────────────────────────────────────────────
  if (compras && tesoreria) {
    const s7 = await createFull({
      numero: makeNumero(),
      titulo: 'Sillas escolares para aula 3B',
      descripcion:
        'Reposición de sillas escolares rotas del aula 3B. Se detectaron durante la inspección de inicio de ciclo lectivo.',
      justificacion:
        '12 sillas del aula 3B están rotas y representan un riesgo para los alumnos. El aula tiene capacidad para 35 y quedan solo 23 sillas en buen estado.',
      urgencia: 'alta',
      estado: 'cerrada',
      solicitante_id: solicitante.id,
      area_id: areaId,
      validado_por_id: responsable.id,
      aprobado_por_id: directora.id,
      procesado_por_id: compras.id,
      fecha_envio: daysAgo(30),
      fecha_validacion: daysAgo(29),
      fecha_aprobacion: daysAgo(27),
      fecha_procesamiento: daysAgo(25),
      prioridad_compra: 'urgente',
      dia_pago_programado: new Date('2026-03-15'),
      created_at: daysAgo(31),
      items: [
        {
          descripcion: 'Silla escolar apilable estructura metálica',
          cantidad: 12,
          unidad: 'unidad',
          precio_estimado: 35000,
        },
      ],
    });

    await prisma.compras.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s7.id,
        ejecutado_por_id: tesoreria.id,
        proveedor_nombre: 'Muebles Escolares Pampa SA',
        fecha_compra: daysAgo(20),
        monto_total: 396000,
        medio_pago: 'transferencia',
        referencia_bancaria: 'TRF-20260315-003',
        numero_factura: 'A-0003-00012784',
        created_at: daysAgo(20),
      },
    });

    await prisma.recepciones.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s7.id,
        receptor_id: solicitante.id,
        conforme: true,
        fecha_recepcion: daysAgo(15),
        created_at: daysAgo(15),
      },
    });
    console.log(`  ✅ Cerrada: "${s7.titulo}" (id=${s7.id})`);
  }

  // ────────────────────────────────────────────────────────────
  // 8. RECHAZADA — Aire acondicionado
  // ────────────────────────────────────────────────────────────
  const s8 = await createFull({
    numero: makeNumero(),
    titulo: 'Aire acondicionado para sala de profesores',
    descripcion:
      'Instalación de un equipo de aire acondicionado split frío/calor en la sala de profesores, que actualmente no cuenta con climatización.',
    justificacion:
      'En verano la sala supera los 35°C, afectando las condiciones de trabajo. Los docentes evitan usar la sala.',
    urgencia: 'normal',
    estado: 'rechazada',
    solicitante_id: solicitante.id,
    area_id: areaId,
    validado_por_id: responsable.id,
    rechazado_por_id: directora.id,
    fecha_envio: daysAgo(25),
    fecha_validacion: daysAgo(24),
    fecha_rechazo: daysAgo(22),
    motivo_rechazo:
      'El presupuesto anual de infraestructura ya fue comprometido. Se reprogramará para el ejercicio del año próximo.',
    created_at: daysAgo(26),
    items: [
      {
        descripcion: 'Aire acondicionado split 4500 frigorías frío/calor',
        cantidad: 1,
        unidad: 'unidad',
        precio_estimado: 650000,
      },
      {
        descripcion: 'Instalación y materiales (caño, cable, soporte)',
        cantidad: 1,
        unidad: 'servicio',
        precio_estimado: 120000,
      },
    ],
  });
  console.log(`  ✅ Rechazada: "${s8.titulo}" (id=${s8.id})`);

  // ────────────────────────────────────────────────────────────
  // 9. ANULADA — Proyector (cancelado por el solicitante)
  // ────────────────────────────────────────────────────────────
  const s9 = await createFull({
    numero: makeNumero(),
    titulo: 'Proyector para aula magna',
    descripcion:
      'Adquisición de un proyector de alta luminosidad para el aula magna, para presentaciones y actos escolares.',
    justificacion: 'El proyector actual tiene la lámpara quemada y el modelo está descontinuado.',
    urgencia: 'normal',
    estado: 'anulada',
    solicitante_id: solicitante.id,
    area_id: areaId,
    validado_por_id: responsable.id,
    fecha_envio: daysAgo(18),
    fecha_validacion: daysAgo(17),
    created_at: daysAgo(19),
    items: [
      {
        descripcion: 'Proyector Epson PowerLite 2250U 5000 lúmenes',
        cantidad: 1,
        unidad: 'unidad',
        precio_estimado: 890000,
      },
      {
        descripcion: 'Soporte de techo universal para proyector',
        cantidad: 1,
        unidad: 'unidad',
        precio_estimado: 25000,
      },
      {
        descripcion: 'Cable HDMI 10m alta velocidad',
        cantidad: 1,
        unidad: 'unidad',
        precio_estimado: 8500,
      },
    ],
  });
  console.log(`  ✅ Anulada: "${s9.titulo}" (id=${s9.id})`);

  // ────────────────────────────────────────────────────────────
  // 10. DEVUELTA_RESP — Pedido de material deportivo
  // ────────────────────────────────────────────────────────────
  const s10 = await createFull({
    numero: makeNumero(),
    titulo: 'Material deportivo para educación física',
    descripcion:
      'Reposición de pelotas, colchonetas y elementos deportivos para las clases de educación física.',
    justificacion:
      'Las pelotas de básquet y vóley están desinfladas y las colchonetas tienen roturas. Se necesitan para las clases regulares.',
    urgencia: 'normal',
    estado: 'devuelta_resp',
    solicitante_id: solicitante.id,
    area_id: areaId,
    observaciones_responsable:
      'Faltan las especificaciones técnicas de las colchonetas (grosor, material, densidad). Además, verificar si hay stock en el depósito antes de pedir.',
    fecha_envio: daysAgo(5),
    created_at: daysAgo(6),
    items: [
      {
        descripcion: 'Pelota de básquet Nº7 oficial',
        cantidad: 6,
        unidad: 'unidad',
        precio_estimado: 18000,
      },
      {
        descripcion: 'Pelota de vóley oficial',
        cantidad: 6,
        unidad: 'unidad',
        precio_estimado: 15000,
      },
      {
        descripcion: 'Colchoneta gimnasia 1x0.5m',
        cantidad: 10,
        unidad: 'unidad',
        precio_estimado: 22000,
      },
      {
        descripcion: 'Set de conos de señalización (x20)',
        cantidad: 2,
        unidad: 'set',
        precio_estimado: 8500,
      },
    ],
  });
  console.log(`  ✅ Devuelta resp: "${s10.titulo}" (id=${s10.id})`);

  // ────────────────────────────────────────────────────────────
  // 11. DEVUELTA_DIR — Equipamiento de cocina
  // ────────────────────────────────────────────────────────────
  const s11 = await createFull({
    numero: makeNumero(),
    titulo: 'Equipamiento para cocina del comedor escolar',
    descripcion:
      'Reposición de ollas, sartenes y utensilios del comedor escolar que están deteriorados por el uso diario.',
    justificacion:
      'El comedor atiende 200 alumnos diarios. Las ollas grandes tienen filtraciones y se necesitan utensilios nuevos para cumplir con las normas de bromatología.',
    urgencia: 'alta',
    estado: 'devuelta_dir',
    solicitante_id: solicitante.id,
    area_id: areaId,
    validado_por_id: responsable.id,
    observaciones_director:
      'El monto total es elevado. Solicito que se divida en dos compras: primero las ollas (prioritario) y en el mes siguiente los utensilios menores.',
    fecha_envio: daysAgo(8),
    fecha_validacion: daysAgo(7),
    created_at: daysAgo(9),
    items: [
      {
        descripcion: 'Olla industrial acero inox 50L',
        cantidad: 3,
        unidad: 'unidad',
        precio_estimado: 85000,
      },
      {
        descripcion: 'Sartén industrial 40cm',
        cantidad: 4,
        unidad: 'unidad',
        precio_estimado: 32000,
      },
      {
        descripcion: 'Set de cucharones industriales (x6)',
        cantidad: 2,
        unidad: 'set',
        precio_estimado: 15000,
      },
      {
        descripcion: 'Tabla de corte polietileno 50x30',
        cantidad: 6,
        unidad: 'unidad',
        precio_estimado: 8500,
      },
    ],
  });
  console.log(`  ✅ Devuelta dir: "${s11.titulo}" (id=${s11.id})`);

  // ────────────────────────────────────────────────────────────
  // 12. RECIBIDA_CON_OBS — Cortinas (recibido con problema)
  // ────────────────────────────────────────────────────────────
  if (compras && tesoreria) {
    const s12 = await createFull({
      numero: makeNumero(),
      titulo: 'Cortinas roller para aulas planta baja',
      descripcion:
        'Instalación de cortinas roller blackout en las 6 aulas de planta baja que dan al oeste, donde el sol de la tarde impide ver el pizarrón.',
      justificacion:
        'Los alumnos de las aulas 1A a 3B no pueden ver el pizarrón ni la pantalla del proyector entre las 14:00 y 17:00 por el reflejo solar.',
      urgencia: 'normal',
      estado: 'recibida_con_obs',
      solicitante_id: solicitante.id,
      area_id: areaId,
      validado_por_id: responsable.id,
      aprobado_por_id: directora.id,
      procesado_por_id: compras.id,
      fecha_envio: daysAgo(35),
      fecha_validacion: daysAgo(34),
      fecha_aprobacion: daysAgo(32),
      fecha_procesamiento: daysAgo(30),
      prioridad_compra: 'normal',
      dia_pago_programado: new Date('2026-03-10'),
      created_at: daysAgo(36),
      items: [
        {
          descripcion: 'Cortina roller blackout 1.50x2.00m color gris',
          cantidad: 12,
          unidad: 'unidad',
          precio_estimado: 28000,
        },
        {
          descripcion: 'Instalación por ventana',
          cantidad: 12,
          unidad: 'servicio',
          precio_estimado: 5000,
        },
      ],
    });

    await prisma.compras.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s12.id,
        ejecutado_por_id: tesoreria.id,
        proveedor_nombre: 'Cortinas & Decoración del Sur',
        fecha_compra: daysAgo(25),
        monto_total: 380000,
        medio_pago: 'cheque',
        referencia_bancaria: 'CHQ-20260310-001',
        numero_factura: 'B-0015-00008341',
        created_at: daysAgo(25),
      },
    });

    await prisma.recepciones.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s12.id,
        receptor_id: solicitante.id,
        conforme: false,
        tipo_problema: 'faltante',
        observaciones:
          'Se instalaron 10 de 12 cortinas. Faltan las del aula 2B y 3A. El proveedor indicó que las tiene en backorder y entrega en 7 días.',
        fecha_recepcion: daysAgo(10),
        created_at: daysAgo(10),
      },
    });
    console.log(`  ✅ Recibida con obs: "${s12.titulo}" (id=${s12.id})`);
  }

  // ────────────────────────────────────────────────────────────
  // 13. Another BORRADOR — Pedido urgente de tóner
  // ────────────────────────────────────────────────────────────
  const s13 = await createFull({
    numero: makeNumero(),
    titulo: 'Tóner para impresoras de dirección y secretaría',
    descripcion:
      'Pedido urgente de tóner para las impresoras de dirección y secretaría que están por quedarse sin tinta.',
    justificacion:
      'La impresora de secretaría está imprimiendo borroso y la de dirección muestra alerta de tóner bajo. Se necesitan para la emisión de boletines.',
    urgencia: 'urgente',
    estado: 'borrador',
    solicitante_id: solicitante.id,
    area_id: areaId,
    created_at: daysAgo(0),
    items: [
      {
        descripcion: 'Tóner HP 26A original',
        cantidad: 2,
        unidad: 'unidad',
        precio_estimado: 45000,
      },
      {
        descripcion: 'Tóner Brother TN-2370 original',
        cantidad: 1,
        unidad: 'unidad',
        precio_estimado: 38000,
      },
    ],
  });
  console.log(`  ✅ Borrador (urgente): "${s13.titulo}" (id=${s13.id})`);

  // ────────────────────────────────────────────────────────────
  // 14. CERRADA (segunda) — Pintura de aulas
  // ────────────────────────────────────────────────────────────
  if (compras && tesoreria) {
    const s14 = await createFull({
      numero: makeNumero(),
      titulo: 'Pintura y materiales para reacondicionar aulas',
      descripcion:
        'Compra de pintura látex, rodillos y materiales para pintar las 4 aulas de segundo piso que fueron pintadas por última vez hace 3 años.',
      justificacion:
        'Las paredes están descascaradas y con manchas de humedad. Se acordó con la cooperadora que los padres voluntarios pintarán las aulas el sábado.',
      urgencia: 'normal',
      estado: 'cerrada',
      solicitante_id: solicitante.id,
      area_id: areaId,
      validado_por_id: responsable.id,
      aprobado_por_id: directora.id,
      procesado_por_id: compras.id,
      fecha_envio: daysAgo(40),
      fecha_validacion: daysAgo(39),
      fecha_aprobacion: daysAgo(37),
      fecha_procesamiento: daysAgo(35),
      prioridad_compra: 'programado',
      dia_pago_programado: new Date('2026-03-05'),
      created_at: daysAgo(41),
      items: [
        {
          descripcion: 'Pintura látex interior blanca 20L',
          cantidad: 8,
          unidad: 'lata',
          precio_estimado: 32000,
        },
        {
          descripcion: 'Rodillo lana 23cm con marco',
          cantidad: 10,
          unidad: 'unidad',
          precio_estimado: 3500,
        },
        {
          descripcion: 'Cinta de enmascarar 24mm (x6)',
          cantidad: 5,
          unidad: 'pack',
          precio_estimado: 4800,
        },
        {
          descripcion: 'Lija al agua nº120 (x10)',
          cantidad: 3,
          unidad: 'pack',
          precio_estimado: 2200,
        },
        { descripcion: 'Enduido plástico 4kg', cantidad: 4, unidad: 'pote', precio_estimado: 5500 },
      ],
    });

    await prisma.compras.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s14.id,
        ejecutado_por_id: tesoreria.id,
        proveedor_nombre: 'Pinturas El Arco Iris',
        fecha_compra: daysAgo(30),
        monto_total: 315000,
        medio_pago: 'efectivo',
        created_at: daysAgo(30),
      },
    });

    await prisma.recepciones.create({
      data: {
        tenant_id: tenantId,
        solicitud_id: s14.id,
        receptor_id: solicitante.id,
        conforme: true,
        fecha_recepcion: daysAgo(28),
        created_at: daysAgo(28),
      },
    });
    console.log(`  ✅ Cerrada: "${s14.titulo}" (id=${s14.id})`);
  }

  const total = await prisma.solicitudes.count({ where: { tenant_id: tenantId } });
  console.log(`\n✅ Done! Total solicitudes in DB: ${total}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
