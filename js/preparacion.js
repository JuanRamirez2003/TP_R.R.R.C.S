
// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

function mostrarSeccion(seccionId) {

  if (seccionId === 'preparacionPedido') {
    document.getElementById('preparacionPedido').style.display = 'block';
    cargarPedidosDesdeSupabase();
  }
}

async function cargarOPFinalizadas() {
  const { data, error } = await supabaseClient
    .from("orden_produccion")
    .select(`
        id_op,
        numero_op,
        estado,
        linea_produccion
    `)
    .eq("estado", "finalizada");

  if (error) {
    console.error("Error al obtener OP finalizadas:", error);
    return [];
  }

  console.log("🔹 OP FINALIZADAS:", data);
  return data;
}


async function cargarOpOvDeOpFinalizadas(opFinalizadas) {
  const idsFinalizadas = opFinalizadas.map(op => op.id_op);

  const { data, error } = await supabaseClient
    .from("op_ov")
    .select(`
        id,
        id_op,
        id_detalle_ov,
        linea_produccion,
        orden_produccion:id_op (
          numero_op,
          estado
        )
    `)
    .in("id_op", idsFinalizadas);   // SOLO OP FINALIZADAS

  if (error) {
    console.error("Error al obtener op_ov:", error);
    return [];
  }

  console.log("🔹 OP_OV de OP FINALIZADAS:", data);
  return data;
}


function agruparPorOV(detalles) {
  const agrupadas = {};

  detalles.forEach(det => {
    const idOV = det.id_orden;
    if (!agrupadas[idOV]) agrupadas[idOV] = [];
    agrupadas[idOV].push(det);
  });

  return agrupadas;
}


async function cargarPedidosDesdeSupabase() {

  // 1️⃣ Cargar OP finalizadas
  const opFinalizadas = await cargarOPFinalizadas();
  if (!opFinalizadas.length) {
    console.warn("No hay OP finalizadas.");
    cargarTablaPreparacion([]); // tabla vacía
    return;
  }

  // 2️⃣ Cargar op_ov para esas OP
  const opOv = await cargarOpOvDeOpFinalizadas(opFinalizadas);

  const idsDetalles = opOv
    .map(x => x.id_detalle_ov)
    .filter(id => id != null);

  if (!idsDetalles.length) {
    console.warn("Las OP finalizadas no tienen detalles asociados.");
    cargarTablaPreparacion([]);
    return;
  }

  const { data: detalles, error } = await supabaseClient
    .from("detalle_ordenes")
    .select(`
        id_detalle,
        id_orden,
        cantidad,
        fecha_estimada_entrega,
        estado_preparacion,
        producto:id_producto (nombre)
    `)
    .in("id_detalle", idsDetalles);

  if (error) {
    console.error("Error al obtener detalles OV:", error);
    return;
  }

  console.log("🔹 DETALLES OV:", detalles);

  const mapaOPporDetalle = {};
  opOv.forEach(v => {
    mapaOPporDetalle[v.id_detalle_ov] = v;
  });

  const detallesTransformados = detalles.map(det => {
    const vinc = mapaOPporDetalle[det.id_detalle];

    return {
      id_orden: det.id_orden,
      id_detalle: det.id_detalle,
      producto: det.producto?.nombre ?? "—",
      cantidad: det.cantidad,
      fecha_entrega: det.fecha_estimada_entrega,
      estado_preparacion: det.estado_preparacion,

      numero_op: vinc?.orden_produccion?.numero_op ?? "—",
      linea: vinc?.linea_produccion ?? "—"
    };
  });

  const agrupadas = agruparPorOV(detallesTransformados);

  const datosTabla = [];
  for (const ov in agrupadas) {
    agrupadas[ov].forEach(x => datosTabla.push(x));
  }

  console.log("📦 DATOS PARA TABLA:", datosTabla);

  cargarTablaPreparacion(datosTabla);
}


function cargarTablaPreparacion(datosOV) {
  const tabla = document.querySelector("#tablaPreparacionPedido tbody");
  tabla.innerHTML = "";

  let ordenActual = null;

  datosOV.forEach((item, index) => {
    const fila = document.createElement("tr");
    fila.dataset.ov = item.id_orden; 
    // o item.id_ov, depende tu campo
    fila.dataset.estado = item.estado_preparacion.toLowerCase();

    // Si es la primera fila de una OV, agregamos la celda con rowspan
    if (item.id_orden !== ordenActual) {
      const rowspanCount = datosOV.filter(d => d.id_orden === item.id_orden).length;
      const celdaOV = document.createElement("td");
      celdaOV.textContent = item.id_orden;
      celdaOV.rowSpan = rowspanCount;
      celdaOV.style.fontWeight = "bold";
      celdaOV.style.color = "#55a630";
      celdaOV.dataset.ov = item.id_orden;
      fila.appendChild(celdaOV);
      ordenActual = item.id_orden;
    }

    // SELECT dinámico con las reglas de transición
    let opciones = "";

    if (item.estado_preparacion === "pendiente") {
      opciones = `
          <option value="pendiente" selected>Pendiente</option>
          <option value="en_preparacion">En preparación</option>
      `;
    }

    if (item.estado_preparacion === "en_preparacion") {
      opciones = `
          <option value="en_preparacion" selected>En preparación</option>
          <option value="preparado">Preparado</option>
      `;
    }

    if (item.estado_preparacion === "preparado") {
      opciones = `
          <option value="preparado" selected>Preparado</option>
      `;
    }

    fila.innerHTML += `
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td>${item.fecha_entrega}</td>
      <td>${item.numero_op}</td>     
      <td>${item.linea}</td>   
      <td>
        <select 
          class="selectEstado"
          data-id-detalle="${item.id_detalle}"
          ${item.estado_preparacion === "preparado" ? "disabled" : ""}
        >
            ${opciones}
        </select>
      </td>
    `;

    tabla.appendChild(fila);
  });


  document.querySelectorAll(".selectEstado").forEach(sel => {
    sel.addEventListener("change", async (e) => {
      const id_detalle = e.target.dataset.idDetalle;
      const nuevoEstado = e.target.value;

      await actualizarEstadoPreparacion(id_detalle, nuevoEstado);

      cargarPedidosDesdeSupabase(); // refrescar tabla
    });
  });
}
async function actualizarEstadoPreparacion(id_detalle, nuevoEstado) {

  const { error } = await supabaseClient
    .from("detalle_ordenes")
    .update({ estado_preparacion: nuevoEstado })
    .eq("id_detalle", id_detalle);

  if (error) {
    console.error("Error al actualizar estado:", error);
  }
}



function filtrarPreparacion() {
  const filtroTexto = document.getElementById("filtroDetalleOV").value.toLowerCase().trim();
  const filtroEstado = document.getElementById("filtroEstado").value.toLowerCase();

  const filas = document.querySelectorAll("#tablaPreparacionPedido tbody tr");
  const sinResultadosDiv = document.getElementById("sinResultados");

  const ovCoincidentes = new Set();

  filas.forEach(tr => {
    const textoFila = tr.textContent.toLowerCase();
    const estadoFila = tr.dataset.estado?.toLowerCase() || "";

    const coincideTexto = textoFila.includes(filtroTexto);  // ahora incluye OP + Línea
    const coincideEstado = !filtroEstado || estadoFila.includes(filtroEstado);

    // Si coincide con ambos, mostramos todas sus filas (por OV agrupada)
    if (coincideTexto && coincideEstado) {
      ovCoincidentes.add(tr.dataset.ov);
    }
  });

  // Mostrar / ocultar filas según coincidencia
  filas.forEach(tr => {
    tr.style.display = ovCoincidentes.has(tr.dataset.ov) ? "" : "none";
  });

  // Mensaje "sin resultados"
  if (ovCoincidentes.size === 0 && (filtroTexto || filtroEstado)) {
    sinResultadosDiv.style.display = "block";
  } else {
    sinResultadosDiv.style.display = "none";
  }
}



/**function filtrarPreparacion() {
  const filtro = document.getElementById("filtroDetalleOV").value.toLowerCase().trim();
  const filas = document.querySelectorAll("#tablaPreparacionPedido tbody tr");
  const ovCoincidentes = new Set();

  // --- Busqueda específica por OP-2025-XXX ---
  const esBusquedaOP = /^op-2025-\d+$/i.test(filtro);

  filas.forEach(tr => {
    const textoFila = tr.textContent.toLowerCase();
    const ov = tr.dataset.ov?.toLowerCase();

    if (esBusquedaOP) {
      // Buscar solo por OP exacta
      if (ov === filtro) {
        ovCoincidentes.add(ov);
      }
    } else {
      // Búsqueda normal por texto
      if (textoFila.includes(filtro)) {
        ovCoincidentes.add(ov);
      }
    }
  });

  // Mostrar/ocultar filas
  filas.forEach(tr => {
    const ov = tr.dataset.ov?.toLowerCase();

    tr.style.display = ovCoincidentes.has(ov) ? "" : "none";
  });
}
 



/** BUSQUEDA SIN FILTRO  ESTADO*//*
function filtrarPreparacion() {
    const filtro = document.getElementById("filtroDetalleOV").value.toLowerCase().trim();
    const filas = document.querySelectorAll("#tablaPreparacionPedido tbody tr");
    const sinResultadosDiv = document.getElementById("sinResultados");

    const ovCoincidentes = new Set();

    // Buscar coincidencias
    filas.forEach(tr => {
        if (tr.textContent.toLowerCase().includes(filtro)) {
            ovCoincidentes.add(tr.dataset.ov);
        }
    });

    // Mostrar/ocultar filas según resultado
    filas.forEach(tr => {
        tr.style.display = ovCoincidentes.has(tr.dataset.ov) ? "" : "none";
    });

    // Mostrar mensaje si no hay ninguna coincidencia
    if (ovCoincidentes.size === 0 && filtro !== "") {
        sinResultadosDiv.style.display = "block";
    } else {
        sinResultadosDiv.style.display = "none";
    }
}

*/



async function cargarOPFinalizadas() {
  const { data, error } = await supabaseClient
    .from("orden_produccion")
    .select("id_orden_produccion, numero_op, estado")
    .eq("estado", "finalizada");

  if (error) {
    console.error("Error al obtener OP finalizadas:", error);
    return;
  }

  console.log("🔹 OP FINALIZADAS:", data);
  return data;
}

async function cargarOpOvDeOpFinalizadas(opFinalizadas) {
  const idsFinalizadas = opFinalizadas.map(op => op.id_orden_produccion);

  const { data, error } = await supabaseClient
    .from("op_ov")
    .select(`
        id,
        id_op,
        id_detalle_ov,
        linea_produccion,
        orden_produccion: id_op (
          numero_op,
          estado
        )
    `)
    .in("id_op", idsFinalizadas); // FILTRA SOLO LAS OP FINALIZADAS

  if (error) {
    console.error("Error al obtener op_ov:", error);
    return;
  }

  console.log("🔹 OP_OV VINCULADAS A OP FINALIZADAS:", data);
  return data;
}

function agruparPorOV(detalles) {
  const agrupadas = {};

  detalles.forEach(det => {
    const idOV = det.id_orden;

    if (!agrupadas[idOV]) {
      agrupadas[idOV] = [];
    }

    agrupadas[idOV].push(det);
  });

  return agrupadas;
}