#!/usr/bin/env node
//
// npm run migrate — db/migrations/ altındaki uygulanmamış .sql dosyalarını
// ad sırasıyla, her birini ayrı bir transaction içinde çalıştırır.
// Uygulananlar schema_migrations tablosuna yazılır. Bir dosya hata verirse
// o dosya geri alınır ve çalıştırıcı durur (sonraki dosyalara geçmez).
//
//   npm run migrate              → uygula
//   npm run migrate -- --status  → yalnızca durumu göster

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");
const FILE_PATTERN = /^\d{4}_[a-z0-9_]+\.sql$/;
// Aynı anda iki çalıştırıcı (ör. iki deploy) aynı dosyayı uygulamasın.
const LOCK_KEY = 727001;

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => FILE_PATTERN.test(name))
    .sort();
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL tanımlı değil");
  }

  const statusOnly = process.argv.includes("--status");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);

    await client.query(`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query("select name from schema_migrations");
    const applied = new Set(rows.map((row) => row.name));
    const files = listMigrationFiles();
    const pending = files.filter((name) => !applied.has(name));

    const { rows: dbRows } = await client.query("select current_database() as name");
    console.log(`Veritabanı: ${dbRows[0].name}`);

    for (const name of files) {
      console.log(`  ${applied.has(name) ? "uygulandı " : "BEKLİYOR  "} ${name}`);
    }

    if (statusOnly || pending.length === 0) {
      if (pending.length === 0) {
        console.log("Uygulanacak migration yok.");
      }
      return;
    }

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8");
      process.stdout.write(`→ ${name} ... `);

      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [name]);
        await client.query("commit");
        console.log("tamam");
      } catch (error) {
        await client.query("rollback").catch(() => {});
        console.log("HATA");
        throw new Error(`${name} uygulanamadı: ${error.message}`);
      }
    }

    console.log(`${pending.length} migration uygulandı.`);
  } finally {
    await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
