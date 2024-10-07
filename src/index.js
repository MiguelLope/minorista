// Importamos el módulo express para crear el servidor
import express from "express";
import session from "express-session";
import  methodOverride  from "method-override";


// Importamos dirname y join de path, y fileURLToPath de url para manejar rutas
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import indexRoutes from './routes/index.js';


// Creamos una instancia de express
const app = express();

// Obtenemos la ruta absoluta del directorio actual
const ___dirname = dirname(fileURLToPath(import.meta.url));

// Configuramos la ubicación de las vistas (templates) en el directorio 'views'
app.set('views', join(___dirname, 'views'));

// Definimos 'ejs' como el motor de plantillas que utilizaremos
app.set('view engine', 'ejs');




app.use(session({
    secret: '242629', // Cambia 'tu_secreto_aqui' por una cadena secreta segura
    resave: false, // No volver a guardar la sesión si no hay cambios
    saveUninitialized: true, // Guardar nuevas sesiones, aunque estén vacías
    cookie: { secure: false } // `true` si utilizas HTTPS; para desarrollo local `false`
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(indexRoutes)




// Iniciamos el servidor en el puerto 3000
app.listen(3000);
console.log("Server is listening on port", 3000);
