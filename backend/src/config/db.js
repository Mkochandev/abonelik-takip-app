const { Pool } = require("pg");

// DATABASE_URL: kendi PostgreSQL sunucumuzun bağlantı adresi (eriste /
// eriste_dev). Uygulamanın bütün sorguları bu havuzdan geçer.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
