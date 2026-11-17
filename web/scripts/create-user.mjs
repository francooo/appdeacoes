// Cria ou atualiza um usuário que pode fazer login no sistema.
// Uso: npm run create-user -- email@exemplo.com "Nome" "senha"
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const [email, name, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: npm run create-user -- email@exemplo.com "Nome" "senha"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("A senha precisa ter pelo menos 8 caracteres.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL não definida (confira web/.env.local).");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Garante que as tabelas existem (schema compartilhado com o sync).
const schema = readFileSync(fileURLToPath(new URL("../../db/schema.sql", import.meta.url)), "utf8");
for (const stmt of schema.split(";").map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)*$/.test(s))) {
  await sql.query(stmt);
}

const hash = await bcrypt.hash(password, 12);
const [row] = await sql`
  INSERT INTO users (email, name, password_hash)
  VALUES (${email.toLowerCase()}, ${name || null}, ${hash})
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
  RETURNING id, email
`;
console.log(`Usuário pronto: ${row.email} (id ${row.id})`);
