
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


let productosDisponibles = [];
let nombreProductoSelec = null;
let idProductoSeleccionado = null;
let cantidadPorLote = 10;
let cantTotalCajasOP = null;//para el limete de cantida de reserva 

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
  $('.select-ov').select2('destroy');
  document.getElementById('listaOVs').innerHTML = '';
  document.getElementById('productosContainer').innerHTML = '';
  agregarProducto();

  mostrarDetalleMateriales([]);
  idProductoSeleccionado = null;
  nombreProductoSelec = null;
  
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

  const idProducto = await obtnerIdProducto(productos[0].nombre, false);
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

  const okOV = await guardarOVsEnOP(idOrden);
  if (!okOV) {
    alert("Error al guardar las OV asociadas a la OP.");
    return;
  }
  console.log("Orden de Producción creada con éxito.");

  for (const mat of detalleReceta) {
    const ok = await reservarLotes(idOrden, mat.id_mp, mat.cantidad_total);
    if (!ok) {
      alert(`No se pudo reservar los lotes para el material ${mat.nombre_material} (ID ${mat.id_mp})`);
      return;
    }
  }
  
mostrarMensajeExito(idOrden);
/*
  cancelarOP();
  mostrarSeccion('seguimientoOP');
  cargarOP();*/
});

async function obtnerIdProducto(nombreProducto, limpiar) {
  const { data, error } = await supabaseClient
    .from('productos')
    .select('id_producto')
    .eq('nombre', nombreProducto)
    .single();

  if (error) {
    console.error("Error al obtener id del producto:", error);
    return null;
  }
  idProductoSeleccionado = data.id_producto;
  nombreProductoSelec = nombreProducto;
  console.log("ID del producto obtenido:", data.id_producto, "productoSeleccionado:", idProductoSeleccionado, "nombre producto", nombreProductoSelec);
  if (limpiar) limpiarOVs();
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
  cantTotalCajasOP = 10 * cantLote;
  console.log("cantidad total de cajas por LOTE:", cantTotalCajasOP);
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
  //console.log("Canidad de lotteeee",cantidadPorLote );
  return detalleMultiplicado;
}

async function actualizarDetalleMateriales() {
  const productos = Array.from(document.querySelectorAll('.producto-item'));
  let detalleTotal = [];

  for (const p of productos) {
    const nombreProd = p.querySelector('select').value;
    const cantLote = parseInt(p.querySelector('input').value, 10);
    if (!nombreProd || cantLote <= 0) continue;

    const idProducto = await obtnerIdProducto(nombreProd, true);
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
  tabla.innerHTML = '';

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
  const container = document.getElementById('containerOVs');
  const lista = document.getElementById('listaOVs');

  if (valor === 'si') {
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
    lista.innerHTML = ''; // Limpiar OV agregadas previamente
  }
});

//agregar un input/select de OV
//ID_OV SE UN SELECTE QUE MUESTRE TODAS LAS ID_OV QUE HAY PENDIENTES
//ID_PRODUCTO ESTE RELACIONADO A ESA ID_OV
//CANTIDAD QUE SE AUTO COMPLETE CON LOS OTROS DATOS 

// Función para agregar un contenedor de OV

/*
async function agregarOV() {
  const lista = document.getElementById('listaOVs');

  const ovDisponibles = await obtenerOVsDisponibles(idProductoSeleccionado);

  if (!ovDisponibles || ovDisponibles.length === 0) {
    alert("No hay OV pendientes con este producto.");
    return;
  }

  const div = document.createElement('div');
  div.className = 'ov-item';
  div.style.marginTop = '5px';

  // Crear opciones con data-cantidad y data-producto
  const options = ovDisponibles.map(ov =>
    `<option value="${ov.id_detalle}" data-id_detalle="${ov.id_detalle}" data-cantidad="${ov.cantidad}" data-producto="${ov.producto}" data-cliente="${ov.id_cliente}">
    OV-${ov.id_orden} | Cliente: ${ov.id_cliente}
  </option>`
  ).join('');

  div.innerHTML = `
    <label>
      Orden de Venta
      <select name="ov_id[]" required onchange="llenarOV(this)">
        <option value="" disabled selected>Seleccione OV</option>
        ${options}
      </select>
    </label>

    <label>
      Producto:
      <input type="text" name="ov_producto[]" readonly>
    </label>

    <label>
      Cantidad: (unid. de Caja/s)
      <input type="number" name="ov_cantidad[]" min="1" readonly>
    </label>

    <button type="button" onclick="eliminarOV(this)">❌</button>
  `;

  lista.appendChild(div);
  document.getElementById('containerOVs').style.display = 'block';
}*/

// Función para agregar un contenedor de OV con Select2
async function agregarOV() {
  const lista = document.getElementById('listaOVs');
  const ovDisponibles = await obtenerOVsDisponibles(idProductoSeleccionado);

  if (!ovDisponibles || ovDisponibles.length === 0) {
    alert("No hay OV pendientes con este producto.");
    return;
  }

  const div = document.createElement('div');
  div.className = 'ov-item';
  div.style.marginTop = '5px';

  // Crear opciones con data adicionales
  const options = ovDisponibles.map(ov =>
    `<option value="${ov.id_detalle}" 
      data-id_detalle="${ov.id_detalle}" 
      data-cantidad="${ov.cantidad}" 
      data-producto="${ov.producto}" 
      data-cliente="${ov.id_cliente}">
      OV-${ov.id_orden} | Cliente: ${ov.id_cliente} | Prod: ${ov.producto}
    </option>`
  ).join('');

  div.innerHTML = `
    <label>
      Orden de Venta
      <select class="select-ov" name="ov_id[]" required onchange="llenarOV(this)">
        <option value="" disabled selected>Seleccione OV</option>
        ${options}
      </select>
    </label>
    <label>
      Producto:
      <input type="text" name="ov_producto[]" readonly>
    </label>

    <label>
      Cantidad: (unid. de Caja/s)
      <input type="number" name="ov_cantidad[]" min="1" readonly>
    </label>

    <label>
      Eliminar
      <button type="button" onclick="eliminarOV(this)">❌</button>
    </label>
  `;

  lista.appendChild(div);
  document.getElementById('containerOVs').style.display = 'block';

  const selectOV = div.querySelector('.select-ov');
  $(selectOV).select2({////VER EL FORMATO EN QUE SE BUSCA CLIENTE " "
    placeholder: "Buscar por OV (Ej: OV-12), Cliente (Ej: Cliente: 1).", 
    allowClear: true,
    dropdownParent: $(div),

    matcher: function (params, data) {
      if ($.trim(params.term) === '') return data;
      const term = params.term.toLowerCase();
      const text = data.text.toLowerCase();
      return text.includes(term) ? data : null;
    }
  });
}


function llenarOV(selectElement) {
  const cantidadInput = selectElement.closest('.ov-item').querySelector('input[name="ov_cantidad[]"]');
  const productoInput = selectElement.closest('.ov-item').querySelector('input[name="ov_producto[]"]');

  const selectedOption = selectElement.selectedOptions[0];
  cantidadInput.value = selectedOption?.dataset?.cantidad || 0;
  productoInput.value = selectedOption?.dataset?.producto || '';
}


function eliminarOV(btn) {
  const ovItem = btn.closest('.ov-item'); 
  if (!ovItem) return;

  const lista = document.getElementById('listaOVs');
  const ovItems = lista.querySelectorAll('.ov-item');
  const tieneOV = document.getElementById('tieneOV').value === 'si';

  if (tieneOV && ovItems.length === 1) {
    alert("Debe haber al menos una OV si marcó que hay relación con OP.");
    return;
  }

  const select = $(ovItem).find('.select-ov');
  if (select.data('select2')) {
    select.select2('destroy');
  }

  ovItem.remove();
}

async function obtenerOVsDisponibles(idProducto) {
  try {
    const { data: ordenes, error: errorOrdenes } = await supabaseClient
      .from('orden_ventas')
      .select('id_orden, estado, id_cliente')
      .eq('estado', 'pendiente');

    if (errorOrdenes) throw errorOrdenes;
    if (!ordenes || ordenes.length === 0) return [];

    //detalles pendientes de esa OV y producto
    const { data: detalles, error: errorDetalles } = await supabaseClient
      .from('detalle_ordenes')
      .select('id_detalle, id_orden, id_producto, cantidad, estado_detalle_ov')
      .eq('id_producto', idProducto)
      .eq('estado_detalle_ov', 'pendiente');

    if (errorDetalles) throw errorDetalles;
    if (!detalles || detalles.length === 0) return [];

    const idsValidos = ordenes.map(o => o.id_orden);
    const coincidencias = detalles.filter(d => idsValidos.includes(d.id_orden));
    if (coincidencias.length === 0) return [];

    const { data: productoData, error: errorProd } = await supabaseClient
      .from('productos')
      .select('nombre')
      .eq('id_producto', idProducto)
      .single();

    if (errorProd) throw errorProd;

    const resultados = coincidencias.map(d => {
      const orden = ordenes.find(o => o.id_orden === d.id_orden);
      return {
        id_detalle: d.id_detalle,
        id_orden: d.id_orden,
        cantidad: d.cantidad,
        producto: productoData?.nombre || 'Producto desconocido',
        id_cliente: orden?.id_cliente || null
      };
    });

    console.log("OV disponibles con cliente:", resultados);
    return resultados;

  } catch (error) {
    console.error("Error al obtener OV disponibles:", error);
    return [];
  }
}
//{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}


async function validarCantidadOVs() {
  try {
    const ovItems = document.querySelectorAll('.ov-item');
    let sumaCajas = 0;

    for (const item of ovItems) {
      const selectOV = item.querySelector('select[name="ov_id[]"]');
      const cantidadInput = item.querySelector('input[name="ov_cantidad[]"]');
      const idDetalle = selectOV.selectedOptions[0]?.dataset?.id_detalle || selectOV.value;

      if (!idDetalle) continue;

      const cantidadSeleccionada = parseInt(cantidadInput.value, 10) || 0;
      sumaCajas += cantidadSeleccionada;
    }
    if (sumaCajas > cantTotalCajasOP) {
      alert(`⚠️ La suma de cajas de las OV seleccionadas (${sumaCajas}) excede la cantidad a producir en esta OP (${cantTotalCajasOP})`);
      return false;
    } else {
      console.log(`✅ Cantidad total seleccionada: ${sumaCajas}, dentro del límite de OP (${cantTotalCajasOP})`);
    }

    return true;

  } catch (err) {
    console.error("Error general validando cantidades de OV:", err);
    alert("❌ Ocurrió un error al validar las cantidades de OV. Revisa la consola.");
    return false;
  }
}

async function guardarOVsEnOP(idOP) {
  try {
    const cantidadValida = await validarCantidadOVs();
    if (!cantidadValida) return;

    console.log("SE ESTA RESERVANDOOOOOO OV");
    const ovItems = document.querySelectorAll('.ov-item');

    for (const item of ovItems) {
      const selectOV = item.querySelector('select[name="ov_id[]"]');
      const idDetalle = selectOV.selectedOptions[0]?.dataset?.id_detalle || selectOV.value;
      const cantidad = item.querySelector('input[name="ov_cantidad[]"]').value;

      if (!idDetalle) continue;

      console.log("Insertando relación OP-OV con:", { idOP, idDetalle, cantidad });

      const { data, error } = await supabaseClient
        .from('op_ov')
        .insert([{ id_op: idOP, id_detalle_ov: idDetalle }]);

      if (error) {
        console.error("Error guardando relación OP-OV:", error);
        return false;
      }

      console.log("Guardado relación OP-OV:", data);

      await actualizarEstadoDetalleOV(idDetalle, 'reserva en produccion');
    }
    return true;

  } catch (err) {
    console.error("Error general en guardarOVsEnOP:", err);
    return false;
  }
}

// Función para actualizar el estado de un detalle de OV
async function actualizarEstadoDetalleOV(idDetalleOV, nuevoEstado) {
  try {
    const { data, error } = await supabaseClient
      .from('detalle_ordenes')
      .update({ estado_detalle_ov: nuevoEstado })
      .eq('id_detalle', idDetalleOV);

    if (error) {
      console.error(`Error actualizando estado del detalle OV ${idDetalleOV}:`, error);
      return false;
    }

    console.log(`Estado del detalle OV ${idDetalleOV} actualizado a '${nuevoEstado}'`);
    return true;

  } catch (err) {
    console.error("Error general al actualizar estado de detalle OV:", err);
    return false;
  }
}

// Función para mostrar mensaje de éxito tras crear OP
async function mostrarMensajeExito(idOrden) {
  try {
    const { data, error } = await supabaseClient
      .from('orden_produccion')
      .select('*')
      .eq('id_orden_produccion', idOrden)
      .single();

    if (error || !data) {
      console.error("Error al obtener datos de OP:", error);
      return;
    }

    const productosHtml = data.ver_orden
      .map(p => `<p>${p.nombre} - Cantidad de Lote/s: ${p.cantidad} - Cantidad de Cajas Estimadas: ${p.cantidad * cantidadPorLote}</p>`)
      .join('');

    const { data: detalleLotes, error: errorLotes } = await supabaseClient
      .from('detalle_lote_op')
      .select('*')
      .eq('id_orden_produccion', idOrden);

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

    const { data: detalleOVs, error: errorOVs } = await supabaseClient
      .from('op_ov')
      .select('id_detalle_ov')
      .eq('id_op', idOrden);

    let ovsHtml = '';
    if (detalleOVs && detalleOVs.length > 0) {
      for (const ov of detalleOVs) {
        const { data: detalle } = await supabaseClient
          .from('detalle_ordenes')
          .select('id_detalle,id_orden, id_producto, cantidad, estado_detalle_ov')
          .eq('id_detalle', ov.id_detalle_ov)
          .single();

        const { data: prod } = await supabaseClient
          .from('productos')
          .select('nombre')
          .eq('id_producto', detalle.id_producto)
          .single();

        ovsHtml += `<tr>
          <td>${prod ? prod.nombre : 'Desconocido'}</td>
          <td>${detalle.id_orden}</td>
          <td>${detalle.id_detalle}</td>
          <td>${detalle.cantidad}</td>
          <td>${detalle.estado_detalle_ov}</td>
        </tr>`;
      }

      ovsHtml = `<h4>OV involucradas:</h4>
        <table border="1" style="width:100%; margin-top:10px;">
          <thead>
            <tr>
              <th>Producto</th>
              <th>ID Orden OV</th>
              <th>ID Det. OV</th>
              <th>Cantidad</th>
              <th>Est. det. OV</th>
            </tr>
          </thead>
          <tbody>
            ${ovsHtml}
          </tbody>
        </table>`;
    } else {
      ovsHtml = '<p>No hay OV involucradas en esta OP.</p>';
    }

    const mensaje = document.getElementById('mensajeExito');
    const texto = document.getElementById('textoExito');

    texto.innerHTML = `
      <h3>✅ Orden de Producción Creada</h3>
      <p><strong>Número OP:</strong> ${data.numero_op}</p>
      <p><strong>Fecha Emisión:</strong> ${new Date(data.fecha_emision).toLocaleString()}</p>
      <p><strong>Estado:</strong> ${data.estado}</p>
      <h4>Producto:</h4>
      ${productosHtml}
      <h4>Lotes de Materiales reservados:</h4>
      ${lotesHtml}
      ${ovsHtml}
    `;

    mensaje.style.display = 'block';
    document.getElementById('ordenProduccion').style.display = 'none';

    document.getElementById('btnCrearOPNuevo').onclick = () => {
      mensaje.style.display = 'none';
      document.getElementById('opForm').reset();
      document.getElementById('ordenProduccion').style.display = 'block';
      prepararNuevaOP();
    };

    document.getElementById('btnVolverMenu').onclick = () => {
      mensaje.style.display = 'none';
      volverMenuPrincipal();
    };

    document.getElementById('btnVerListaOP').onclick = () => {
      mensaje.style.display = 'none';
      mostrarSeccion('seguimientoOP');
      cargarOP();
    };

  } catch (err) {
    console.error("Error en mostrarMensajeExito:", err);
  }
}

function volverMenuPrincipal() {
  const secciones = document.querySelectorAll('.seccion');
  secciones.forEach(sec => sec.style.display = 'none');

  const mensajeExito = document.getElementById('mensajeExito');
  if (mensajeExito) mensajeExito.style.display = 'none';

  document.querySelector('.main-content h1').style.display = 'block';
}
//{{{{{{{{{{{{{{{{{{{{{{{{{{{{{}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
function limpiarOVs() {
  const selectTieneOV = document.getElementById('tieneOV');
  const containerOV = document.getElementById('containerOVs');
  const listaOVs = document.getElementById('listaOVs');

  if (selectTieneOV) selectTieneOV.value = 'no';
  if (containerOV) containerOV.style.display = 'none';
  if (listaOVs) listaOVs.innerHTML = '';

  console.log("#### OV limpiadas porque cambió el producto");
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

  const { data: detalleOVs, error: errorOVs } = await supabaseClient
    .from('op_ov')
    .select('id_detalle_ov')
    .eq('id_op', id_orden_produccion);

  let ovsHtml = '';
  if (detalleOVs && detalleOVs.length > 0) {
    for (const ov of detalleOVs) {
      const { data: detalle } = await supabaseClient
        .from('detalle_ordenes')
        .select('id_detalle,id_orden, id_producto, cantidad, estado_detalle_ov')
        .eq('id_detalle', ov.id_detalle_ov)
        .single();

      const { data: prod } = await supabaseClient
        .from('productos')
        .select('nombre')
        .eq('id_producto', detalle.id_producto)
        .single();

      ovsHtml += `<tr>
      <td>${prod ? prod.nombre : 'Desconocido'}</td>
      <td>${detalle.id_orden}</td>
      <td>${detalle.id_detalle}</td>
      <td>${detalle.cantidad}</td>
      <td>${detalle.estado_detalle_ov}</td>
    </tr>`;
    }

    ovsHtml = `<h4>OV involucradas:</h4>
    <table border="1" style="width:100%; margin-top:10px;">
      <thead>
        <tr>
          <th>Producto</th>
          <th>ID Orden OV</th>
          <th>ID Det. OV</th>
          <th>Cantidad</th>
          <th>Est. det. OV</th>
        </tr>
      </thead>
      <tbody>
        ${ovsHtml}
      </tbody>
    </table>`;
  } else {
    ovsHtml = '<p>No hay OV involucradas en esta OP.</p>';
  }

  document.getElementById('detalleOrden').innerHTML = `
    <p><strong>Número OP:</strong> ${data.numero_op}</p>
    <p><strong>Fecha Emisión:</strong> ${new Date(data.fecha_emision).toLocaleString()}</p>
    <p><strong>Estado:</strong> ${data.estado}</p>
    <h4>Productos:</h4>
    ${productosHtml}
    <h4>Lotes reservados:</h4>
    ${lotesHtml}
    ${ovsHtml} 
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
