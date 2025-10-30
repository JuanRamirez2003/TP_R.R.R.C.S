// ---------------------- Configuración Supabase ----------------------
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ---------------------- Variables globales ----------------------
const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
let lineasGlobal = [];
let fechasMostrar = []; // Hoy, Mañana, Pasado mañana

// ---------------------- Inicialización ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  calcularFechas();
  await cargarLineas();

  document.getElementById("filtro-linea").addEventListener("change", renderAgendaDesdeSupabase);
  document.getElementById("filtro-prioridad").addEventListener("change", renderAgendaDesdeSupabase);
  document.getElementById("btnPlanificar").addEventListener("click", planificarSemana);
  document.getElementById("btnVolver").addEventListener("click", () => { window.location.href = "operario.html"; });
  document.getElementById("cerrarModal").addEventListener("click", () => { document.getElementById("modalDetalle").style.display = "none"; });

  renderAgendaDesdeSupabase(); // render inicial
});

// ---------------------- Calcular Hoy, Mañana, Pasado mañana ----------------------
function calcularFechas() {
  fechasMostrar = [];
  const hoy = new Date();
  for (let i = 0; i < 3; i++) {
    const fecha = new Date();
    fecha.setDate(hoy.getDate() + i);
    fechasMostrar.push(fecha);
  }
}

// ---------------------- Cargar líneas ----------------------
async function cargarLineas() {
  const { data, error } = await supabaseClient.from("linea_productos").select("*");
  if (error) return alert("Error al cargar líneas: " + error.message);
  lineasGlobal = data;
  const filtro = document.getElementById("filtro-linea");
  data.forEach(l => {
    const opt = document.createElement("option");
    opt.value = l.id_linea;
    opt.textContent = l.nombre || `Línea ${l.id_linea}`;
    filtro.appendChild(opt);
  });
}

// ---------------------- Renderizar agenda ----------------------
async function renderAgendaDesdeSupabase() {
  const agenda = document.getElementById("agenda-semanal");
  const filtroLinea = document.getElementById("filtro-linea").value;
  const filtroPrioridad = document.getElementById("filtro-prioridad").value;
  const hoyStr = new Date().toISOString().split("T")[0];

  const { data: planificaciones, error } = await supabaseClient
    .from("planificacion_semanal")
    .select("*")
    .gte("dia", hoyStr);

  if (error) return alert("Error al cargar planificación: " + error.message);
  agenda.innerHTML = "";

  const prioridadOrden = { urgente: 1, alta: 2, normal: 3, baja: 4 };

  fechasMostrar.forEach(fecha => {
    const columna = document.createElement("div");
    columna.className = "agenda-dia";
    const diaNombre = dias[fecha.getDay()];
    const fechaStr = fecha.toLocaleDateString("es-ES");
    columna.innerHTML = `<strong>${diaNombre} ${fechaStr}</strong><br>`;

    planificaciones
      .filter(p =>
        p.dia === fecha.toISOString().split("T")[0] &&
        (filtroLinea === "" || p.id_linea == filtroLinea) &&
        (filtroPrioridad === "" || p.prioridad?.toLowerCase() === filtroPrioridad)
      )
      .sort((a, b) => (prioridadOrden[a.prioridad?.toLowerCase()] || 5) - (prioridadOrden[b.prioridad?.toLowerCase()] || 5))
      .forEach(p => {
        const bloque = document.createElement("div");
        const clasePrioridad = p.prioridad?.toLowerCase() || "normal";
        bloque.className = "bloque-produccion " + clasePrioridad;

        // Mostramos numero_op en lugar de id_op
        bloque.innerHTML = `<strong>Línea ${p.id_linea}</strong><br> ${p.numero_op}<br>${p.hora_inicio} - ${p.hora_fin}`;
        //console.log("ACAAA", p.numero_op);
        bloque.addEventListener("click", () => {
          //console.log(p);
          mostrarDetalleOP(p.id_op, p.id_linea);
          //mostrarDetalleLinea(p.id_linea);
        });
        columna.appendChild(bloque);
      });

    agenda.appendChild(columna);
  });

  agenda.style.display = "flex";
}

// ---------------------- Generar planificación ----------------------
async function planificarSemana() {
  const hoyStr = new Date().toISOString().split("T")[0];

  // Borramos planificaciones desde hoy en adelante
  await supabaseClient.from("planificacion_semanal").delete().gte("dia", hoyStr);

  const { data: ordenes, error: opError } = await supabaseClient.from("orden_produccion").select("*").eq("estado", "Pendiente");
  if (opError) return alert("Error al cargar órdenes: " + opError.message);
  if (!ordenes?.length) return alert("No hay órdenes pendientes");

  const [{ data: lineas, error: lineasError }, { data: lineasProd, error: lpError }] = await Promise.all([
    supabaseClient.from("linea_productos").select("*"),
    supabaseClient.from("linea_produccion").select("*")
  ]);
  if (lineasError || lpError) return alert("Error al cargar líneas o duraciones");

  const carga = {};
  for (const l of lineas) {
    carga[l.id_linea] = {};
    fechasMostrar.forEach(f => {
      const fechaKey = f.toISOString().split("T")[0];
      carga[l.id_linea][fechaKey] = 0;
    });
  }

  const prioridadOrden = { urgente: 1, alta: 2, normal: 3, baja: 4 };
  ordenes.sort((a, b) => (prioridadOrden[a.prioridad?.toLowerCase()] || 5) - (prioridadOrden[b.prioridad?.toLowerCase()] || 5));

  const planificaciones = [];

  for (const op of ordenes) {
    let cantidadLotes = Array.isArray(op.ver_orden) ? op.ver_orden.reduce((t, i) => t + (i.cantidad || 0), 0) : 1;
    const posibles = lineasProd.filter(v => v.id_producto === op.id_producto);
    if (!posibles.length) continue;
    posibles.sort((a, b) => a.duracion - b.duracion);

    let asignado = false;
    for (let i = 0; i < fechasMostrar.length && !asignado; i++) {
      const fechaKey = fechasMostrar[i].toISOString().split("T")[0];
      for (const cand of posibles) {
        const minutosUsados = carga[cand.id_linea][fechaKey];
        const capacidad = lineas.find(l => l.id_linea === cand.id_linea)?.capacidad_diaria_min ?? 480;
        const duracionTotal = cand.duracion * cantidadLotes;

        if (minutosUsados + duracionTotal <= capacidad) {
          const horaInicio = minutosUsados;
          const horaFin = minutosUsados + duracionTotal;

          planificaciones.push({
            id_op: op.id_orden_produccion,
            numero_op: op.numero_op,      // <-- agregado
            id_linea: cand.id_linea,
            dia: fechaKey,
            hora_inicio: minutosToHora(horaInicio),
            hora_fin: minutosToHora(horaFin),
            prioridad: op.prioridad?.toLowerCase() || "normal"
          });

          carga[cand.id_linea][fechaKey] += duracionTotal;
          asignado = true;
          break;
        }
      }
    }
  }

  if (planificaciones.length) {
    const { error: insertError } = await supabaseClient.from("planificacion_semanal").insert(planificaciones);
    if (insertError) return alert("Error al guardar planificación: " + insertError.message);
    alert("Planificación generada correctamente");
    renderAgendaDesdeSupabase();
  } else alert("No se pudo generar planificación");
}

// ---------------------- Minutos a hora ----------------------
function minutosToHora(min) {
  const totalMin = 8 * 60 + min; // inicio jornada 8:00
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

// ---------------------- Mostrar detalle OP ----------------------
/*async function mostrarDetalleOP(id_op){
  const { data: op, error } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("id_orden_produccion", id_op)
    .single();
  if(error) return alert("Error al cargar OP: "+error.message);

  // Modal limpio con numero_op
  let contenido = `<h3>Detalle OP ${op.numero_op }</h3>
                   <p><strong>Prioridad:</strong> ${op.prioridad}</p>
                   <p><strong>Estado:</strong> ${op.estado}</p>
                   <p><strong>Fecha estimada:</strong> ${op.fecha_estimada_entrega||"N/A"}</p>
                   
                   <p><strong>Productos/Lotes:</strong></p>
                  <ul>
                    ${op.ver_orden.map(item => `
                      <div>${item.nombre} - Cantidad de lotes: ${item.cantidad}</div>
                    `).join('')}
                  </ul>
                      
                  `;
  




  document.getElementById("detalleContenido").innerHTML = contenido;
  document.getElementById("modalDetalle").style.display = "flex";
}//<p><strong>Motivo:</strong> ${op.motivo || "N/A"}</p>


//====================SOLO MUESTRA DETALLE DE DE LINEA DE OP=============
async function mostrarDetalleOP(id_op, id_linea) {
  const { data: op, error } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("id_orden_produccion", id_op)
    .single();
  if (error) return alert("Error al cargar OP: " + error.message);

  // Contenido básico del modal (sin tabla todavía)
  let contenido = `
    <h3>Detalle ${op.numero_op}</h3>
    <p><strong>Prioridad:</strong> ${op.prioridad}</p>
    <p><strong>Estado:</strong> ${op.estado}</p>
    <p><strong>Fecha estimada:</strong> ${op.fecha_estimada_entrega || "N/A"}</p>
    <p><strong>Productos/Lotes:</strong></p>
    ${op.ver_orden.map(item => `
      <div>${item.nombre} - Cantidad de lotes: ${item.cantidad}</div>
    `).join('')}
  `;

  // Agregamos botón para ver tabla
  contenido += `
    <br>
    <button id="btnVerLinea" style="
      background:#55a630;
      color:#000;
      font-weight:bold;
      padding:6px 12px;
      border-radius:6px;
      cursor:pointer;
      border:none;
    ">Ver detalle de línea</button>

    <div id="detalleLinea" style="margin-top:15px; display:none;"></div>
  `;

  document.getElementById("detalleContenido").innerHTML = contenido;
  document.getElementById("modalDetalle").style.display = "flex";

  // ⚡ Evento del botón para mostrar la tabla
  const btnVerLinea = document.getElementById("btnVerLinea");
  const contLinea = document.getElementById("detalleLinea");

  btnVerLinea.addEventListener("click", async () => {
    if (contLinea.style.display === "none") {
      // Buscar detalle de la línea
      const { data: lineasProd, error: errorLinea } = await supabaseClient
        .from("linea_produccion")
        .select("duracion, eficiencia, producto:productos(nombre)")
        .eq("id_linea", id_linea);

      if (errorLinea) {
        contLinea.innerHTML = `<p><strong>Error al cargar línea:</strong> ${errorLinea.message}</p>`;
      } else {
        contLinea.innerHTML = `
          <h3>Detalle Línea ${id_linea}</h3>
          <table>
            <thead>
              <tr><th>Producto</th><th>Duración (min)</th><th>Eficiencia</th></tr>
            </thead>
            <tbody>
              ${lineasProd.map(lp => `
                <tr>
                  <td>${lp.producto.nombre}</td>
                  <td>${lp.duracion}</td>
                  <td>${lp.eficiencia || 1}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      contLinea.style.display = "block";
      btnVerLinea.textContent = "Ocultar detalle de línea";
    } else {
      contLinea.style.display = "none";
      btnVerLinea.textContent = "Ver detalle de línea";
    }
  });
}*/

async function mostrarDetalleOP(id_op, id_linea) {
  const { data: op, error } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("id_orden_produccion", id_op)
    .single();
  if (error) return alert("Error al cargar OP: " + error.message);

  // Contenido básico del modal
  let contenido = `
    <h3 style="text-align:center;">Detalle ${op.numero_op}</h3>
    <p><strong>Prioridad:</strong> ${op.prioridad}</p>
    <p><strong>Estado:</strong> ${op.estado}</p>
    <p><strong>Fecha estimada:</strong> ${op.fecha_estimada_entrega || "N/A"}</p>
    <p><strong>Productos/Lotes:</strong></p>
    ${op.ver_orden.map(item => `
      <div>${item.nombre} - Cantidad de lotes: ${item.cantidad}</div>
    `).join('')}
  `;

  contenido += `
  <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
    <button id="btnVerLinea" class="boton-ver">Ver detalle de línea</button>
    <button id="btnVerOV" class="boton-ver">Ver detalle de OV</button>
  </div>

  <h3 style="text-align:center;">Lotes / Materiales reservados:</h3>
<h4 style="text-align:center; font-weight: normal;">Ver detalle de Lote (clic en una fila para más info)</h4>



  
  <div id="detalleMateriales" style="margin-top:10px;">Cargando...</div>

  <div id="detalleLinea" style="margin-top:15px; display:none;"></div>

  <div id="detalleOV" style="margin-top:10px; display:none;"></div>
`;

  document.getElementById("detalleContenido").innerHTML = contenido;
  document.getElementById("modalDetalle").style.display = "flex";

  // ====== Estilos rápidos para botones ======
  document.querySelectorAll(".boton-ver").forEach(b => {
    b.style.cssText = `
      background:#55a630;
      color:#000;
      font-weight:bold;
      padding:6px 12px;
      border-radius:6px;
      cursor:pointer;
      border:none;
      margin-bottom:8px;
    `;
  });

  // ========== BOTÓN DETALLE DE LÍNEA ==========
  const btnVerLinea = document.getElementById("btnVerLinea");
  const contLinea = document.getElementById("detalleLinea");

  btnVerLinea.addEventListener("click", async () => {
    if (contLinea.style.display === "none") {
      const { data: lineasProd, error: errorLinea } = await supabaseClient
        .from("linea_produccion")
        .select("duracion, eficiencia, producto:productos(nombre)")
        .eq("id_linea", id_linea);

      if (errorLinea) {
        contLinea.innerHTML = `<p><strong>Error al cargar línea:</strong> ${errorLinea.message}</p>`;
      } else {
        contLinea.innerHTML = `
          <h3 style="text-align:center;" >Detalle Línea ${id_linea}</h3>
          <table>
            <thead><tr><th>Producto</th><th>Duración (min)</th><th>Eficiencia</th></tr></thead>
            <tbody>
              ${lineasProd.map(lp => `
                <tr><td>${lp.producto.nombre}</td><td>${lp.duracion}</td><td>${lp.eficiencia || 1}</td></tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      contLinea.style.display = "block";
      btnVerLinea.textContent = "Ocultar detalle de línea";
    } else {
      contLinea.style.display = "none";
      btnVerLinea.textContent = "Ver detalle de línea";
    }
  });

  // ========== TABLA DE MATERIALES (Siempre visible) ==========
  const contMateriales = document.getElementById("detalleMateriales");

  const { data: detalleLotes, error: errorLotes } = await supabaseClient
    .from('detalle_lote_op')
    .select('*')
    .eq('id_orden_produccion', id_op);

  if (errorLotes) {
    contMateriales.innerHTML = `<p>Error al cargar materiales: ${errorLotes.message}</p>`;
  } else if (detalleLotes.length > 0) {
    let lotesHtml = '';
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

      lotesHtml += `
        <tr onclick="verDetalleLote('${lote.id_lote}')" style="cursor:pointer;">
          <td>${mat ? mat.nombre : 'Desconocido'}</td>
          <td>${lote.id_lote}</td>
          <td>${d.cantidad_lote}</td>
          <td>${lote.fecha_caducidad ? new Date(lote.fecha_caducidad).toLocaleDateString() : '-'}</td>
        </tr>`;
    }

    contMateriales.innerHTML = `
      <table border="1" style="width:100%; margin-top:10px;">
        <thead><tr><th>Material</th><th>Lote</th><th>Cant. reservada</th><th>Fecha caducidad</th></tr></thead>
        <tbody>${lotesHtml}</tbody>
      </table>`;
  } else {
    contMateriales.innerHTML = '<p>No hay lotes reservados para esta OP.</p>';
  }

  // ========== BOTÓN DETALLE DE OV ==========
  const btnVerOV = document.getElementById("btnVerOV");
  const contOV = document.getElementById("detalleOV");

  btnVerOV.addEventListener("click", async () => {
    if (contOV.style.display === "none") {
      const { data: detalleOVs, error: errorOVs } = await supabaseClient
        .from('op_ov')
        .select('id_detalle_ov')
        .eq('id_op', id_op);

      if (errorOVs) {
        contOV.innerHTML = `<p>Error al cargar OV: ${errorOVs.message}</p>`;
      } else if (detalleOVs.length > 0) {
        let ovsHtml = '';
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

          ovsHtml += `
            <tr>
              <td>${prod ? prod.nombre : 'Desconocido'}</td>
              <td>${detalle.id_orden}</td>
              <td>${detalle.id_detalle}</td>
              <td>${detalle.cantidad}</td>
              <td>${detalle.estado_detalle_ov}</td>
            </tr>`;
        }

        contOV.innerHTML = `
          <h3 style="text-align:center;" >OV involucradas</h3>
          <table border="1" style="width:100%; margin-top:10px;">
            <thead><tr><th>Producto</th><th>ID OV</th><th>ID Det.</th><th>Cantidad</th><th>Estado</th></tr></thead>
            <tbody>${ovsHtml}</tbody>
          </table>`;
      } else {
        contOV.innerHTML = '<p>No hay OV involucradas en esta OP.</p>';
      }

      contOV.style.display = "block";
      btnVerOV.textContent = "Ocultar detalle de OV";
    } else {
      contOV.style.display = "none";
      btnVerOV.textContent = "Ver detalle de OV";
    }
  });

  document.addEventListener("click", (e) => {
    const fila = e.target.closest("tr[data-id-lote]");
    if (fila) {
      const idLote = fila.getAttribute("data-id-lote");
      verDetalleLote(idLote);
    }
  });
}



//==============VER DETALLE DE LOTE RESERVADOS ==================
async function verDetalleLote(idLote) {
  //console.log("🧩 Ver detalle del lote:", idLote);
  try {
    // Traemos el  específico
    const { data: lote, error: errorLote } = await supabaseClient
      .from('lote_mp')
      .select('*')
      .eq('id_lote', idLote)
      .single();
    //console.log("📦 Lote obtenido:", lote, "❌ Error:", errorLote);
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
    alert("No se pudo mostrar el detalle del lote.");
  }
}

/*
// ---------------------- Mostrar detalle línea ----------------------
async function mostrarDetalleLinea(id_linea){
  const { data: lineasProd, error } = await supabaseClient
    .from("linea_produccion")
    .select("*")
    .eq("id_linea", id_linea);
  if(error) return alert("Error al cargar línea: "+error.message);

  // Tabla de productos de la línea
  let contenido = `<h3>Detalle Línea ${id_linea}</h3>
                   <table>
                     <thead>
                       <tr><th>Producto</th><th>Duración (min)</th><th>Eficiencia</th></tr>
                     </thead>
                     <tbody>`;
  lineasProd.forEach(lp=>{
    contenido += `<tr>
                    <td>${lp.id_producto}</td>
                    <td>${lp.duracion}</td>
                    <td>${lp.eficiencia || 1}</td>
                  </tr>`;
  });
  contenido += `</tbody></table>`;

  // Append al modal (ya que mostramos ambos detalles juntos)
  document.getElementById("detalleContenido").innerHTML += contenido;
  document.getElementById("modalDetalle").style.display = "flex";
}
*/