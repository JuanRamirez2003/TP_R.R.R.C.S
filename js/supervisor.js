
src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js"

const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

function mostrarSeccion(id) {
  document.querySelectorAll('.seccion').forEach(s => s.style.display = 'none');
  document.getElementById(id).style.display = 'block';
  if (id === "ordenProduccion") prepararNuevaOP();
  if (id === "seguimientoOP") cargarOP();
}

// Inicializamos el array vacío
let productosDisponibles = [];

async function cargarProductosDisponibles() {
  const { data, error } = await supabaseClient.from('productos').select('nombre');

  if (error) {
    console.error("Error al cargar productos:", error);
    return;
  }

  productosDisponibles = data.map(p => p.nombre);
}

// Llamada de ejemplo:
(async () => {
  await cargarProductosDisponibles();
  agregarProducto(); // Ahora tendrá los productos cargados
})();

let ordenesProduccion = JSON.parse(localStorage.getItem("ordenesProduccion")) || [];
function guardarOPs() { localStorage.setItem("ordenesProduccion", JSON.stringify(ordenesProduccion)); }


//Generar numero de orden automatico
async function generarNumeroOP() {
  // usar id_orden_produccion para asegurar que traes la última fila creada
  const { data, error } = await supabaseClient
    .from('orden_produccion')
    .select('id_orden_produccion, numero_op')
    .order('id_orden_produccion', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error al generar número de OP:", error);
    return "OP-2025-000"; // defecto: empieza en 000
  }

  if (!data || data.length === 0) {
    return "OP-2025-000"; // si no hay OP -> primera será 000
  }

  const ultimo = data[0].numero_op || "";
  // extraer el número final con regex (más seguro que split)
  const m = ultimo.match(/-(\d+)$/);
  const lastNum = m ? parseInt(m[1], 10) : 0;
  const nuevoNum = lastNum + 1;
  const nuevo = `OP-2025-${String(nuevoNum).padStart(3, '0')}`;
  return nuevo;
}

prepararNuevaOP();

function prepararNuevaOP() {
  document.getElementById('btnCrearOP').disabled = true; 
  document.getElementById('productosContainer').innerHTML = '';
  agregarProducto();

  generarNumeroOP().then(numeroOP => {
    console.log("Número OP generado:", numeroOP);
    document.getElementById('opNumero').value = numeroOP;
  });
}

function agregarProducto() {
  const container = document.getElementById('productosContainer');
  const div = document.createElement('div');
  div.className = 'producto-item';
  let opciones = productosDisponibles.map(p => `<option value="${p}">${p}</option>`).join('');
  div.innerHTML = `
    <select name="productoNombre[]" required>
      <option value="" disabled selected>Seleccione un producto</option>
      ${opciones}
    </select>
    <lebel>Cant. Lote:</label>
    <input type="number" name="productoCantidad[]" min="1" value="1" required>
    
  `;

  div.querySelector('select').addEventListener('change', actualizarDetalleMateriales);
  div.querySelector('input').addEventListener('input', actualizarDetalleMateriales);
  container.appendChild(div);
}
//<button type="button" onclick="eliminarProducto(this)" class="btn-eliminar">❌</button>
function eliminarProducto(btn) {
  btn.parentElement.remove();
  if (document.querySelectorAll('.producto-item').length === 0) agregarProducto();
}

function cancelarOP() {
  document.getElementById('opForm').reset();
  document.getElementById('productosContainer').innerHTML = '';
  agregarProducto();
  document.getElementById('ordenProduccion').style.display = 'none';
}

// Crear OP y guardar en Supabase
document.getElementById('opForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const productos = Array.from(document.querySelectorAll('.producto-item')).map(p => ({
    nombre: p.querySelector('select').value,
    cantidad: parseInt(p.querySelector('input').value, 10)
  }));
  if (productos.some(p => !p.nombre || p.cantidad <= 0)) {
    alert("Complete todos los productos con cantidad válida");
    return;
  }
  console.log(productos[0].nombre);

  const numeroOP = document.getElementById('opNumero').value;
  const fecha = new Date().toISOString();

  const idProducto = await obtnerIdProducto(productos[0].nombre);
  if (!idProducto) {
    alert("No se pudo obtener el ID del producto");
    return;
  }
  const idReceta = await obtenerRecetaPorProducto(idProducto);
  if (!idReceta) {
    alert("No se encontró receta para este producto");
    return;
  }

  const detalleReceta = await detalleMateriales(idProducto, productos[0].cantidad);
  console.log("Detalle de receta:", detalleReceta);
  const stockSuficiente = await verificarStockSuficiente(detalleReceta);
  if (!stockSuficiente) {
    alert("No hay suficiente stock para producir este lote.");
    return;
  }

  const { data, error } = await supabaseClient.from('orden_produccion').insert([{
    numero_op: numeroOP,
    ver_orden: productos,
    id_producto: idProducto,
    cant_lote: productos[0].cantidad,
    id_receta: idReceta,
    detalle_materiales: detalleReceta,
    fecha_emision: fecha,
    estado: 'Pendiente'
  }])
    .select();
  if (error) return console.error("Error al guardar OP:", error);

  const idOrden = data[0].id_orden_produccion;


  for (const mat of detalleReceta) {
    const ok = await reservarLotes(idOrden, mat.id_mp, mat.cantidad_total);
    if (!ok) {
      alert(`No se pudo reservar los lotes para el material ${mat.nombre_material} (ID ${mat.id_mp})`);
      return;
    }
  }

  cancelarOP();
  mostrarSeccion('seguimientoOP');
  cargarOP();
});


async function obtnerIdProducto(nombreProducto) {
  const { data, error } = await supabaseClient
    .from('productos')
    .select('id_producto')
    .eq('nombre', nombreProducto)
    .single();

  if (error) {
    console.error("Error al obtener id del producto:", error);
    return null;
  }
  console.log("ID del producto obtenido:", data.id_producto);
  return data.id_producto;
}

async function obtenerRecetaPorProducto(idProducto) {
  const { data, error } = await supabaseClient
    .from('receta')
    .select('*')
    .eq('id_producto', idProducto)
    .single();

  if (error) {
    console.error("Error al obtener receta:", error);
    return null;
  }

  return data.id_receta;
}


async function detalleMateriales(idProducto, cantLote) {

  const { data, error } = await supabaseClient
    .from('producto_materia')
    .select('*')
    .eq('id_producto', idProducto);

  if (error) {
    console.error("Error al obtener detalle de materia:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  const idsMP = data.map(item => item.id_mp);
  const { data: materiales, error: errorMat } = await supabaseClient
    .from('materiales')
    .select('id_mp, nombre')
    .in('id_mp', idsMP);

  if (errorMat) {
    console.error("Error al obtener nombres de materiales:", errorMat);
    return [];
  }

  // Mapeamos cada item agregando su nombre y multiplicando por el lote
  const detalleMultiplicado = data.map(item => {
    const mat = materiales.find(m => m.id_mp === item.id_mp);
    return {
      id_mp: item.id_mp,
      nombre_material: mat ? mat.nombre : 'Desconocido',
      id_producto: item.id_producto,
      cantidad_base: item.cantidad,
      unidad: item.unidad,
      cantidad_total: item.cantidad * cantLote
    };
  });

  return detalleMultiplicado;
}

async function actualizarDetalleMateriales() {
  const productos = Array.from(document.querySelectorAll('.producto-item'));
  let detalleTotal = [];

  for (const p of productos) {
    const nombreProd = p.querySelector('select').value;
    const cantLote = parseInt(p.querySelector('input').value, 10);
    if (!nombreProd || cantLote <= 0) continue;

    const idProducto = await obtnerIdProducto(nombreProd);
    if (!idProducto) continue;

    const detalle = await detalleMateriales(idProducto, cantLote);
    detalleTotal = detalleTotal.concat(detalle);
  }

  const boton = document.getElementById('btnCrearOP');


  if (detalleTotal.length === 0) {
    mostrarDetalleMateriales([]);
    boton.disabled = true;
    return;
  }

  const verificacion = await verificarStockSuficiente(detalleTotal);

  mostrarDetalleMateriales(verificacion.detalle);

  if (!verificacion.ok) {
    alert("⚠️ Algunos materiales no tienen suficiente stock. Revisa la tabla para más detalles.");
  }
  boton.disabled = !verificacion.ok;
}
function mostrarDetalleMateriales(detalle) {
  const tabla = document.getElementById('tablaMateriales').querySelector('tbody');
  tabla.innerHTML = ''; // limpiar la tabla antes de agregar

  if (!detalle || detalle.length === 0) {
    tabla.innerHTML = `<tr><td colspan="3" style="text-align:center;">Sin datos aún</td></tr>`;
    return;
  }

  detalle.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.nombre_material || item.id_mp}</td>
      <td>${item.cantidad_total}</td>
      <td>${item.unidad}</td>
      <td>${item.condicion || '⏳ Verificando...'}</td>
    `;
    tabla.appendChild(tr);
  });
}
//---------------------------------------

async function verificarStockSuficiente(detalleReceta) {
  for (const item of detalleReceta) {
    const { data, error } = await supabaseClient
      .from('materiales')
      .select('stock_disponible')
      .eq('nombre', item.nombre_material)
      .single();

    if (error || !data) {
      console.error("Error consultando material:", error);
      item.condicion = "❌ Error o material no encontrado";
      continue;
    }

    if (data.stock_disponible < item.cantidad_total) {
      item.condicion = `⚠️ Insuficiente (${data.stock_disponible} disp.)`;
    } else {
      item.condicion = "✅ Disponible";
    }
  }

  mostrarDetalleMateriales(detalleReceta);

  const todoOk = detalleReceta.every(i => i.condicion.includes("✅"));
  return { ok: todoOk, detalle: detalleReceta };
}


// Función para reservar lotes de un material según FEFO
async function reservarLotes(idOrden, idMP, cantidadTotal) {
  try {
    let cantidadRestante = cantidadTotal;

    // Buscar lotes disponibles ordenados por fecha de vencimiento (FEFO)
    const { data: lotes, error } = await supabaseClient
      .from('lote_mp')
      .select('*')
      .eq('id_mp', idMP)
      .gt('cantidad_disponible', 0)
      .order('fecha_caducidad', { ascending: true });

    if (error) {
      console.error("Error al obtener lotes:", error);
      throw new Error(`No se pudieron obtener los lotes del material ${idMP}`);
    }

    if (!lotes || lotes.length === 0) {
      throw new Error(`No hay lotes disponibles para el material ${idMP}`);
    }

    for (const lote of lotes) {
      if (cantidadRestante <= 0) break;

      const cantidadDisponibleActual = Number(lote.cantidad_disponible) || 0;
      const cantidadReservadaActual = Number(lote.cantidad_reservada) || 0;
      const cantidadAR = Math.min(cantidadDisponibleActual, cantidadRestante);

      if (cantidadAR <= 0) continue;

      console.log("Reservando lote:", {
        id_lote: lote.id_lote,
        cantidadDisponibleActual,
        cantidadReservadaActual,
        cantidadAR
      });

      // Actualizar lote_mp (reservar cantidad)
      const { error: errorUpdate } = await supabaseClient
        .from('lote_mp')
        .update({
          cantidad_disponible: cantidadDisponibleActual - cantidadAR,
          cantidad_reservada: cantidadReservadaActual + cantidadAR
        })
        .eq('id_lote', lote.id_lote);

      if (errorUpdate) {
        console.error("Error al actualizar lote:", errorUpdate);
        throw new Error(`No se pudo actualizar el lote ${lote.id_lote}`);
      }

      // Registrar en detalle_lote_op
      const { error: errorInsert } = await supabaseClient
        .from('detalle_lote_op')
        .insert({
          id_orden_produccion: idOrden,
          id_lote: lote.id_lote,
          cantidad_lote: cantidadAR
        });

      if (errorInsert) {
        console.error("Error al insertar detalle_lote_op:", errorInsert);
        throw new Error(`No se pudo insertar detalle_lote_op para lote ${lote.id_lote}`);
      }

      cantidadRestante -= cantidadAR;
    }

    //Verificar si se logró cubrir toda la cantidad
    if (cantidadRestante > 0) {
      throw new Error(`No hay suficiente stock para el material ${idMP}`);
    }

    return true;

  } catch (err) {
    console.error("Error en reservarLotes:", err.message);
    return false;
  }
}


async function mostrarDetalleLotes(idOrden) {
  const { data: detalle, error } = await supabaseClient
    .from('detalle_lote_op')
    .select(`
      cantidad_lote,
      lote_mp(id_lote, id_mp, fecha_caducidad, cantidad_disponible, nombre_material:materiales!inner.nombre)
    `)
    .eq('id_orden_produccion', idOrden);

  if (error) return console.error("Error al traer detalle de lotes:", error);

  const tabla = document.getElementById('tablaLotes').querySelector('tbody');
  tabla.innerHTML = '';

  if (!detalle || detalle.length === 0) {
    tabla.innerHTML = `<tr><td colspan="4" style="text-align:center;">No hay lotes reservados</td></tr>`;
    return;
  }

  detalle.forEach(d => {
    const lote = d.lote_mp;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${lote.nombre_material}</td>
      <td>${lote.id_lote}</td>
      <td>${d.cantidad_lote}</td>
      <td>${new Date(lote.fecha_caducidad).toLocaleDateString()}</td>
    `;
    tabla.appendChild(tr);
  });
}







// Mostrar/ocultar contenedor según selección
document.getElementById('tieneOV').addEventListener('change', (e) => {
  const valor = e.target.value;
  document.getElementById('containerOVs').style.display = (valor === 'si') ? 'block' : 'none';
});

// Función para agregar un input/select de OV
function agregarOV() {
  const lista = document.getElementById('listaOVs');

  const div = document.createElement('div');
  div.className = 'ov-item';
  div.style.marginTop = '5px';
  div.style.border = '1px solid #555';
  div.style.padding = '5px';
  div.style.borderRadius = '5px';

  div.innerHTML = `
    <label>ID de OV: <input type="number" name="ov_id[]" min="1" required></label>
    <label>Producto:
      <select name="ov_producto[]" required>
        <option value="" disabled selected>Seleccione producto</option>
        ${productosDisponibles.map(p => `<option value="${p.id_producto}">${p.nombre}</option>`).join('')}
      </select>
    </label>
    <label>Cantidad: <input type="number" name="ov_cantidad[]" min="1" required></label>
    <button type="button" onclick="eliminarOV(this)">❌</button>
  `;
  lista.appendChild(div);
}
// Función para eliminar OV
function eliminarOV(btn) {
  btn.parentElement.remove();
}
//------------------------------------------------


//Generar numero de orden automatico
async function generarNumeroOP() {
  // usar id_orden_produccion para asegurar que traes la última fila creada
  const { data, error } = await supabaseClient
    .from('orden_produccion')
    .select('id_orden_produccion, numero_op')
    .order('id_orden_produccion', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error al generar número de OP:", error);
    return "OP-2025-000"; // defecto: empieza en 000
  }

  if (!data || data.length === 0) {
    return "OP-2025-000"; // si no hay OP -> primera será 000
  }

  const ultimo = data[0].numero_op || "";
  // extraer el número final con regex (más seguro que split)
  const m = ultimo.match(/-(\d+)$/);
  const lastNum = m ? parseInt(m[1], 10) : 0;
  const nuevoNum = lastNum + 1;
  const nuevo = `OP-2025-${String(nuevoNum).padStart(3, '0')}`;
  return nuevo;
}


// Cargar/Ver OP desde Supabase
async function cargarOP() {
  const { data, error } = await supabaseClient.from('orden_produccion').select('*').order('id_orden_produccion', { ascending: true });
  if (error) return console.error("Error al cargar OP:", error);

  const tabla = document.getElementById('tablaOP');
  tabla.innerHTML = '';
  data.forEach(op => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${op.numero_op}</td>
      <td><button onclick="verOrden(${op.id_orden_produccion})" class="btn-editar">📄 Ver Orden</button></td>
      <td>${op.estado}</td>
      <td>${new Date(op.fecha_emision).toLocaleString()}</td>
      <td>
        ${op.estado === 'Pendiente'
        ? `<button onclick="editarOP(${op.id_orden_produccion})" class="btn-editar">✏️ Editar</button>
             <button onclick="eliminarOP(${op.id_orden_produccion})" class="btn-eliminar">❌ Eliminar</button>`
        : 'No disponible'}
      </td>
    `;
    tabla.appendChild(tr);
  });
}

// Ver detalle de OP
async function verOrden(id_orden_produccion) {
  const { data, error } = await supabaseClient
    .from('orden_produccion')
    .select('*')
    .eq('id_orden_produccion', id_orden_produccion)
    .single();
  if (error) return console.error("Error al ver OP:", error);

  const productosHtml = data.ver_orden
    .map(p => `<p>${p.nombre} - Cantidad: ${p.cantidad}</p>`)
    .join('');

  const { data: detalleLotes, error: errorLotes } = await supabaseClient
    .from('detalle_lote_op')
    .select('*')
    .eq('id_orden_produccion', id_orden_produccion);

  if (errorLotes) return console.error("Error al cargar detalle de lotes:", errorLotes);

  let lotesHtml = '';
  if (detalleLotes && detalleLotes.length > 0) {
    for (const d of detalleLotes) {
      const { data: lote } = await supabaseClient
        .from('lote_mp')
        .select('id_lote, id_mp, fecha_caducidad')
        .eq('id_lote', d.id_lote)
        .single();

      const { data: mat } = await supabaseClient
        .from('materiales')
        .select('nombre')
        .eq('id_mp', lote.id_mp)
        .single();

      lotesHtml += `<tr>
        <td>${mat ? mat.nombre : 'Desconocido'}</td>
        <td>${lote.id_lote}</td>
        <td>${d.cantidad_lote}</td>
        <td>${lote.fecha_caducidad ? new Date(lote.fecha_caducidad).toLocaleDateString() : '-'}</td>
      </tr>`;
    }

    lotesHtml = `<table border="1" style="width:100%; margin-top:10px;">
      <thead>
        <tr>
          <th>Material</th>
          <th>Lote</th>
          <th>Cantidad reservada</th>
          <th>Fecha caducidad</th>
        </tr>
      </thead>
      <tbody>
        ${lotesHtml}
      </tbody>
    </table>`;
  } else {
    lotesHtml = '<p>No hay lotes reservados para esta OP.</p>';
  }

  document.getElementById('detalleOrden').innerHTML = `
    <p><strong>Número OP:</strong> ${data.numero_op}</p>
    <p><strong>Fecha Emisión:</strong> ${new Date(data.fecha_emision).toLocaleString()}</p>
    <p><strong>Estado:</strong> ${data.estado}</p>
    <h4>Productos:</h4>
    ${productosHtml}
    <h4>Lotes reservados:</h4>
    ${lotesHtml}
  `;

  document.getElementById('modalOrden').style.display = 'flex';
}

function cerrarModal() { document.getElementById('modalOrden').style.display = 'none'; }

// Editar OP
async function editarOP(id_orden_produccion) {
  const { data, error } = await supabaseClient.from('orden_produccion')
    .select('*').eq('id_orden_produccion', id_orden_produccion).single();
  if (error) return console.error("Error al cargar OP para editar:", error);

  const productos = data.ver_orden.map(p => {
    const cant = prompt(`Editar cantidad de ${p.nombre}:`, p.cantidad);
    if (cant && !isNaN(cant) && cant > 0) return { nombre: p.nombre, cantidad: parseInt(cant, 10) };
    return p;
  });

  const { error: updateError } = await supabaseClient.from('orden_produccion')
    .update({ ver_orden: productos }).eq('id_orden_produccion', id_orden_produccion);
  if (updateError) return console.error("Error al actualizar OP:", updateError);

  cargarOP();
}

// Eliminar OP
async function eliminarOP(id_orden_produccion) {
  if (!confirm("¿Eliminar esta OP?")) return;
  const { error } = await supabaseClient.from('orden_produccion')
    .delete().eq('id_orden_produccion', id_orden_produccion);
  if (error) return console.error("Error al eliminar OP:", error);
  cargarOP();
}

// Inicialización
(async () => {
  await cargarProductosDisponibles();
  prepararNuevaOP();
})();
