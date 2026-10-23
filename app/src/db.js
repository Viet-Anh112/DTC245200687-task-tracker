/**
 * Ket noi co so du lieu PostgreSQL bang connection pool (pg.Pool)
 * Doc cau hinh hoan toan tu bien moi truong, khong ghi cung thong tin dang nhap
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Xu ly loi bat ngo tren client ket noi ranh roi (idle clients)
pool.on('error', (err) => {
  console.error(JSON.stringify({
    level: 'error',
    time: new Date().toISOString(),
    msg: 'Loi bat ngo tren PostgreSQL connection pool',
    error: err.message,
  }));
});

module.exports = pool;
