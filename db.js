const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456', // ide a saját jelszavad
  database: "leltar_vizsga",
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
