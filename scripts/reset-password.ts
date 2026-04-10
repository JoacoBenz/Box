import 'dotenv/config';
import { PrismaClient } from '../app/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const email = process.argv[2];
const newPass = process.argv[3] || 'TempPass123!';

async function main() {
  if (!email) { console.log('Usage: npx tsx scripts/reset-password.ts <email> [newPassword]'); return; }
  const hash = await bcrypt.hash(newPass, 12);
  const result = await prisma.usuarios.updateMany({ where: { email }, data: { password_hash: hash } });
  console.log(`Updated ${result.count} user(s) for ${email}`);
  console.log(`New password: ${newPass}`);
  await prisma.$disconnect();
}
main();
