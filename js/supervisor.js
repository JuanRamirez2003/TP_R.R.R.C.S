
src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js"

const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

function mostrarSeccion(id) {
  document.querySelectorAll('.seccion').forEach(s => s.style.display = 'none');
  document.getElementById(id).style.display = 'block';

  const mensajeExito = document.getElementById('mensajeExitoOP');
  if (mensajeExito) mensajeExito.style.display = 'none';

  // ✅ Ocultar el mensaje de éxito de OP si estaba visible
  const textoExito = document.getElementById('textoExitoOP');
  if (textoExito) textoExito.style.display = 'none';

  if (id === "ordenProduccion") {

    prepararNuevaOP(); // vuelve a generar número OP, etc.
  }


  if (id === "seguimientoOP") cargarOP();
}


const btnMenuCreacionOP = document.getElementById('btnMenuCreacionOP');
if (btnMenuCreacionOP) {
  btnMenuCreacionOP.addEventListener('click', () => {
    const mensaje = document.getElementById('mensajeExitoOP');
    if (mensaje) mensaje.style.display = 'none';
    const form = document.getElementById('opForm');
    if (form) form.reset();
    document.getElementById('ordenProduccion').style.display = 'block';


    // Ocultar TODO el seguimiento
    const seguimientoCont = document.getElementById('seguimientoOP');
    if (seguimientoCont) seguimientoCont.style.display = 'none';

    prepararNuevaOP();
  });
}


let productosDisponibles = [];
let nombreProductoSelec = null;
let idProductoSeleccionado = null;
let cantidadPorLote = 10;
let cantTotalCajasOP = null;//para el limete de cantida de reserva 
let ovDisponiblesGlobal = []; // todas las OV posibles para el producto
let ovSeleccionadasGlobal = []; // id_detalle de OV que ya se seleccionaron


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




//prepararNuevaOP();

async function prepararNuevaOP() {


  document.getElementById('btnCrearOP').disabled = true;
  $('.select-ov').select2('destroy');
  document.getElementById('listaOVs').innerHTML = '';
  document.getElementById('productosContainer').innerHTML = '';
  idProductoSeleccionado = null;
  nombreProductoSelec = null;

  await cargarProductosDisponibles();
  agregarProducto();

  mostrarDetalleMateriales([]);
  idProductoSeleccionado = null;
  nombreProductoSelec = null;

  await generarNumeroOP().then(numeroOP => {
    console.log("Número OP generado:", numeroOP);
    document.getElementById('opNumero').value = numeroOP;

    boton.disabled = true;
    boton.textContent = 'Crear OP';
    creandoOP = false;
  });
}

function agregarProducto() {
  const container = document.getElementById('productosContainer');
  // ✅ Limpiar el contenedor para que solo haya un producto
  container.innerHTML = '';

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
  prepararNuevaOP();

  document.getElementById('opForm').reset();
  document.getElementById('productosContainer').innerHTML = '';
  document.getElementById('ordenProduccion').style.display = 'none';


}

// Crear OP y guardar en Supabase
document.getElementById('opForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await crearOPSupaBase()
});


async function crearOPSupaBase() {


  const productos = Array.from(document.querySelectorAll('.producto-item')).map(p => ({
    nombre: p.querySelector('select').value,
    cantidad: parseInt(p.querySelector('input').value, 10)
  }));
  if (productos.some(p => !p.nombre || p.cantidad <= 0)) {
    mostrarAviso("Complete todos los productos con cantidad válida");//Alert
    return;
  }
  console.log(productos[0].nombre);

  const numeroOP = document.getElementById('opNumero').value;
  const fecha = new Date().toISOString();

  const prioridad = document.getElementById('prioridadOP').value;

  const idProducto = await obtnerIdProducto(productos[0].nombre, false);
  if (!idProducto) {
    mostrarAviso("No se pudo obtener el ID del producto");//Alert
    return;
  }
  const idReceta = await obtenerRecetaPorProducto(idProducto);
  if (!idReceta) {
    mostrarAviso("No se encontró receta para este producto");//Alert
    return;
  }

  const detalleReceta = await detalleMateriales(idProducto, productos[0].cantidad);
  console.log("Detalle de receta:", detalleReceta);
  const stockSuficiente = await verificarStockSuficiente(detalleReceta);
  if (!stockSuficiente) {
    mostrarAviso("No hay suficiente stock para producir este lote.");//Alert
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
    estado: 'Pendiente',
    fecha_estimada_entrega: calcularFechaPorPrioridad(prioridad),
    prioridad: prioridad
  }])
    .select();
  if (error) return console.error("Error al guardar OP:", error);

  const idOrden = data[0].id_orden_produccion;

  const okOV = await guardarOVsEnOP(idOrden);
  if (!okOV) {
    mostrarAviso("Error al guardar las OV asociadas a la OP.");//alert
    return;
  }
  console.log("Orden de Producción creada con éxito.");

  for (const mat of detalleReceta) {
    const ok = await reservarLotes(idOrden, mat.id_mp, mat.cantidad_total);
    if (!ok) {
      mostrarAviso(`No se pudo reservar los lotes para el material ${mat.nombre_material} (ID ${mat.id_mp})`);//alert
      return;
    }
  }
  console.log(idOrden)
  mostrarMensajeExito(idOrden);

  /*
    cancelarOP();
    mostrarSeccion('seguimientoOP');
    cargarOP();*/
}

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
    mostrarAviso("⚠️ Algunos materiales no tienen suficiente stock. Revisa la tabla para más detalles.");//alert
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

// Función para agregar un contenedor de OV con Select2
async function agregarOV() {
  const lista = document.getElementById('listaOVs');

  const ovDisponibles = await obtenerOVsDisponibles(idProductoSeleccionado);

  if (!ovDisponibles || ovDisponibles.length === 0) {
    mostrarAviso("No hay OV pendientes con este producto.");//Alert
    return;
  }

  const seleccionadas = Array.from(document.querySelectorAll('.select-ov'))
    .map(sel => sel.value)
    .filter(v => v !== '');

  const ovFiltradas = ovDisponibles.filter(ov => !seleccionadas.includes(String(ov.id_detalle)));

  if (ovFiltradas.length === 0) {
    mostrarAviso("Todas las OV disponibles ya fueron seleccionadas.");//alert
    return;
  }

  const div = document.createElement('div');
  div.className = 'ov-item';
  div.style.marginTop = '5px';

  const options = ovFiltradas.map(ov => `
    <option value="${ov.id_detalle}"
      data-id_detalle="${ov.id_detalle}"
      data-cantidad="${ov.cantidad}"
      data-producto="${ov.producto}"
      data-cliente="${ov.id_cliente}">
      OV-${ov.id_orden} | Cliente: ${ov.id_cliente}
    </option>
  `).join('');

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
      Cantidad (unid. de Caja/s):
      <input type="number" name="ov_cantidad[]" min="1" readonly>
    </label>

    <label>
      Eliminar:
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

  $(selectOV).on('change', actualizarSelectsOV);
  $(selectOV).on('select2:select', actualizarSelectsOV);

  actualizarSelectsOV();
}

function actualizarSelectsOV() {
  const seleccionadas = Array.from(document.querySelectorAll('.select-ov'))
    .map(sel => sel.value)
    .filter(v => v !== '');

  document.querySelectorAll('.select-ov').forEach(select => {
    const $select = $(select);
    const currentValue = $select.val();

    $select.find('option').each(function () {
      const val = $(this).val();
      if (val && val !== currentValue) {
        $(this).prop('disabled', seleccionadas.includes(val));
      }
    });

    $select.trigger('change.select2');
  });
}
/*
function actualizarTodosLosSelectsOV() {
  const todas = document.querySelectorAll('.select-ov');

  // Recalcular la lista de OV seleccionadas
  ovSeleccionadas = new Set(
    Array.from(todas)
      .map(sel => sel.value)
      .filter(v => v !== '')
  );

  // Refrescar todos los selects
  todas.forEach(select => {
    const currentVal = select.value;
    $(select).find('option').each(function () {
      const val = $(this).val();
      if (val && val !== currentVal) {
        $(this).prop('disabled', ovSeleccionadas.has(val));
      }
    });
    $(select).trigger('change.select2');
  });
}
*/


function llenarOV(selectElement) {
  const cantidadInput = selectElement.closest('.ov-item').querySelector('input[name="ov_cantidad[]"]');
  const productoInput = selectElement.closest('.ov-item').querySelector('input[name="ov_producto[]"]');

  const selectedOption = selectElement.selectedOptions[0];
  cantidadInput.value = selectedOption?.dataset?.cantidad || 0;
  productoInput.value = selectedOption?.dataset?.producto || '';
  //actualizarTodosLosSelectsOV();
}


function eliminarOV(btn) {
  const ovItem = btn.closest('.ov-item');
  if (!ovItem) return;

  const lista = document.getElementById('listaOVs');
  const ovItems = lista.querySelectorAll('.ov-item');
  const tieneOV = document.getElementById('tieneOV').value === 'si';

  if (tieneOV && ovItems.length === 1) {
    mostrarAviso("Debe haber al menos una OV si marcó que hay relación con OP.");//alert
    return;
  }

  const select = $(ovItem).find('.select-ov');
  if (select.data('select2')) {
    select.select2('destroy');
  }

  ovItem.remove();
  actualizarSelectsOV();
  //actualizarTodosLosSelectsOV();
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
      mostrarAviso(`⚠️ La suma de cajas de las OV seleccionadas (${sumaCajas}) excede la cantidad a producir en esta OP (${cantTotalCajasOP})`);//Alert
      return false;
    } else {
      console.log(`✅ Cantidad total seleccionada: ${sumaCajas}, dentro del límite de OP (${cantTotalCajasOP})`);
    }

    return true;

  } catch (err) {
    console.error("Error general validando cantidades de OV:", err);
    mostrarAviso("❌ Ocurrió un error al validar las cantidades de OV. Revisa la consola.");//alert VER
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
    console.log("ESTA ACCCCCAAA");
    console.log(data.ver_orden);
    const productosHtml = data.ver_orden
      .map(p => `<p>${p.nombre.toUpperCase()}</p>  <p>Cantidad de Lote/s: ${p.cantidad}</p> <p>Cantidad de Cajas Estimadas: ${p.cantidad * cantidadPorLote}</p>`)
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

        lotesHtml += `<tr onclick="verDetalleLote('${lote.id_lote}')" style="cursor:pointer;">
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

    const mensaje = document.getElementById('mensajeExitoOP');
    const texto = document.getElementById('textoExitoOP');

    texto.innerHTML = ` 
      <h3>✅ Orden de Producción Creada</h3>
      <p><strong>Número OP:</strong> ${data.numero_op}</p>
      <p><strong>Fecha Emisión:</strong> ${new Date(data.fecha_emision).toLocaleString()}</p>
      <p><strong>Estado:</strong> ${data.estado}</p>
      <p><strong>Fecha Estimada de Entrega:</strong> ${data.fecha_estimada_entrega}</p>
      <p><strong>Prioridad:</strong> ${data.prioridad.toUpperCase()}</p>
      <p><strong>Producto:</strong></p>
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

  const mensaje = document.getElementById('mensajeExitoOP');
  if (mensaje) mensaje.style.display = 'none';
  const tablaOP = document.getElementById('tablaOP');
  if (tablaOP) tablaOP.innerHTML = ''; // limpia el contenido


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
      <td>${op.prioridad}</td>
      <td>
        ${op.estado === 'Pendiente'
        ? `<button onclick="editarOP(${op.id_orden_produccion})" class="btn-editar">✏️ Editar</button>
             <button onclick="eliminarOP(${op.id_orden_produccion})" class="btn-eliminar">❌Dar Baja</button>`
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
    .map(p => `<p>${p.nombre.toUpperCase()}</p>  <p>Cantidad de Lote/s: ${p.cantidad}</p> <p>Cantidad de Cajas Estimadas: ${p.cantidad * cantidadPorLote}</p>`)
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

      lotesHtml += `<tr onclick="verDetalleLote('${lote.id_lote}')" style="cursor:pointer;">
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
    <p><strong>Fecha Estimada de Entrega:</strong> ${data.fecha_estimada_entrega}</p>
    <p><strong>Prioridad:</strong> ${data.prioridad.toUpperCase()}</p>
    <p><strong>Producto:</strong></p>
    ${productosHtml}
    <h4>Lotes reservados:</h4>
    ${lotesHtml}
    ${ovsHtml} 
  `;

  document.getElementById('modalOrden').style.display = 'flex';
}

function cerrarModal() { document.getElementById('modalOrden').style.display = 'none'; }
//////////////////////////
//Editar OP
async function editarOP(id_orden_produccion) {
  // Obtener la OP desde Supabase
  const { data, error } = await supabaseClient
    .from('orden_produccion')
    .select('*')
    .eq('id_orden_produccion', id_orden_produccion)
    .single();

  if (error) {
    console.error("Error al cargar OP para editar:", error);
    mostrarAviso("Ocurrió un error al cargar la orden de producción.");//alert
    return;
  }

  let huboCambios = false; // bandera para detectar modificaciones

  // Editar las cantidades de los productos
  const productos = data.ver_orden.map(p => {
    const cant = prompt(`Editar cantidad de ${p.nombre}:`, p.cantidad);

    // Si el usuario cancela el prompt, mantener el valor original
    if (cant === null) return p;

    const cantidadNum = parseInt(cant, 10);

    // Validación de cantidad
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      mostrarAviso(`La cantidad para ${p.nombre} debe ser un número mayor que 0.`);//alert
      return p;
    }

    // Si la cantidad cambió, marcar bandera
    if (cantidadNum !== p.cantidad) huboCambios = true;

    return { nombre: p.nombre, cantidad: cantidadNum };
  });

  // Si no hubo cambios, no actualizar ni mostrar alerta
  if (!huboCambios) {
    console.log("No se realizaron cambios en la OP.");
    return;
  }

  // Actualizar la OP en la base de datos
  const { error: updateError } = await supabaseClient
    .from('orden_produccion')
    .update({ ver_orden: productos })
    .eq('id_orden_produccion', id_orden_produccion);

  if (updateError) {
    console.error("Error al actualizar OP:", updateError);
    mostrarAviso("Error al actualizar la orden de producción.");
  } else {
    mostrarAviso("✅ La orden de producción se actualizó correctamente.");
  }
}


// Eliminar OP (Falta retornar stock reservado)
// Dar de baja una OP y devolver materias primas reservadas a los lotes
async function eliminarOP(id_orden_produccion) {
  const confirmado = await mostrarConfirmacion("¿Dar de baja esta OP y devolver las materias primas reservadas?");
  if (!confirmado) return;

  console.log("🟢 Dando de baja OP:", id_orden_produccion);

  // 1️⃣ Obtener detalle de la OP
  const { data: op, error: opError } = await supabaseClient
    .from('orden_produccion')
    .select('id_orden_produccion, detalle_materiales')
    .eq('id_orden_produccion', id_orden_produccion)
    .single();

  if (opError || !op) {
    console.error("❌ Error al obtener la OP:", opError);
    mostrarAviso("No se pudo obtener la información de la orden.");//alert
    return;
  }

  // Parsear el JSON por si viene como string
  let detalleMateriales = op.detalle_materiales;
  if (typeof detalleMateriales === "string") {
    try {
      detalleMateriales = JSON.parse(detalleMateriales);
    } catch (err) {
      console.error("❌ Error al parsear detalle_materiales:", err);
      mostrarAviso("Error al leer los materiales de la OP.");//alert
      return;
    }
  }

  // 2️⃣ Cambiar estado a 'Baja'
  const { error: updateOpError } = await supabaseClient
    .from('orden_produccion')
    .update({ estado: 'Baja' })
    .eq('id_orden_produccion', id_orden_produccion);

  if (updateOpError) {
    console.error("❌ Error al cambiar estado de OP:", updateOpError);
    mostrarAviso("Error al dar de baja la OP.");//alert
    return;
  }

  // 3️⃣ Reponer las cantidades en lote_mp según id_mp
  let materialesActualizados = 0;

  for (const mat of detalleMateriales) {
    const id_mp = mat.id_mp;
    const cantidad = Number(mat.cantidad_total);

    if (!id_mp || isNaN(cantidad) || cantidad <= 0) {
      console.warn("⚠️ Material inválido:", mat);
      continue;
    }

    // Buscar el lote más reciente o cualquier lote asociado al id_mp
    const { data: lote, error: loteError } = await supabaseClient
      .from('lote_mp')
      .select('id_lote, cantidad_disponible, cantidad_reservada')
      .eq('id_mp', id_mp)
      .order('id_lote', { ascending: false })
      .limit(1)
      .single();

    if (loteError || !lote) {
      console.error(`❌ No se encontró lote para id_mp=${id_mp}:`, loteError);
      continue;
    }

    const nuevaDisponible = (lote.cantidad_disponible || 0) + cantidad;
    const nuevaReservada = Math.max((lote.cantidad_reservada || 0) - cantidad, 0);

    // Actualizar las cantidades
    const { error: updateLoteError } = await supabaseClient
      .from('lote_mp')
      .update({
        cantidad_disponible: nuevaDisponible,
        cantidad_reservada: nuevaReservada
      })
      .eq('id_lote', lote.id_lote);

    if (updateLoteError) {
      console.error(`❌ Error al actualizar lote ${lote.id_lote}:`, updateLoteError);
    } else {
      console.log(`✅ Lote ${lote.id_lote} actualizado correctamente`);
      materialesActualizados++;
    }
  }

  if (materialesActualizados > 0) {
    mostrarAviso(`✅ OP dada de baja y se devolvieron las cantidades de ${materialesActualizados} material(es).`);//alert
  } else {
    mostrarAviso("⚠️ OP dada de baja, pero no se devolvió stock (ver consola).");//alert VER
  }

  cargarOP(); // refresca la vista
}

//////
async function verificarStockMaterias() {
  try {
    const { data, error } = await supabaseClient
      .from('materiales')
      .select('*');

    if (error) {
      console.error("Error cargando materiales:", error);
      return;
    }

    // Filtrar materiales con stock menor al mínimo
    const faltantes = data.filter(mat => (mat.stock_disponible ?? 0) < (mat.stock_minimo ?? 0));

    const notificacion = document.getElementById('notificacionStock');
    const tooltip = document.getElementById('tooltipStock');
    const listaFaltantes = document.getElementById('listaFaltantes');
    const btnIrPedido = document.getElementById('btnIrPedido');

    listaFaltantes.innerHTML = ''; // limpiar la lista antes

    if (faltantes.length > 0) {
      notificacion.style.display = 'flex';
      notificacion.style.backgroundColor = '#f44336'; // rojo alerta

      // Generar lista de materiales faltantes
      faltantes.forEach(mat => {
        const li = document.createElement('li');
        const cantidadFaltante = (mat.stock_minimo ?? 0) - (mat.stock_disponible ?? 0);
        let unidad = mat.tipo?.toLowerCase() === 'kilogramos' ? 'kg' : 'unidades';
        li.textContent = `${mat.nombre}: faltan ${cantidadFaltante} ${unidad}`;
        listaFaltantes.appendChild(li);
      });

      btnIrPedido.style.display = 'inline-block';
      btnIrPedido.onclick = () => {
        localStorage.setItem('materiasFaltantes', JSON.stringify(faltantes));
        window.location.href = 'supervisor_oc.html';
      };

    } else {
      notificacion.style.display = 'flex';
      notificacion.style.backgroundColor = '#4CAF50'; // verde todo OK
      const li = document.createElement('li');
      li.textContent = '✅ Todos los materiales tienen stock suficiente.';
      listaFaltantes.appendChild(li);
      btnIrPedido.style.display = 'none';
    }

    // Animación ligera al pasar el mouse
    notificacion.onmouseenter = () => notificacion.style.transform = 'scale(1.1)';
    notificacion.onmouseleave = () => notificacion.style.transform = 'scale(1)';

    // Toggle del tooltip al hacer click en la campanita
    notificacion.onclick = () => {
      tooltip.style.display = tooltip.style.display === 'none' ? 'block' : 'none';
    };

  } catch (err) {
    console.error("Error verificando stock de materias:", err);
  }
}


function calcularFechaPorPrioridad(prioridad) {
  const hoy = new Date();
  let diasSumar = 0;

  switch (prioridad?.toLowerCase()) {
    case 'urgente':
      diasSumar = 0; // mismo día
      break;
    case 'alta':
      diasSumar = 2; // 2 días
      break;
    case 'normal':
      diasSumar = 5; // 5 días
      break;
    case 'baja':
      diasSumar = 14; // 2 semanas
      break;
    default:
      diasSumar = 7; // valor por defecto
      break;
  }

  hoy.setDate(hoy.getDate() + diasSumar);
  return hoy.toISOString().split('T')[0]; // yyyy-mm-dd
}

//==============VER DETALLE DE LOTE RESERVADOS ==================
async function verDetalleLote(idLote) {
  try {
    // Traemos el  específico
    const { data: lote, error: errorLote } = await supabaseClient
      .from('lote_mp')
      .select('*')
      .eq('id_lote', idLote)
      .single();
    if (errorLote || !lote) throw errorLote || 'Lote no encontrado';

    const { data: proveedor, error: errorProv } = await supabaseClient
      .from('proveedor')
      .select('nombre')
      .eq('id_proveedor', lote.id_proveedor)
      .single();
    if (errorProv) throw errorProv;

    const { data: material, error: errorMat } = await supabaseClient
      .from('materiales')
      .select('nombre')
      .eq('id_mp', lote.id_mp)
      .single();
    if (errorMat) throw errorMat;

    const modal = document.getElementById('modalDetalleLote');
    const contenido = document.getElementById('contenidoModalDetalleLote');

    contenido.innerHTML = `
      <p><strong>ID Lote:</strong> ${lote.id_lote}</p>
      <p><strong>Material:</strong> ${material?.nombre.toUpperCase() || lote.id_mp}</p>
      <p><strong>Nombre Proveedor:</strong> ${proveedor?.nombre || '-'}</p>
      
      <p><strong>Cantidad Disponible:</strong> ${lote.cantidad_disponible}</p>
      
      <p><strong>Fecha Ingreso:</strong> ${lote.fecha_ingreso ? new Date(lote.fecha_ingreso).toLocaleDateString() : '-'}</p>
      <p><strong>Fecha Caducidad:</strong> ${lote.fecha_caducidad ? new Date(lote.fecha_caducidad).toLocaleDateString() : '-'}</p>
      <p><strong>Estado:</strong> ${lote.estado}</p>
    `;
    //<p><strong>Lote:</strong> ${lote.lote}</p>
    //<p><strong>Cantidad Consumida:</strong> ${lote.cantidad_consumida}</p>
    modal.style.display = 'flex';

  } catch (err) {
    console.error("Error mostrando detalle del lote:", err);
    mostrarAviso("No se pudo mostrar el detalle del lote.");//alert
  }
}

const modal = document.getElementById('modalDetalleLote');
const botonCerrar = document.getElementById('cerrarModalDetalleLote');

botonCerrar.onclick = () => {
  modal.style.display = 'none';
};

window.onclick = (event) => {
  if (event.target === modal) {
    modal.style.display = 'none';
  }
}

function mostrarAviso(mensaje) {
  const modal = document.getElementById('modalAviso');
  const mensajeP = document.getElementById('mensajeAvisoTexto');
  const btnCerrar = document.getElementById('btnCerrarAviso');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de aviso");
    return alert(mensaje);
  }

  mensajeP.textContent = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
}

function mostrarConfirmacion(mensaje) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modalConfirmacion');
    const texto = document.getElementById('mensajeConfirmacionTexto');
    const btnCancelar = document.getElementById('btnCancelarConfirmacion');
    const btnAceptar = document.getElementById('btnAceptarConfirmacion');

    if (!modal || !texto || !btnCancelar || !btnAceptar) {
      console.error("⚠️ No se encontró el modal de confirmación");
      return resolve(false);
    }

    texto.textContent = mensaje;
    modal.classList.add('mostrar');

    // Cerrar con botones
    btnCancelar.onclick = () => {
      modal.classList.remove('mostrar');
      resolve(false);
    };

    btnAceptar.onclick = () => {
      modal.classList.remove('mostrar');
      resolve(true);
    };

    // Cerrar al hacer clic fuera
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove('mostrar');
        resolve(false);
      }
    };
  });
}

// Inicialización al cargar la página
(async () => {
  await cargarProductosDisponibles();
  prepararNuevaOP();
  verificarStockMaterias();
})();

//Buscador Seguimiento OP
document.getElementById("buscador").addEventListener("input", e => {
  const valor = e.target.value.toLowerCase();
  const items = document.querySelectorAll("#tablaOP tr"); // o cualquier clase/lista

  items.forEach(item => {
    const texto = item.textContent.toLowerCase();
    item.style.display = texto.includes(valor) ? "" : "none";
  });
});

///------------------------Notificacion-----------------------------------------
// Mostrar/ocultar ventana al hacer click
document.getElementById("btnNotificaciones").addEventListener("click", () => {
  const ventana = document.getElementById("ventanaNotificaciones");
  ventana.style.display = ventana.style.display === "block" ? "none" : "block";
});

// Función para actualizar notificaciones con vista mejorada
async function actualizarNotificaciones() {
  try {
    const { data: lotes, error } = await supabaseClient
      .from("lote_mp")
      .select("id_lote, lote, materiales(nombre), fecha_caducidad, cantidad_disponible")
      .order("fecha_caducidad", { ascending: true });

    if (error) throw error;

    const hoy = new Date();

    const proximosAVencer = lotes.filter(lote => {
      if (!lote.fecha_caducidad) return false;
      if ((lote.cantidad_disponible ?? 0) <= 0) return false; // ignorar no disponible
      const diffDias = (new Date(lote.fecha_caducidad) - hoy) / (1000 * 60 * 60 * 24);
      return diffDias <= 14 && diffDias >= 0;
    });

    const contador = document.getElementById("contadorNotificaciones");
    contador.textContent = proximosAVencer.length;
    contador.style.display = proximosAVencer.length > 0 ? "inline-block" : "none";

    const lista = document.getElementById("listaNotificaciones");
    if (proximosAVencer.length === 0) {
      lista.innerHTML = `<li>No hay notificaciones pendientes</li>`;
    } else {
      lista.innerHTML = proximosAVencer.map(lote => {
        const fechaCad = new Date(lote.fecha_caducidad);
        const diffDias = Math.floor((fechaCad - hoy) / (1000 * 60 * 60 * 24));
        return `<li class="notif-item">
          <span class="notif-lote-nombre">${lote.materiales?.nombre || '—'}</span>
          <span class="notif-lote-codigo">Lote: ${lote.lote}</span>
          <span class="notif-proximo">Próximo a vencer: ${diffDias} días</span>
          <span class="notif-lote-caducidad">Fecha de Vencimiento: ${lote.fecha_caducidad}</span>
        </li>`;
      }).join("");
    }
  } catch (err) {
    console.error("Error actualizando notificaciones:", err);
  }
}


document.addEventListener("DOMContentLoaded", () => {
  actualizarNotificaciones(); // carga inicial
  setInterval(actualizarNotificaciones, 5 * 60 * 1000); // actualizar cada 5 min
});


//----------IMPIDE EL DOBEL CLIKC DE creaOP
const boton = document.getElementById('btnCrearOP');
let creandoOP = false;

boton.addEventListener('click', async () => {
  if (creandoOP || boton.disabled) return;
  creandoOP = true;
  boton.disabled = true;
  boton.textContent = 'Creando...';

  try {
    await crearOPSupaBase();
  } catch (err) {
    console.error(err);
    mostrarAviso("❌ Error al crear la OP.");
    boton.disabled = false;
    boton.textContent = 'Crear OP';
    creandoOP = false;
  }
});
