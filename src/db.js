import mysql from 'mysql2/promise';

// Configurar la conexión a MySQL
const db = await mysql.createPool({
  host: "mysql.railway.internal",
  user: "root",
  password: "WHoslXFvuOJkudIiWIHEhaLwSmHQbgHh",
  database: "railway"
});

export default db;
