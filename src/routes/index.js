import { Router } from "express";
import db from "../db.js"; // Importar la conexión de la base de datos
import bcrypt from "bcrypt";

const router = Router();

// Creamos una ruta para la raíz del sitio ('/') y renderizamos el archivo 'index.ejs'
router.get("/", isAuthenticated, (req, res) => res.render("index"));

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    return res.redirect('/iniciarsesion'); // Redirigir a la página de login si no está autenticado
  }
}

router.get("/historiales/filtrar", isAuthenticated, async (req, res) => {
  const { movement, dateFrom, dateTo, search } = req.query;

  let query = "SELECT h.id, p.nombre AS producto, h.cantidad, h.t_movimiento, h.fecha,"+
           "CASE"+ 
             "WHEN h.t_movimiento = 'Venta' THEN h.cantidad * p.precio_unitario"+
             "WHEN h.t_movimiento = 'Compra' THEN h.cantidad * p.costo_unitario"+
             "ELSE 0 "+
           "END AS total"+
    "FROM Historial h"+
    "JOIN Productos p ON h.producto = p.id_producto"+
    "WHERE 1=1"; // 1=1 es para facilitar agregar condiciones dinámicamente

  const queryParams = [];

  // Filtrar por tipo de movimiento
  if (movement) {
    query += " AND h.t_movimiento = ?";
    queryParams.push(movement);
  }

  // Filtrar por rango de fechas
  if (dateFrom) {
    query += " AND h.fecha >= ?";
    queryParams.push(dateFrom);
  }

  if (dateTo) {
    query += " AND h.fecha <= ?";
    queryParams.push(dateTo);
  }

  // Filtrar por búsqueda de producto
  if (search) {
    query += " AND p.nombre LIKE ?";
    queryParams.push(`%${search}%`);
  }

  try {
    const [rows] = await db.query(query, queryParams);
    res.json(rows); // Devolver los resultados como JSON para el AJAX
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al filtrar el historial");
  }
});

router.get("/historiales", isAuthenticated, async (req, res) => {
  try {
    // Consulta SQL para obtener el historial con el total calculado
    const [rows] = await db.query(
      "SELECT h.id,"+
              "p.nombre AS producto,"
              +"h.cantidad,"
              +"h.t_movimiento,"
              +"h.fecha, "
              +"CASE "
                +"WHEN h.t_movimiento = 'Venta' THEN h.cantidad * p.precio_unitario "
                +"WHEN h.t_movimiento = 'Compra' THEN h.cantidad * p.costo_unitario "
                +"ELSE 0"+
              "END AS total"+ 
       "FROM Historial h"+
       "JOIN Productos p ON h.producto = p.id_producto;"
    );

    // Verificar si los datos obtenidos son un array antes de renderizar
    if (Array.isArray(rows)) {
      // Renderiza la vista de "historiales" con los datos obtenidos
      res.render("historiales", { historial: rows });
    } else {
      throw new Error("Los datos obtenidos no son un array");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener el historial");
  }
});


router.get('/personal', async (req, res) => {
  // Verificamos que el usuario esté autenticado
  if (!req.session.user) {
    return res.redirect('/iniciarsesion');
  }

  try {
    // Consulta para obtener todos los usuarios
    const sqlQuery = 'SELECT username, email, nombre_usuario, password FROM usuarios';
    const [users] = await db.query(sqlQuery);

    // Renderizamos la vista y pasamos los usuarios y el rol del usuario que inició sesión
    res.render('personal', {
      users,
      userRole: req.session.user.id_rol // Pasamos el rol del usuario a la vista
    });
  } catch (err) {
    console.error('Error al obtener el personal:', err);
    return res.status(500).send('Error al obtener el personal');
  }
});


router.get("/productos", isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM productos");

    // Verificar el tipo de `rows` antes de renderizar
    if (Array.isArray(rows)) {
      res.render("productos", { productos: rows });
    } else {
      throw new Error("Los datos obtenidos no son un array");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener productos");
  }
});

// Ruta para agregar un producto
router.post("/productos/add", isAuthenticated, async (req, res) => {
  const {
    productName,
    productDescription,
    productCost,
    productPrice,
    productStock,
  } = req.body;
  try {
    // Inserta el producto en la base de datos
    const [result] = await db.query(
      "INSERT INTO productos (nombre, descripcion, costo_unitario, precio_unitario, stock) VALUES (?, ?, ?, ?, ?)",
      [productName, productDescription, productCost, productPrice, productStock]
    );

    const insertId = result.insertId;  // Este es el 'id_producto' generado


    await db.query(
      "INSERT INTO historial (producto, cantidad, t_movimiento, fecha) VALUES (?, ?, 'Compra', NOW())",
      [insertId, productStock]
    );

    res.redirect("/productos");
  } catch (error) {
    console.error("Error al agregar el producto:", error);
    res
      .status(500)
      .send({ success: false, message: "Error al agregar el producto" });
  }
});

// Ruta para editar un producto
router.post("/productos/edit", isAuthenticated, async (req, res) => {
  const {
    editProductId,
    editProductName,
    editProductDescription,
    editProductCost,
    editProductPrice,
    editProductStock,
  } = req.body;

  try {
    // Obtener el stock actual del producto antes de editarlo
    const [productoActual] = await db.query(
      "SELECT stock FROM productos WHERE id_producto = ?",
      [editProductId]
    );

    const stockAnterior = productoActual[0].stock;  // Asegurarse de acceder al primer objeto
    const diferenciaStock = editProductStock - stockAnterior;

    console.log(productoActual.stock);
    console.log(diferenciaStock);


    // Actualizar el producto en la base de datos
    await db.query(
      "UPDATE productos SET nombre = ?, descripcion = ?, costo_unitario = ?, precio_unitario = ?, stock = ? WHERE id_producto = ?;",
      [
        editProductName,
        editProductDescription,
        editProductCost,
        editProductPrice,
        editProductStock,
        editProductId,
      ]
    );


    // Determinar el tipo de movimiento para el historial
    let tipoMovimiento = null;
    if (diferenciaStock > 0) {

      tipoMovimiento = "Edicion-Alta"; // Se aumentó el stock
    } else if (diferenciaStock < 0) {
      tipoMovimiento = "Edicion-Baja"; // Se redujo el stock
    }

    // Si hubo un cambio en el stock, registrar el movimiento en el historial
    if (tipoMovimiento !== null) {

      await db.query(
        "INSERT INTO historial (producto, cantidad, t_movimiento, fecha) VALUES (?, ?, ?, NOW())",
        [editProductId, Math.abs(diferenciaStock), tipoMovimiento]
      );
    }

    res.redirect("/productos");
  } catch (error) {
    console.error("Error al editar el producto:", error);
    res.status(500).send({ success: false, message: "Error al editar el producto" });
  }
});

// Ruta para eliminar un producto
router.delete("/productos/delete/:id", isAuthenticated, (req, res) => {
  const { id } = req.params;

  const sql = "DELETE FROM productos WHERE id_producto = ?";

  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error al eliminar el producto:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error al eliminar el producto" });
    }

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Producto no encontrado" });
    }
    res.json({ success: true, message: "Producto eliminado exitosamente" });
  });
});

router.get("/proveedores", isAuthenticated, (req, res) => res.render("proveedores"));

router.get("/venta", isAuthenticated, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM productos");

    // Verificar el tipo de `rows` antes de renderizar
    if (Array.isArray(rows)) {
      res.render("venta", { productos: rows });
    } else {
      throw new Error("Los datos obtenidos no son un array");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al obtener productos");
  }
});

// Ruta para procesar la venta
router.post("/venta/vender", isAuthenticated, async (req, res) => {
  const carrito = req.body.carrito; // El array de productos en el carrito

  try {
    for (let item of carrito) {
      const productoId = item.id;
      const cantidadVendida = item.cantidad;

      console.log(cantidadVendida);

      // Actualiza el stock del producto
      await db.query(
        "UPDATE productos SET stock = stock - ? WHERE id_producto = ?",
        [cantidadVendida, productoId]
      );

      await db.query(
        'INSERT INTO historial (producto, cantidad, t_movimiento, fecha) VALUES (?, ?, "Venta", NOW())',
        [productoId, cantidadVendida]
      );
      // Puedes agregar aquí el registro de la venta en otra tabla, si es necesario
      // await db.query('INSERT INTO ventas ...');
    }

    res.status(200).json({ message: "Venta realizada con éxito" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al realizar la venta" });
  }
});

router.get("/iniciarsesion", (req, res) => res.render("iniciarsesion"));

// Ruta para manejar el inicio de sesión

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Consulta segura, obtenemos el usuario por su username
  const sqlQuery = 'SELECT * FROM usuarios WHERE username = ?';

  try {
    const [results] = await db.query(sqlQuery, [username]);

    if (results.length > 0) {
      const user = results[0];

      // Comparamos la contraseña ingresada con el hash almacenado
      const passwordMatch = bcrypt.compare(password, user.password);

      if (passwordMatch) {
        console.log("Usuario encontrado y contraseña correcta");

        // Guardar información del usuario en la sesión
        req.session.user = {
          id: user.id,
          username: user.username,
          id_rol: user.id_rol
        };

        res.redirect('/');
      } else {
        console.log("Contraseña incorrecta");
        res.redirect('/iniciarsesion');
      }
    } else {
      console.log("Usuario no encontrado");
      res.redirect('/iniciarsesion');
    }
  } catch (err) {
    console.error('Error en la consulta SQL:', err);
    return res.status(500).send('Error en la base de datos');
  }
});


// Ruta para cerrar sesión
router.get('/logout', (req, res) => {
  // Destruir la sesión
  req.session.destroy(err => {
    if (err) {
      console.error('Error al cerrar la sesión:', err);
      return res.status(500).send('Error al cerrar la sesión');
    }
    // Redirigir a la página de inicio o inicio de sesión
    res.redirect('/iniciarsesion'); // Cambia a la ruta deseada
  });
});

// Ruta para eliminar un usuario
router.delete('/eliminar/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    // Consulta para eliminar el usuario
    const sqlQuery = 'DELETE FROM usuarios WHERE username = ?';
    await db.query(sqlQuery, [username]);
    
    // Enviar respuesta de éxito
    res.status(200).send('Usuario eliminado');
  } catch (err) {
    console.error('Error al eliminar el usuario:', err);
    res.status(500).send('Error al eliminar el usuario');
  }
});



// Ruta para mostrar el formulario de edición
router.get('/editar/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Obtener los datos del usuario para mostrarlos en el formulario
    const sqlQuery = 'SELECT * FROM usuarios WHERE username = ?';
    const [results] = await db.query(sqlQuery, [username]);

    if (results.length > 0) {
      res.render('editarUsuario', { user: results[0] });
    } else {
      res.status(404).send('Usuario no encontrado');
    }
  } catch (err) {
    console.error('Error al obtener los datos del usuario:', err);
    return res.status(500).send('Error en la base de datos');
  }
});

// Ruta para actualizar los datos del usuario
// Ruta para editar un usuario
router.put('/editar/:username', async (req, res) => {
  const { username } = req.params;
  const { email, password } = req.body;

  try {
    const sqlQuery = 'UPDATE usuarios SET email = ?, password = ? WHERE username = ?';
    await db.query(sqlQuery, [email, password, username]);

    res.status(200).send('Usuario actualizado');
  } catch (err) {
    console.error('Error al editar el usuario:', err);
    res.status(500).send('Error al actualizar el usuario');
  }
});






export default router;
