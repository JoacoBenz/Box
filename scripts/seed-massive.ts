/**
 * Massive seed: 2+ new areas, multiple users, 200+ solicitudes, 150+ products
 * Run: set -a && source .env.local && set +a && npx tsx scripts/seed-massive.ts
 */
import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { writeFileSync } from 'fs';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });
const TENANT = 4;
const PASS = bcrypt.hashSync('Test1234!', 10);

// ────────── Product catalog (150+ unique products across areas) ──────────
const PRODUCTOS_ADMIN = [
  'Resma de papel A4 75gr',
  'Resma de papel A4 80gr',
  'Resma de papel Oficio',
  'Tóner HP LaserJet 107a',
  'Tóner HP LaserJet 135w',
  'Cartucho Epson 544 negro',
  'Cartucho Epson 544 color',
  'Cinta adhesiva 48mm transparente',
  'Cinta de embalar 48mm marrón',
  'Sobres manila A4 (x100)',
  'Sobres blancos carta (x100)',
  'Carpeta colgante oficio (x25)',
  'Carpeta plástica con clip A4',
  'Bibliorato oficio lomo ancho',
  'Abrochadora Maped 24/6',
  'Broches 24/6 (x5000)',
  'Clips nº4 (x100)',
  'Clips mariposa (x50)',
  'Sacapuntas metálico doble',
  'Goma de borrar Staedtler',
  'Lápiz negro HB Faber (x12)',
  'Birome azul Bic (x50)',
  'Birome negra Bic (x50)',
  'Marcador permanente negro (x12)',
  'Resaltador amarillo (x10)',
  'Corrector líquido tipo lapicera',
  'Regla metálica 30cm',
  'Tijera Maped 21cm',
  'Cutter retráctil grande',
  'Pegamento en barra 40gr (x12)',
  'Voligoma 30ml',
  'Almohadilla para sellos azul',
  'Folio A4 transparente (x100)',
  'Separadores plásticos A4 (x10)',
  'Post-it 76x76mm (x12 blocks)',
  'Cuaderno A4 tapa dura 96 hojas',
  'Cuaderno espiralado A4 120 hojas',
  'Calculadora Casio de escritorio',
  'Perforadora de 2 agujeros',
  'Apoya muñeca ergonómico',
  'Mouse pad con gel',
  'Organizador de escritorio acrílico',
  'Bandeja apilable para papeles (x3)',
  'Porta lapiceros de metal',
  'Pizarra blanca 60x90cm',
  'Marcador para pizarra (x4 colores)',
  'Borrador para pizarra magnético',
];

const PRODUCTOS_DOCENTES = [
  'Tiza blanca (caja x100)',
  'Tiza color (caja x100)',
  'Marcador para pizarrón verde',
  'Fibra Carioca (x12)',
  'Fibra Faber gruesa (x12)',
  'Plasticola 250ml',
  'Témpera escolar (set 6 colores)',
  'Acuarela escolar 12 pastillas',
  'Pincel chato nº10 (x12)',
  'Pincel redondo nº6 (x12)',
  'Hojas canson blanca A4 (x100)',
  'Hojas canson color A4 (x100)',
  'Cartulina blanca 50x70 (x50)',
  'Cartulina color 50x70 (x50)',
  'Papel glasé (x100 hojas)',
  'Papel crepé (x10 rollos)',
  'Goma EVA lisa (x10 planchas)',
  'Goma EVA con glitter (x10)',
  'Tijera escolar punta roma (x30)',
  'Pegamento vinílico 1L',
  'Cinta papel 24mm (x6)',
  'Compás escolar metálico (x10)',
  'Escuadra 45° 20cm (x10)',
  'Transportador 180° (x10)',
  'Mapas Argentina político (x50)',
  'Mapas planisferio (x50)',
  'Globo terráqueo 30cm',
  'Diccionario español escolar',
  'Atlas geográfico escolar',
  'Lámina cuerpo humano',
  'Lámina sistema solar',
  'Juego de geometría magnético',
  'Libro registro asistencia',
  'Planilla calificaciones (x100)',
  'Cuaderno comunicaciones (x50)',
  'Carpeta de alumno A4 (x50)',
  'Hoja de examen oficio (x500)',
  'Block de dibujo A3 (x30)',
  'Crayones cera gruesos (x12 cajas)',
  'Masa para modelar (x6 colores)',
  'Bastidor para pintura 30x40 (x10)',
  'Acrílico escolar (set 6 colores)',
  'Punzón escolar (x30)',
  'Base para punzar (x30)',
  'Abecedario de madera magnético',
  'Juego didáctico números (x5)',
  'Rompecabezas educativo (x10)',
  'Dominó de fracciones',
];

const PRODUCTOS_MANTENIMIENTO = [
  'Pintura látex interior blanca 20L',
  'Pintura látex exterior blanca 20L',
  'Pintura esmalte sintético negro 4L',
  'Rodillo lana 23cm con marco',
  'Bandeja para pintura plástica',
  'Pincel 2" cerda natural',
  'Lija al agua nº80 (x10)',
  'Lija al agua nº120 (x10)',
  'Enduido plástico 4kg',
  'Cemento Portland 50kg',
  'Arena gruesa (bolsa 50kg)',
  'Cal hidráulica 30kg',
  'Cerámica piso 30x30 gris (m²)',
  'Adhesivo para cerámicos 30kg',
  'Pastina gris 5kg',
  'Caño PVC 110mm x 4m',
  'Caño agua fría 1/2" x 4m',
  'Codo PVC 110mm 90°',
  'Válvula esférica 1/2"',
  'Cinta teflón (x10)',
  'Silicona selladora transparente 280ml',
  'Candado bronce 40mm',
  'Cerradura de embutir',
  'Bisagra de acero 3" (par)',
  'Tornillo autoperforante (x500)',
  'Tarugos nº8 (x100)',
  'Clavos 2" (kg)',
  'Cable unipolar 2.5mm² (100m)',
  'Tubo LED 18W 120cm (x10)',
  'Lámpara LED 10W E27 (x20)',
  'Interruptor exterior',
  'Tomacorriente doble',
  'Caja de paso 10x10cm',
  'Matafuego ABC 5kg recarga',
  'Manguera reforzada 1/2" (25m)',
  'Rociador automático para jardín',
  'Cortadora de césped a nafta',
  'Rastrillo metálico',
  'Pala ancha con mango',
  'Carretilla de obra',
  'Escalera aluminio 7 escalones',
  'Taladro percutor 13mm',
  'Amoladora angular 115mm',
  'Juego llaves combinadas 8-22mm',
  'Juego destornilladores (x6)',
  'Cinta métrica 5m',
  'Nivel de burbuja 60cm',
  'Guantes de trabajo (x12 pares)',
];

const PRODUCTOS_LABORATORIO = [
  'Tubo de ensayo 20ml (x50)',
  'Vaso precipitado 250ml (x10)',
  'Matraz Erlenmeyer 500ml (x5)',
  'Probeta graduada 100ml (x5)',
  'Pipeta graduada 10ml (x10)',
  'Mechero Bunsen',
  'Trípode metálico',
  'Rejilla con asbesto',
  'Pinza para tubo de ensayo (x10)',
  'Gradilla para tubos (x5)',
  'Microscopio óptico binocular',
  'Portaobjetos (caja x100)',
  'Cubreobjetos (caja x100)',
  'Lupa de mano 10x (x10)',
  'Balanza digital 0.01g',
  'Termómetro de laboratorio (x10)',
  'Embudo de vidrio 75mm (x5)',
  'Papel de filtro (x100)',
  'Alcohol etílico 96° (5L)',
  'Agua destilada (5L)',
  'Ácido clorhídrico 1M (1L)',
  'Hidróxido de sodio 1M (1L)',
  'Indicador fenolftaleína (100ml)',
  'Papel tornasol (x200)',
  'Guantes de nitrilo (caja x100)',
  'Gafas de seguridad (x15)',
  'Delantal de laboratorio (x15)',
  'Modelo anatómico torso',
  'Esqueleto humano articulado',
  'Kit de disección',
];

const PRODUCTOS_DEPORTES = [
  'Pelota de fútbol nº5 (x5)',
  'Pelota de vóley Penalty (x5)',
  'Pelota de básquet nº7 (x3)',
  'Pelota de handball nº2 (x5)',
  'Red de vóley reglamentaria',
  'Red de fútbol 7 (par)',
  'Red de básquet (par)',
  'Conos de entrenamiento (x20)',
  'Vallas de entrenamiento (x10)',
  'Colchoneta gimnasia 1x0.5m (x20)',
  'Soga de saltar (x15)',
  'Aros de gimnasia (x15)',
  'Pechera entrenamiento (x20)',
  'Silbato con cordón (x5)',
  'Cronómetro digital (x3)',
  'Bomba infladora con aguja',
  'Bolsa porta pelotas',
  'Cinta demarcatoria cancha',
  'Arco de fútbol desarmable',
  'Testimonio de posta (x8)',
  'Disco de atletismo 1kg (x3)',
  'Bala de atletismo 3kg (x3)',
  'Raqueta de bádminton (x10)',
  'Gallito de bádminton (x12)',
  'Bastón de hockey (x15)',
  'Bocha de hockey (x10)',
];

const PROVEEDORES = [
  {
    nombre: 'Librería El Estudiante',
    cuit: '30-71234567-8',
    email: 'ventas@elestudiante.com.ar',
    telefono: '011-4567-8901',
  },
  {
    nombre: 'Distribuidora Papelera del Sur',
    cuit: '30-71345678-9',
    email: 'info@papeleradelsur.com.ar',
    telefono: '011-4678-9012',
  },
  {
    nombre: 'Ferretería Industrial López',
    cuit: '20-28456789-1',
    email: 'lopez@ferreterialopez.com.ar',
    telefono: '011-4789-0123',
  },
  {
    nombre: 'Sanitarios y Plomería San Martín',
    cuit: '30-71567890-2',
    email: 'contacto@sanmartin.com.ar',
    telefono: '011-4890-1234',
  },
  {
    nombre: 'Pinturerías Color Total',
    cuit: '30-71678901-3',
    email: 'ventas@colortotal.com.ar',
    telefono: '011-4901-2345',
  },
  {
    nombre: 'Didáctica Escolar SRL',
    cuit: '30-71789012-4',
    email: 'info@didacticaescolar.com.ar',
    telefono: '011-5012-3456',
  },
  {
    nombre: 'Scientific Lab Supplies',
    cuit: '30-71890123-5',
    email: 'lab@scientific.com.ar',
    telefono: '011-5123-4567',
  },
  {
    nombre: 'Deportes Olímpicos SA',
    cuit: '30-71901234-6',
    email: 'ventas@deportesolimpicos.com.ar',
    telefono: '011-5234-5678',
  },
  {
    nombre: 'Mayorista Escolar Buenos Aires',
    cuit: '30-72012345-7',
    email: 'mayorista@escolarba.com.ar',
    telefono: '011-5345-6789',
  },
  {
    nombre: 'Electro Materiales del Centro',
    cuit: '20-31123456-8',
    email: 'info@electromateriales.com.ar',
    telefono: '011-5456-7890',
  },
];

const URGENCIAS = [
  'normal',
  'normal',
  'normal',
  'normal',
  'urgente',
  'urgente',
  'critica',
] as const;
const ESTADOS_CERRADA = ['cerrada'] as const;
const JUSTIFICACIONES = [
  'Necesario para el funcionamiento diario del área',
  'Stock agotado, se requiere reposición urgente',
  'Pedido recurrente mensual para abastecimiento',
  'Requerido para actividad programada la próxima semana',
  'Material indispensable para las clases',
  'Reparación necesaria para mantener las instalaciones',
  'Insumo de seguridad obligatorio por normativa',
  'Reemplazo de material deteriorado por uso',
  'Preparación para evento escolar próximo',
  'Compra planificada del trimestre',
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randomPrice(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}
function randomQty(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}
let solicitudCounter = 100; // start high to avoid conflicts

async function main() {
  console.log('🚀 Starting massive seed for tenant', TENANT);

  // ── 1. Create new areas ──
  console.log('\n📁 Creating areas...');
  const areaLab = await prisma.areas.create({
    data: { tenant_id: TENANT, nombre: 'Laboratorio' },
  });
  const areaDeportes = await prisma.areas.create({
    data: { tenant_id: TENANT, nombre: 'Educación Física' },
  });
  console.log(`  ✅ Laboratorio (id=${areaLab.id}), Educación Física (id=${areaDeportes.id})`);

  // ── 2. Create centros de costo ──
  console.log('\n💰 Creating centros de costo...');
  const ccData = [
    { area_id: 8, nombre: 'Administración General', codigo: 'ADM1' },
    { area_id: 8, nombre: 'Secretaría', codigo: 'ADM2' },
    { area_id: 9, nombre: 'Docentes Tarde', codigo: 'DOC2' },
    { area_id: 10, nombre: 'Mantenimiento Edilicio', codigo: 'MAN1' },
    { area_id: 10, nombre: 'Mantenimiento Exterior', codigo: 'MAN2' },
    { area_id: areaLab.id, nombre: 'Laboratorio Ciencias', codigo: 'LAB1' },
    { area_id: areaLab.id, nombre: 'Laboratorio Química', codigo: 'LAB2' },
    { area_id: areaDeportes.id, nombre: 'Deportes General', codigo: 'DEP1' },
    { area_id: areaDeportes.id, nombre: 'Deportes Competitivo', codigo: 'DEP2' },
  ];
  const centrosCosto: { id: number; area_id: number; codigo: string }[] = [];
  // Keep existing CC id=1
  centrosCosto.push({ id: 1, area_id: 9, codigo: 'DOC1' });
  for (const cc of ccData) {
    const created = await prisma.centros_costo.create({
      data: { tenant_id: TENANT, ...cc },
    });
    centrosCosto.push({ id: created.id, area_id: cc.area_id, codigo: cc.codigo });
    console.log(`  ✅ ${cc.codigo} — ${cc.nombre}`);
  }

  // ── 3. Create users ──
  console.log('\n👥 Creating users...');
  const newUsers = [
    // Administración — more solicitantes + responsable
    {
      nombre: 'Silvia Secretaria',
      email: 'silvia@escuelatest.com',
      area_id: 8,
      roles: ['solicitante'],
    },
    {
      nombre: 'Roberto Resp. Admin',
      email: 'roberto.admin@escuelatest.com',
      area_id: 8,
      roles: ['responsable_area', 'solicitante'],
    },
    // Docentes — more solicitantes + another responsable
    {
      nombre: 'Gabriela Docente',
      email: 'gabriela@escuelatest.com',
      area_id: 9,
      roles: ['solicitante'],
    },
    {
      nombre: 'Fernando Docente',
      email: 'fernando@escuelatest.com',
      area_id: 9,
      roles: ['solicitante'],
    },
    {
      nombre: 'Patricia Docente',
      email: 'patricia@escuelatest.com',
      area_id: 9,
      roles: ['solicitante'],
    },
    {
      nombre: 'Héctor Resp. Docentes',
      email: 'hector@escuelatest.com',
      area_id: 9,
      roles: ['responsable_area', 'solicitante'],
    },
    // Mantenimiento — more solicitantes + responsable
    {
      nombre: 'Oscar Mantenimiento',
      email: 'oscar@escuelatest.com',
      area_id: 10,
      roles: ['solicitante'],
    },
    {
      nombre: 'Raúl Mantenimiento',
      email: 'raul@escuelatest.com',
      area_id: 10,
      roles: ['solicitante'],
    },
    {
      nombre: 'Diego Resp. Mantenim.',
      email: 'diego@escuelatest.com',
      area_id: 10,
      roles: ['responsable_area', 'solicitante'],
    },
    // Laboratorio
    {
      nombre: 'Elena Laboratorio',
      email: 'elena.lab@escuelatest.com',
      area_id: areaLab.id,
      roles: ['solicitante'],
    },
    {
      nombre: 'Martín Laboratorio',
      email: 'martin.lab@escuelatest.com',
      area_id: areaLab.id,
      roles: ['solicitante'],
    },
    {
      nombre: 'Andrea Resp. Lab',
      email: 'andrea.lab@escuelatest.com',
      area_id: areaLab.id,
      roles: ['responsable_area', 'solicitante'],
    },
    // Educación Física
    {
      nombre: 'Pablo Ed. Física',
      email: 'pablo.ef@escuelatest.com',
      area_id: areaDeportes.id,
      roles: ['solicitante'],
    },
    {
      nombre: 'Lucía Ed. Física',
      email: 'lucia.ef@escuelatest.com',
      area_id: areaDeportes.id,
      roles: ['solicitante'],
    },
    {
      nombre: 'Sergio Resp. Ed. Física',
      email: 'sergio.ef@escuelatest.com',
      area_id: areaDeportes.id,
      roles: ['responsable_area', 'solicitante'],
    },
  ];

  const roleMap = new Map<string, number>();
  const roles = await prisma.roles.findMany({});
  for (const r of roles) roleMap.set(r.nombre, r.id);

  interface UserRecord {
    id: number;
    nombre: string;
    area_id: number;
    roles: string[];
  }
  const allUsers: UserRecord[] = [
    // Existing users
    { id: 8, nombre: 'Ana Directora', area_id: 7, roles: ['director'] },
    { id: 9, nombre: 'Carlos Admin', area_id: 8, roles: ['admin', 'solicitante'] },
    { id: 10, nombre: 'María Responsable', area_id: 9, roles: ['responsable_area', 'solicitante'] },
    { id: 11, nombre: 'Pedro Compras', area_id: 8, roles: ['compras', 'solicitante'] },
    { id: 12, nombre: 'Laura Tesorería', area_id: 8, roles: ['tesoreria', 'solicitante'] },
    { id: 13, nombre: 'Juan Solicitante', area_id: 9, roles: ['solicitante'] },
    { id: 14, nombre: 'Luis Mantenimiento', area_id: 10, roles: ['solicitante'] },
  ];

  for (const u of newUsers) {
    const user = await prisma.usuarios.create({
      data: {
        tenant_id: TENANT,
        nombre: u.nombre,
        email: u.email,
        password_hash: PASS,
        area_id: u.area_id,
        activo: true,
      },
    });
    // Assign roles
    for (const rolName of u.roles) {
      const rolId = roleMap.get(rolName);
      if (rolId) {
        await prisma.usuarios_roles.create({ data: { usuario_id: user.id, rol_id: rolId } });
      }
    }
    allUsers.push({ id: user.id, nombre: u.nombre, area_id: u.area_id, roles: u.roles });
    console.log(`  ✅ ${u.nombre} (${u.roles.join(', ')})`);
  }

  // Set responsables on areas
  const respAdmin = allUsers.find((u) => u.nombre.includes('Resp. Admin'));
  const respMant = allUsers.find((u) => u.nombre.includes('Resp. Mantenim'));
  const respLab = allUsers.find((u) => u.nombre.includes('Resp. Lab'));
  const respEF = allUsers.find((u) => u.nombre.includes('Resp. Ed. Física'));
  if (respAdmin)
    await prisma.areas.update({ where: { id: 8 }, data: { responsable_id: respAdmin.id } });
  if (respMant)
    await prisma.areas.update({ where: { id: 10 }, data: { responsable_id: respMant.id } });
  if (respLab)
    await prisma.areas.update({ where: { id: areaLab.id }, data: { responsable_id: respLab.id } });
  if (respEF)
    await prisma.areas.update({
      where: { id: areaDeportes.id },
      data: { responsable_id: respEF.id },
    });

  // ── 4. Create proveedores ──
  console.log('\n🏢 Creating proveedores...');
  const proveedores: { id: number; nombre: string }[] = [{ id: 2, nombre: 'Dunder Mifflin' }];
  for (const prov of PROVEEDORES) {
    const p = await prisma.proveedores.create({
      data: { tenant_id: TENANT, ...prov },
    });
    proveedores.push({ id: p.id, nombre: prov.nombre });
    console.log(`  ✅ ${prov.nombre}`);
  }

  // ── 5. Create solicitudes ──
  console.log('\n📋 Creating solicitudes...');

  const DIRECTORA_ID = 8;
  const COMPRAS_ID = 11;

  // Area config: products, users, responsables, centros
  interface AreaConfig {
    areaId: number;
    areaName: string;
    products: string[];
    minPrice: number;
    maxPrice: number;
    count: number;
  }

  const areaConfigs: AreaConfig[] = [
    {
      areaId: 8,
      areaName: 'Administración',
      products: PRODUCTOS_ADMIN,
      minPrice: 200,
      maxPrice: 15000,
      count: 100,
    },
    {
      areaId: 9,
      areaName: 'Docentes',
      products: PRODUCTOS_DOCENTES,
      minPrice: 100,
      maxPrice: 8000,
      count: 100,
    },
    {
      areaId: 10,
      areaName: 'Mantenimiento',
      products: PRODUCTOS_MANTENIMIENTO,
      minPrice: 500,
      maxPrice: 25000,
      count: 50,
    },
    {
      areaId: areaLab.id,
      areaName: 'Laboratorio',
      products: PRODUCTOS_LABORATORIO,
      minPrice: 300,
      maxPrice: 20000,
      count: 50,
    },
    {
      areaId: areaDeportes.id,
      areaName: 'Educación Física',
      products: PRODUCTOS_DEPORTES,
      minPrice: 500,
      maxPrice: 18000,
      count: 50,
    },
  ];

  let totalCreated = 0;

  for (const config of areaConfigs) {
    const areaSolicitantes = allUsers.filter(
      (u) => u.area_id === config.areaId && u.roles.includes('solicitante'),
    );
    const areaResponsables = allUsers.filter(
      (u) => u.area_id === config.areaId && u.roles.includes('responsable_area'),
    );
    const areaCCs = centrosCosto.filter((cc) => cc.area_id === config.areaId);

    console.log(
      `\n  📁 ${config.areaName}: ${config.count} solicitudes (${areaSolicitantes.length} solicitantes, ${areaResponsables.length} responsables)`,
    );

    for (let i = 0; i < config.count; i++) {
      solicitudCounter++;
      const solicitante = pick(areaSolicitantes);
      const responsable = areaResponsables.length > 0 ? pick(areaResponsables) : null;
      const proveedor = pick(proveedores);
      const cc = areaCCs.length > 0 ? pick(areaCCs) : null;
      const urgencia = pick(URGENCIAS);
      const numItems = randomQty(1, 4);
      const itemProducts = pickN(config.products, numItems);
      const justificacion = pick(JUSTIFICACIONES);

      // Decide state distribution: 55% cerrada, 10% abonada, 10% aprobada, 8% validada, 5% enviada, 5% en_compras, 4% devuelta, 3% rechazada
      const rand = Math.random();
      let estado: string;
      if (rand < 0.55) estado = 'cerrada';
      else if (rand < 0.65) estado = 'abonada';
      else if (rand < 0.75) estado = 'aprobada';
      else if (rand < 0.83) estado = 'validada';
      else if (rand < 0.88) estado = 'enviada';
      else if (rand < 0.93) estado = 'en_compras';
      else if (rand < 0.97) estado = 'devuelta_resp';
      else estado = 'rechazada';

      // Dates: spread over last 8 months
      const daysAgo = randomQty(1, 240);
      const createdAt = new Date(Date.now() - daysAgo * 86400000);
      const enviadoAt = new Date(createdAt.getTime() + randomQty(0, 2) * 86400000);
      const validadoAt = new Date(enviadoAt.getTime() + randomQty(1, 3) * 86400000);
      const aprobadoAt = new Date(validadoAt.getTime() + randomQty(1, 3) * 86400000);

      const numero = `SOL-${createdAt.getFullYear()}-${String(solicitudCounter).padStart(4, '0')}`;
      const titulo =
        numItems === 1 ? itemProducts[0] : `${config.areaName}: ${itemProducts[0]} y otros`;

      const solData: any = {
        tenant_id: TENANT,
        numero,
        titulo,
        descripcion: `Solicitud de ${numItems} producto(s) para ${config.areaName}`,
        justificacion,
        urgencia,
        estado,
        area_id: config.areaId,
        solicitante_id: solicitante.id,
        proveedor_id: proveedor.id,
        centro_costo_id: cc?.id ?? null,
        created_at: createdAt,
      };

      // Add workflow dates based on state
      if (
        [
          'enviada',
          'validada',
          'aprobada',
          'en_compras',
          'abonada',
          'cerrada',
          'rechazada',
        ].includes(estado)
      ) {
        solData.fecha_envio = enviadoAt;
      }
      if (
        ['validada', 'aprobada', 'en_compras', 'abonada', 'cerrada'].includes(estado) &&
        responsable
      ) {
        solData.validado_por_id = responsable.id;
        solData.fecha_validacion = validadoAt;
      }
      if (['aprobada', 'en_compras', 'abonada', 'cerrada'].includes(estado)) {
        solData.aprobado_por_id = DIRECTORA_ID;
        solData.fecha_aprobacion = aprobadoAt;
      }
      if (estado === 'rechazada') {
        solData.rechazado_por_id = DIRECTORA_ID;
      }

      const solicitud = await prisma.solicitudes.create({ data: solData });

      // Create items
      const items = itemProducts.map((prod) => ({
        tenant_id: TENANT,
        solicitud_id: solicitud.id,
        descripcion: prod,
        cantidad: randomQty(1, 20),
        unidad: pick(['unidades', 'cajas', 'paquetes', 'metros', 'litros', 'kg']),
        precio_estimado: randomPrice(config.minPrice, config.maxPrice),
        link_producto: null as string | null,
      }));
      await prisma.items_solicitud.createMany({ data: items });

      // Create compra + recepcion for cerrada/abonada/en_compras
      if (['cerrada', 'abonada', 'en_compras'].includes(estado)) {
        const montoTotal = items.reduce((s, it) => s + it.precio_estimado * it.cantidad, 0);
        const fechaCompra = new Date(aprobadoAt.getTime() + randomQty(1, 5) * 86400000);
        await prisma.compras.create({
          data: {
            tenant_id: TENANT,
            solicitud_id: solicitud.id,
            ejecutado_por_id: COMPRAS_ID,
            proveedor_nombre: proveedor.nombre,
            monto_total: Math.round(montoTotal * 100) / 100,
            fecha_compra: fechaCompra,
            medio_pago: pick(['transferencia_bancaria', 'efectivo', 'cheque', 'tarjeta_debito']),
            observaciones: null,
          },
        });

        if (estado === 'cerrada') {
          await prisma.recepciones.create({
            data: {
              tenant_id: TENANT,
              solicitud_id: solicitud.id,
              receptor_id: solicitante.id,
              conforme: true,
              observaciones: 'Recibido conforme',
              fecha_recepcion: new Date(fechaCompra.getTime() + randomQty(1, 7) * 86400000),
            },
          });
        }
      }

      totalCreated++;
      if (totalCreated % 50 === 0) console.log(`    ... ${totalCreated} solicitudes creadas`);
    }
  }

  console.log(`\n✅ Total: ${totalCreated} solicitudes creadas`);

  // ── 6. Sync productos from cerrada solicitudes ──
  console.log('\n📦 Syncing productos from cerrada solicitudes...');
  const cerradas = await prisma.solicitudes.findMany({
    where: { tenant_id: TENANT, estado: 'cerrada' },
    select: { id: true, area_id: true },
  });

  let productosCreated = 0;
  for (const sol of cerradas) {
    const solItems = await prisma.items_solicitud.findMany({
      where: { solicitud_id: sol.id },
    });
    for (const item of solItems) {
      const nombre = item.descripcion.trim();
      if (!nombre) continue;
      try {
        const producto = await prisma.productos.upsert({
          where: { tenant_id_nombre: { tenant_id: TENANT, nombre } },
          create: {
            tenant_id: TENANT,
            nombre,
            area_id: sol.area_id,
            unidad_defecto: item.unidad,
            precio_referencia: item.precio_estimado,
          },
          update: {
            ...(item.precio_estimado != null ? { precio_referencia: item.precio_estimado } : {}),
            ...(sol.area_id ? { area_id: sol.area_id } : {}),
          },
        });
        if (!item.producto_id) {
          await prisma.items_solicitud.update({
            where: { id: item.id },
            data: { producto_id: producto.id },
          });
        }
        productosCreated++;
      } catch {
        continue;
      }
    }
  }
  console.log(`  ✅ ${productosCreated} productos synced`);

  console.log('\n🎉 Massive seed complete!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
