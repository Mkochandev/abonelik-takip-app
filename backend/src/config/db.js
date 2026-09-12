const { Pool } = require("pg");

// DATABASE_URL, Supabase projesinin doğrudan Postgres bağlantı string'i.
// Raw SQL sorguları (health check, migration'lar vb.) için kullanılır.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
