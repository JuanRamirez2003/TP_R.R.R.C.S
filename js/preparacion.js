
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

async function cargarPedidosDesdeSupabase() {
    const { data, error } = await supabaseClient
        .from('detalle_ordenes')
        .select(`
      id_detalle,
      id_orden,
      cantidad,
      fecha_estimada_entrega,
      estado_preparacion,
      producto: id_producto (nombre),
      op_ov (
        orden_produccion: id_op (
          estado
        )
      )
    `);

    if (error) {
        console.error("Error al obtener datos:", error);
        return;
    }

    // Agrupar por OV y quedarnos solo con las finalizadas
    const agrupadas = {};

    data.forEach(detalle => {
        const estadoOPs = detalle.op_ov.map(op => op.orden_produccion?.estado);
        const todasFinalizadas = estadoOPs.every(e => e === 'finalizada');

        if (todasFinalizadas) {
            if (!agrupadas[detalle.id_orden]) agrupadas[detalle.id_orden] = [];
            agrupadas[detalle.id_orden].push({
                id_detalle: detalle.id_detalle,
                producto: detalle.producto?.nombre || 'Sin nombre',
                cantidad: detalle.cantidad,
                fecha_entrega: detalle.fecha_estimada_entrega,
                estado_preparacion: detalle.estado_preparacion
            });
        }
    });

    // Pasar a formato plano
    const datosTabla = [];
    for (const ov in agrupadas) {
        agrupadas[ov].forEach(item => {
            datosTabla.push({
                id_orden: ov,
                ...item
            });
        });
    }

    cargarTablaPreparacion(datosTabla);
}
function cargarTablaPreparacion(datosOV) {
    const tabla = document.querySelector("#tablaPreparacionPedido tbody");
    tabla.innerHTML = "";

    let ordenActual = null;

    datosOV.forEach((item, index) => {
        const fila = document.createElement("tr");
        fila.dataset.ov = item.id_orden; // 🔥 NECESARIO PARA FILTRO
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

    // ACTIVAR EVENTOS PARA LOS SELECT
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

    const coincideTexto = textoFila.includes(filtroTexto);
    const coincideEstado = !filtroEstado || estadoFila.includes(filtroEstado);

    // Solo marca la OV si coincide con ambos filtros
    if (coincideTexto && coincideEstado) {
      ovCoincidentes.add(tr.dataset.ov);
    }
  });

  // Mostrar u ocultar filas según coincidencias
  filas.forEach(tr => {
    tr.style.display = ovCoincidentes.has(tr.dataset.ov) ? "" : "none";
  });

  // Mostrar mensaje si no hay resultados
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
