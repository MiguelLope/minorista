import mysql from 'mysql2/promise';

// Configurar la conexión a MySQL
const db = await mysql.createPool({
  host: "junction.proxy.rlwy.net",
  user: "root",
  password: "WHoslXFvuOJkudIiWIHEhaLwSmHQbgHh",
  database: "railway",
  port: "37356"
});

export default db;
