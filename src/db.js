import mysql from 'mysql2/promise';

// Configurar la conexión a MySQL
const db = await mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'dbminorista'
});

export default db;
