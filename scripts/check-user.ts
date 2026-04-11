import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import pg from 'pg';
const { Client } = pg;

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  console.log('Connected');
  const res = await c.query("SELECT id, email, activo, password_hash IS NOT NULL as tiene_pass FROM usuarios WHERE email ILIKE '%director%'");
  console.log('Users:', JSON.stringify(res.rows, null, 2));
  const locks = await c.query("SELECT * FROM account_lockouts");
  console.log('Lockouts:', JSON.stringify(locks.rows, null, 2));
  await c.query("DELETE FROM account_lockouts");
  console.log('Lockouts cleared');
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
