const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '10.2.0.11',
  user: 'paragi.csenge',
  password: 'Csany6166', // ide a saját jelszavad
  database: "leltar_vizsga",
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
