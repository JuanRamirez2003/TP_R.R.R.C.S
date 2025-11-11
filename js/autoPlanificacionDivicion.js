// ---------------------- Configuración Supabase ----------------------
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ---------------------- Variables globales ----------------------
const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
let lineasGlobal = [];
let fechasMostrar = []; // Hoy, Mañana, Pasado mañana
let lineaSeleccionada = null;
let duracionTotalLinea = 0;

// --- VARIABLES GLOBALES ---
window.tiempoPlanificadoLinea = 0;
window.tiempoRequeridoOPUrgente = 0;
window.tiempoTotal = 0;
// ---------------------- Inicialización ----------------------
document.addEventListener("DOMContentLoaded", async () => {
  calcularFechas();
  await cargarLineas();

  document.getElementById("filtro-linea").addEventListener("change", renderAgendaDesdeSupabase);
  document.getElementById("filtro-prioridad").addEventListener("change", renderAgendaDesdeSupabase);
  //document.getElementById("btnPlanificar").addEventListener("click", planificarSemana);
  document.getElementById("btnPlanificar").addEventListener("click", () => {
    planificarSemana(false); // modo normal (determinista)
  });
  document.getElementById("btnCambiarPlanificacion").addEventListener("click", () => {
    planificarSemana(true); // modo aleatorio dentro de prioridades
  });
  document.getElementById("btnVolver").addEventListener("click", () => { window.location.href = "operario.html"; });
  document.getElementById("cerrarModal").addEventListener("click", () => { document.getElementById("modalDetalle").style.display = "none"; });

  renderAgendaDesdeSupabase(); // render inicial
});

// ---------------------- Calcular Hoy, Mañana, Pasado mañana ----------------------
function calcularFechas() {
  fechasMostrar = [];
  const hoy = new Date();
  for (let i = 0; i < 7; i++) {
    const fecha = new Date();
    fecha.setDate(hoy.getDate() + i);
    fechasMostrar.push(fecha);
  }
}

// ---------------------- Cargar líneas ----------------------
async function cargarLineas() {
  const { data, error } = await supabaseClient.from("linea_productos").select("*");
  if (error) return mostrarAviso("Error al cargar líneas: " + error.message);//alert
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

  if (error) return mostrarAviso("Error al cargar planificación: " + error.message);//alert
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
      //.sort((a, b) => (prioridadOrden[a.prioridad?.toLowerCase()] || 5) - (prioridadOrden[b.prioridad?.toLowerCase()] || 5))
      /*
      //FRONT ORDENA POR PRIORIDAD Y HORA
    .sort((a, b) => {
      const pa = prioridadOrden[a.prioridad?.toLowerCase()] || 5;
      const pb = prioridadOrden[b.prioridad?.toLowerCase()] || 5;
      if (pa !== pb) return pa - pb;
      return horaToMinutos(a.hora_inicio) - horaToMinutos(b.hora_inicio);
    })*/
      //SOLO ORDENA POR HORA
      .sort((a, b) => horaToMinutos(a.hora_inicio) - horaToMinutos(b.hora_inicio))


      .forEach(p => {
        const bloque = document.createElement("div");
        const clasePrioridad = p.prioridad?.toLowerCase() || "normal";
        bloque.className = "bloque-produccion " + clasePrioridad;

        // 🧩 Asegurar que cantidad_lotes sea un objeto
        let cantidadLotes = { lotes_incluidos: [], lotes_total: 0 };

        if (p.cantidad_lotes) {
          try {
            cantidadLotes = typeof p.cantidad_lotes === "string"
              ? JSON.parse(p.cantidad_lotes)
              : p.cantidad_lotes;
          } catch (e) {
            console.warn("Error al parsear cantidad_lotes:", e);
          }
        }

        const cantIncluidos = Array.isArray(cantidadLotes.lotes_incluidos)
          ? cantidadLotes.lotes_incluidos.length
          : 0;

        //bloque.innerHTML = `<strong>Línea ${p.id_linea}</strong><br> ${p.numero_op}<br>${p.hora_inicio} - ${p.hora_fin}`;
        ///FIJADA
        const pinActivo = p.fijada === true || p.fijada === "true"; // por si viene como string
        //console.log(p);
        bloque.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="text-align:center; width:100%;">
            <strong>Línea ${p.id_linea}</strong><br>
            ${p.numero_op}<br>
            ${p.hora_inicio} - ${p.hora_fin} | 
            Lotes: ${cantIncluidos} de ${cantidadLotes.lotes_total}
          </div>
          <button class="pin-btn ${pinActivo ? 'fijada' : ''}" 
                  title="${pinActivo ? 'Desfijar' : 'Fijar'}">
            ${pinActivo ? "🔒" : "📌"}
          </button>
        </div>
      `;
        //FIJADA


        //console.log("ACAAA", p.numero_op);
        bloque.addEventListener("click", () => {
          //console.log(p);
          mostrarDetalleOP(p.id_op, p.id_linea);
          //mostrarDetalleLinea(p.id_linea);
        });
        columna.appendChild(bloque);
      });

    agenda.appendChild(columna);
    //  FIJADA
    document.querySelectorAll('.pin-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const bloque = e.target.closest('.bloque-produccion');
        const idLinea = bloque.querySelector('strong').textContent.replace('Línea ', '');

        const plan = planificaciones.find(p =>
          p.id_linea == idLinea &&
          bloque.textContent.includes(p.numero_op)
        );

        if (!plan) return;

        const fijadaActual = e.target.classList.contains('fijada');
        const nuevoEstado = !fijadaActual;

        await toggleFijada(plan.id_op, nuevoEstado, plan.dia);

        e.target.classList.toggle('fijada', nuevoEstado);
        e.target.textContent = nuevoEstado ? '🔒' : '📌';
        e.target.title = nuevoEstado ? 'Desfijar' : 'Fijar';
      });
    });
    //FIJADA
  });

  agenda.style.display = "flex";
}

// ---------------------- Generar planificación ----------------------
async function planificarSemana(modoAleatorio = false) {
  window.tiempoPlanificadoLinea = 0;
  window.tiempoRequeridoOPUrgente = 0;
  const lotesAsignadosPorOP = {};

  const hoyStr = new Date().toISOString().split("T")[0];

  // 1️⃣ Limpiar planificaciones no fijadas desde hoy
  await supabaseClient
    .from("planificacion_semanal")
    .delete()
    .gte("dia", hoyStr)
    .eq("fijada", false);

  // 2️⃣ Cargar planificaciones fijadas
  const { data: fijadas } = await supabaseClient
    .from("planificacion_semanal")
    .select("*")
    .gte("dia", hoyStr)
    .eq("fijada", true);

  // 3️⃣ Cargar órdenes pendientes
  const { data: ordenes } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("estado", "Pendiente");

  if (!ordenes?.length) return mostrarAviso("No hay órdenes pendientes");

  // 4️⃣ Cargar líneas
  const [{ data: lineas }, { data: lineasProd }] = await Promise.all([
    supabaseClient.from("linea_productos").select("*"),
    supabaseClient.from("linea_produccion").select("*")
  ]);

  // 5️⃣ Inicializar carga
  const carga = {};
  for (const l of lineas) {
    carga[l.id_linea] = {};
    fechasMostrar.forEach(f => {
      const fechaKey = f.toISOString().split("T")[0];
      carga[l.id_linea][fechaKey] = 0;
    });
  }

  // 6️⃣ Ajustar carga con planificaciones fijadas
  const fijadasPorLineaDia = {};
  fijadas.forEach(f => {
    const key = `${f.id_linea}_${f.dia}`;
    if (!fijadasPorLineaDia[key]) fijadasPorLineaDia[key] = [];
    fijadasPorLineaDia[key].push(f);
  });

  for (const key in fijadasPorLineaDia) {
    const [id_linea, dia] = key.split("_");
    const grupo = fijadasPorLineaDia[key];
    grupo.sort((a, b) => a.numero_op.localeCompare(b.numero_op));

    let minutosInicio = 0;
    for (const f of grupo) {
      const duracion = horaToMinutos(f.hora_fin) - horaToMinutos(f.hora_inicio);
      f.hora_inicio = minutosToHora(minutosInicio);
      f.hora_fin = minutosToHora(minutosInicio + duracion);
      if (!carga[id_linea]) carga[id_linea] = {};
      if (!carga[id_linea][dia]) carga[id_linea][dia] = 0;
      carga[id_linea][dia] += duracion;
      minutosInicio += duracion;
    }
  }

  await Promise.all(
    fijadas.map(f =>
      supabaseClient
        .from("planificacion_semanal")
        .update({
          hora_inicio: f.hora_inicio,
          hora_fin: f.hora_fin
        })
        .eq("id_op", f.id_op)
        .eq("dia", f.dia)
        .eq("id_linea", f.id_linea)
    )
  );

  // 7️⃣ Ordenar OP por prioridad
  const prioridadOrden = { urgente: 1, alta: 2, normal: 3, baja: 4 };
  const ordenesFiltradas = ordenes
    .filter(op => !fijadas.some(f => f.id_op === op.id_orden_produccion))
    .sort(
      (a, b) =>
        (prioridadOrden[a.prioridad?.toLowerCase()] || 5) -
        (prioridadOrden[b.prioridad?.toLowerCase()] || 5)
    );

  let ordenesParaPlanificar = ordenesFiltradas;
  if (modoAleatorio) {
    const grupos = { urgente: [], alta: [], normal: [], baja: [] };
    ordenesFiltradas.forEach(op => {
      const key = op.prioridad?.toLowerCase() || "normal";
      grupos[key].push(op);
    });
    for (const key in grupos) grupos[key].sort(() => Math.random() - 0.5);
    ordenesParaPlanificar = [
      ...grupos.urgente,
      ...grupos.alta,
      ...grupos.normal,
      ...grupos.baja
    ];
  }

  // 8️⃣ Generar planificaciones
  const planificaciones = [];

  for (const op of ordenesParaPlanificar) {
    const cantidadLotes =
      Array.isArray(op.ver_orden) && op.ver_orden.length
        ? op.ver_orden.reduce((t, i) => t + (i.cantidad || 0), 0)
        : op.cant_lote || 1;

    const posibles = lineasProd.filter(v => v.id_producto === op.id_producto);
    if (!posibles.length) continue;

    posibles.sort((a, b) => a.duracion - b.duracion);

    let lotesRestantes = cantidadLotes;
    let opDividida = false;
    if (!lotesAsignadosPorOP[op.id_orden_produccion]) {
      lotesAsignadosPorOP[op.id_orden_produccion] = 1;
    }

    for (const fecha of fechasMostrar) {
      if (lotesRestantes <= 0) break;
      const fechaKey = fecha.toISOString().split("T")[0];

      for (const cand of posibles) {
        if (lotesRestantes <= 0) break;

        const capacidad =
          lineas.find(l => l.id_linea === cand.id_linea)?.capacidad_diaria_min ?? 480;
        const minutosUsados = carga[cand.id_linea][fechaKey];
        const espacioLibre = capacidad - minutosUsados;

        if (espacioLibre <= 0) continue;

        const duracionPorLote = cand.duracion;
        const lotesPosibles = Math.min(
          Math.floor(espacioLibre / duracionPorLote),
          lotesRestantes
        );

        if (lotesPosibles <= 0) continue;

        const duracionTotal = lotesPosibles * duracionPorLote;

        const inicio = lotesAsignadosPorOP[op.id_orden_produccion];
        const fin = inicio + lotesPosibles - 1;
        const lotesAsignados = Array.from({ length: lotesPosibles }, (_, i) => inicio + i);

        lotesAsignadosPorOP[op.id_orden_produccion] = fin + 1;

        const cantidadLotesJSON = {
          lotes_incluidos: lotesAsignados,
          lotes_total: cantidadLotes
        };

        if (lotesAsignados.length === 0) continue;

        planificaciones.push({
          id_op: op.id_orden_produccion,
          numero_op: op.numero_op + (cantidadLotes > lotesPosibles ? " 🧩" : ""),
          id_linea: cand.id_linea,
          dia: fechaKey,
          hora_inicio: minutosToHora(minutosUsados),
          hora_fin: minutosToHora(minutosUsados + duracionTotal),
          prioridad: op.prioridad?.toLowerCase() || "normal",
          cantidad_lotes: cantidadLotesJSON
        });

        carga[cand.id_linea][fechaKey] += duracionTotal;
        lotesRestantes -= lotesPosibles;
        if (lotesRestantes > 0) opDividida = true;
      }
    }

    if (lotesRestantes > 0) {
      mostrarAviso(`⚠️ La OP ${op.numero_op} no pudo planificarse completamente`);
    }
  }

  // 9️⃣ Insertar planificaciones nuevas
  if (planificaciones.length) {
    const planificacionesConJSON = planificaciones.map(p => ({
      ...p,
      cantidad_lotes: JSON.stringify(p.cantidad_lotes)
    }));

    const { error: insertError } = await supabaseClient
      .from("planificacion_semanal")
      .insert(planificacionesConJSON);

    if (insertError)
      return mostrarAviso("Error al guardar planificación: " + insertError.message);

    mostrarAviso(
      modoAleatorio
        ? "🔁 Se generó una planificación alternativa"
        : "✅ Planificación generada correctamente"
    );

    renderAgendaDesdeSupabase();
  } else {
    mostrarAviso("⚠️ No se pudo generar planificación");
  }
}


// ---------------------- Minutos a hora ----------------------
function minutosToHora(min) {
  const totalMin = 8 * 60 + min; // inicio jornada 8:00
  const h = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const m = String(totalMin % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}
function horaToMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m - 480; // 480 min desde 8:00
}
// ---------------------- Mostrar detalle OP ----------------------
async function mostrarDetalleOP(id_op, id_linea) {
  const { data: op, error } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("id_orden_produccion", id_op)
    .single();
  if (error) return mostrarAviso("Error al cargar OP: " + error.message);//alert

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
    mostrarAviso("No se pudo mostrar el detalle del lote.");//alert
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

function mostrarAviso(mensaje) {
  const modal = document.getElementById('modalAviso');
  const mensajeP = document.getElementById('mensajeAvisoTexto');
  const btnCerrar = document.getElementById('btnCerrarAviso');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de aviso");
    return alert(mensaje);
  }

  mensajeP.innerHTML = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
}
// ---------------------- Fijar / Desfijar OP ----------------------
async function toggleFijada(id_op, nuevoEstado, dia) {
  const { error } = await supabaseClient
    .from("planificacion_semanal")
    .update({ fijada: nuevoEstado })
    .eq("id_op", id_op)
    .eq('dia', dia);;

  if (error) {
    console.error("Error al actualizar fijada:", error);
    mostrarAviso("No se pudo cambiar el estado de fijada");
  }
}
// ---------------------- Fijar / Desfijar OP ----------------------












/*/ ---------------------- Drag & Drop para edición  OTRA FORMA DE HACERLO ----------------------
let modoEdicionActivo = false;

document.getElementById("btnEditarPlanificacion").addEventListener("click", () => {
  modoEdicionActivo = !modoEdicionActivo;
  mostrarAviso(modoEdicionActivo ? "Modo edición activado" : "Modo edición desactivado");
  actualizarModoEdicion();
});

function actualizarModoEdicion() {
  const bloques = document.querySelectorAll(".bloque-produccion");
  const columnas = document.querySelectorAll(".agenda-dia");

  bloques.forEach(b => {
    b.draggable = modoEdicionActivo; // solo arrastrables en modo edición
    if (modoEdicionActivo) {
      b.classList.add("editable");
      b.addEventListener("dragstart", onDragStart);
      b.addEventListener("dragend", onDragEnd);
    } else {
      b.classList.remove("editable");
      b.removeEventListener("dragstart", onDragStart);
      b.removeEventListener("dragend", onDragEnd);
    }
  });

  columnas.forEach(col => {
    if (modoEdicionActivo) {
      col.classList.add("dropzone");
      col.addEventListener("dragover", onDragOver);
      col.addEventListener("drop", onDrop);
    } else {
      col.classList.remove("dropzone");
      col.removeEventListener("dragover", onDragOver);
      col.removeEventListener("drop", onDrop);
    }
  });
}

let bloqueArrastrado = null;

function onDragStart(e) {
  bloqueArrastrado = e.target;
  e.target.classList.add("arrastrando");
}

function onDragEnd(e) {
  e.target.classList.remove("arrastrando");
  bloqueArrastrado = null;
}

function onDragOver(e) {
  e.preventDefault(); // permite soltar
  const col = e.currentTarget;
  col.classList.add("sobre-dropzone");
}

function onDrop(e) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove("sobre-dropzone");

  if (bloqueArrastrado && modoEdicionActivo) {
    col.appendChild(bloqueArrastrado);

    const diaDestino = col.querySelector("strong")?.textContent?.split(" ")[0] || "desconocido";
    mostrarAviso(`OP movida a ${diaDestino}`);
  }
}*/

// ---------------------- MODAL ----------------------
const btnEditar = document.getElementById("btnEditarPlanificacion");
const modal = document.getElementById("modalEditarPlanificacion");
const closeModal = modal.querySelector(".close");

btnEditar.addEventListener("click", async () => {
  modal.style.display = "block";
  await cargarOPsPendientes();
});

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ---------------------- CARGAR OPs PENDIENTES ----------------------
async function cargarOPsPendientes() {
  const lista = document.getElementById("listaPendientes");
  lista.innerHTML = "<p>Cargando OPs...</p>";

  const { data: ops, error: opsError } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("estado", "Pendiente");

  if (opsError) {
    console.error("Error al cargar OPs:", opsError);
    lista.innerHTML = "<p>Error al cargar las OPs.</p>";
    return;
  }

  if (!ops || ops.length === 0) {
    lista.innerHTML = "<p>No hay OPs pendientes.</p>";
    return;
  }

  const { data: ovCounts, error: ovError } = await supabaseClient
    .from("op_ov")
    .select("id_op", { count: "exact" })
    .in("id_op", ops.map(op => op.id_orden_produccion));

  if (ovError) {
    console.error("Error al traer OV:", ovError);
  }


  const ovMap = {};
  if (ovCounts) {
    ovCounts.forEach(ov => {
      ovMap[ov.id_op] = (ovMap[ov.id_op] || 0) + 1;
    });
  }

  const { data: lineasProd } = await supabaseClient
    .from("linea_produccion")
    .select("*");

  lista.innerHTML = "";

  ops.forEach(op => {
    const item = document.createElement("div");
    item.classList.add("op-item");

    const prioridad = (op.prioridad || "normal").toLowerCase();
    if (["urgente", "alta", "normal", "baja"].includes(prioridad)) {
      item.classList.add(prioridad);
    }


    item.draggable = true;

    item.dataset.origen_real = "pendientes";
    item.dataset.id = op.id_orden_produccion;
    item.dataset.idProducto = op.id_producto;
    item.dataset.numero_op = op.numero_op;
    item.dataset.cantidadLotes = obtenerCantidadLotes(op);


    const lineaRec = obtenerLineaRecomendada(op.id_producto, lineasProd);
    const cantidadLotes = obtenerCantidadLotes(op);

    const cantidadOV = ovMap[op.id_orden_produccion] || 0;
    const duracion = formatoDuracion(lineaRec.duracion * cantidadLotes);
    //const duracionMejorLinea = calcularDuracion(op.id_orden_produccion, lineaRec);

    item.innerHTML = `
      <strong>${op.numero_op}</strong> - ${op.ver_orden?.[0]?.nombre || "Sin producto"}<br>
      <small>
        📦 Lotes: <b>${cantidadLotes}</b> |
        ⏳  Duración por línea selec: <b class="duracion-texto">${duracion}</b> |
        🧾 OV: <b>${cantidadOV}</b><br>
        ⚙️ Línea sugerida: <b>${lineaRec.id_linea}</b>
    `;
    lista.appendChild(item);
  });

  activarDragAndDrop();
}
function formatoDuracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h ${m}m`;
}

// ---------------------- BUSCADOR ----------------------
const buscador = document.getElementById("buscadorPendientes");
buscador.addEventListener("input", () => {
  const filtro = buscador.value.toLowerCase();
  document.querySelectorAll("#listaPendientes .op-item").forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(filtro)
      ? "block"
      : "none";
  });
});
const DURACION_JORNADA = 8 * 60;
// ---------------------- DRAG & DROP ----------------------

function activarDragAndDrop() {
  let draggedItem = null;
  let lineaOrigen = null;
  let duracionOP = 0;
  let duracionplanificada = 0;

  let duracionEnMinutos = 0;

  document.querySelectorAll(".op-item").forEach(item => {


    item.addEventListener("dragstart", e => {
      try {
        draggedItem = item;
        lineaOrigen = item.closest(".lista-op")?.dataset.linea || null;

        const idTexto = draggedItem.querySelector("strong")?.textContent || "";
        const idOrden = idTexto.trim(); // Ej: "OP-2025-123"

        const duracionRaw = draggedItem.querySelector("small")?.innerText || "";
        const match2 = duracionRaw.match(/Duración:\s*(\d+)h\s*(\d+)m/);

        duracionEnMinutos = match2 ? (parseInt(match2[1]) * 60 + parseInt(match2[2])) : 0;

        const textoDuracion = item.querySelector(".duracion-texto")?.textContent || "0h 0m";
        const match = textoDuracion.match(/(\d+)h\s*(\d+)m/);
        if (match) {
          const horas = parseInt(match[1]) || 0;
          const minutos = parseInt(match[2]) || 0;
          duracionOP = horas * 60 + minutos;
        } else {
          duracionOP = 0;
        }

        //console.log("OOOOOOO", idOrden, "+++", parseInt(match2[1] * 60) + parseInt(match2[2]));
        setTimeout(() => item.style.display = "none", 0);
      } catch (error) {
        console.error("Error en dragstart:", error);
      }
    });

    item.addEventListener("dragend", e => {
      try {
        setTimeout(() => {
          item.style.display = "block";
          draggedItem = null;
          lineaOrigen = null;
          duracionOP = 0;
        }, 0);
      } catch (error) {
        console.error("Error en dragend:", error);
      }
    });
  });


  document.querySelectorAll(".lista-op").forEach(lista => {
    lista.addEventListener("dragover", e => {
      try {
        e.preventDefault();
        lista.classList.add("drag-over");
      } catch (error) {
        console.error("Error en dragover:", error);
      }
    });

    lista.addEventListener("drop", e => {
      try {
        e.preventDefault();
        lista.classList.remove("drag-over");
        if (!draggedItem) return;

        const lineaDestino = lista.dataset.linea;
        const origenReal = draggedItem.dataset.origen_real || null;
        const duracion = duracionEnMinutos;

        if (lineaDestino === "linea-seleccionada") {
          const idLineaSeleccionada = document.getElementById("filtroLineas").value;
          if (!idLineaSeleccionada) {
            mostrarAviso("⚠️ Seleccioná una línea antes de agregar OPs", "error");
            return;
          }
        }


        if (lineaOrigen && lineaOrigen !== lineaDestino) {
          // Caso 1: OP originalmente pendiente → se agrega a línea
          if (origenReal === "pendientes" && lineaDestino === "linea-seleccionada") {
            window.tiempoRequeridoOPUrgente += duracion;
          }

          // Caso 2: OP originalmente pendiente → se agregó a línea → se devuelve a pendientes
          if (origenReal === "pendientes" && lineaOrigen === "linea-seleccionada" && lineaDestino === "pendientes") {
            window.tiempoRequeridoOPUrgente -= duracion;
          }

          // Caso 3: OP originalmente planificada → se quita de la línea
          if (origenReal === "linea-seleccionada" && lineaOrigen === "linea-seleccionada" && lineaDestino === "pendientes") {
            window.tiempoPlanificadoLinea -= duracion;
          }

          // Caso 4: OP originalmente planificada → se quitó → se vuelve a agregar a la línea
          if (origenReal === "linea-seleccionada" && lineaOrigen === "pendientes" && lineaDestino === "linea-seleccionada") {
            window.tiempoPlanificadoLinea += duracion;
          }

          window.tiempoRequeridoOPUrgente = Math.max(window.tiempoRequeridoOPUrgente, 0);
          window.tiempoPlanificadoLinea = Math.max(window.tiempoPlanificadoLinea, 0);

          validarTiempoTotal();
        }

        lista.appendChild(draggedItem);


        if (lineaDestino) {
          actualizarTiemposLinea(lineaDestino);
        }


        //console.log(`🧩 Movimiento: ${lineaOrigen} → ${lineaDestino} | Origen real: ${origenReal} | Duración: ${duracion}`);
        //console.log(`⏱ Requerido: ${window.tiempoRequeridoOPUrgente} | Planificado: ${window.tiempoPlanificadoLinea}`);

      } catch (error) {
        console.error("Error al procesar el drop:", error);
      }
    });

  });
}




function obtenerLineaRecomendada(idProducto, lineasProd) {
  const posibles = lineasProd.filter(l => l.id_producto === idProducto);
  if (!posibles.length) return { id_linea: "-", duracion: 0 };

  const mejor = posibles.reduce((a, b) => a.duracion < b.duracion ? a : b);

  return {
    id_linea: mejor.id_linea,
    duracion: mejor.duracion
  };
}
function obtenerCantidadLotes(op) {
  if (!Array.isArray(op.ver_orden)) return 0;
  return op.ver_orden.reduce((total, item) => total + (item.cantidad || 0), 0);
}

//////////////////////////////

/*/ Cuando se suelta una OP en el andanivel de línea
lineaDroppable.addEventListener("drop", async (e) => {
  e.preventDefault();
  const idOP = e.dataTransfer.getData("text/plain");
  const op = data.find(op => op.id === parseInt(idOP));

  // Calcular tiempo estimado en base a la línea seleccionada
  const linea = "Línea 2"; // o la que corresponda dinámicamente
  const tiempo = calcularTiempoEstimado(op, linea);

  // Mostrar en la tarjeta
  const item = document.querySelector(`.op-item[data-id="${op.id}"]`);
  if (item) {
    const tiempoDiv = document.createElement("div");
    tiempoDiv.classList.add("op-tiempo");
    tiempoDiv.textContent = `Tiempo estimado: ${tiempo}`;
    item.appendChild(tiempoDiv);
  }

  e.target.appendChild(item);
});

function calcularTiempoEstimado(op, linea) {
  const velocidad = obtenerVelocidadLinea(linea); // ejemplo: unidades/hora
  const cantidad = op.ver_orden?.[0]?.cantidad || 0;
  const horas = cantidad / velocidad;
  return `${horas.toFixed(1)} h`;
}
*/

//////// ANDANIVEL DE LÍNEAS ////////////
async function cargarLineas2() {
  const { data, error } = await supabaseClient.from("linea_productos").select("*");
  //console.log("Líneas cargadas para filtro:", data);
  if (error) {
    console.error("Error al cargar líneas:", error);
    return;
  }

  const select = document.getElementById("filtroLineas");
  select.innerHTML = `<option value="">-- Elegir línea --</option>`;
  data.forEach(linea => {
    const option = document.createElement("option");
    option.value = linea.id_linea;
    option.textContent = linea.id_linea;
    select.appendChild(option);
  });
}

document.getElementById("filtroLineas").addEventListener("change", async (e) => {
  lineaSeleccionada = e.target.value;
  const idLinea = e.target.value;


  //console.log("Línea seleccionada:", idLinea);
  if (!idLinea) {

    document.getElementById("listaLinea").innerHTML = "";
    window.tiempoPlanificadoLinea = 0;
    window.tiempoRequeridoOPUrgente = 0;
    window.tiempoTotal = 0;

    //document.getElementById("tiempo-liberado").textContent = "⏱ Tiempo liberado: 0h 0m";
    //document.getElementById("tiempo-requerido").textContent = "⏳ Tiempo requerido: 0h 0m";
    mostrarAviso22(" ", "ok");

    return;
  }


  const hoy = new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseClient
    .from("planificacion_semanal")
    .select("*, orden_produccion(numero_op, ver_orden, prioridad, id_orden_produccion)")
    .eq("id_linea", idLinea)
    .eq("dia", hoy);

  if (error) {
    console.error("Error al traer planificacion:", error);
    return;
  }

  const lista = document.getElementById("listaLinea");
  lista.innerHTML = "";

  if (!data || data.length === 0) {
    lista.innerHTML = "<p>No hay OPs planificadas para hoy en esta línea.</p>";
    return;
  }
  console.log("OPs planificadas:", data);
  calcularTiempoPlanificado(data);
  validarTiempoTotal();
  //console.log("||||||||||||", tiempoPlanificadoLinea);

  // Promise.all para consultas paralelas
  const opItems = await Promise.all(data.map(async (item) => {
    const op = item.orden_produccion;
    const opItem = document.createElement("div");
    opItem.classList.add("op-item");

    const prioridad = (op.prioridad || "normal").toLowerCase();
    opItem.classList.add(prioridad);

    opItem.draggable = true;

    opItem.dataset.origen_real = "linea-seleccionada";
    opItem.dataset.id = op.id_orden_produccion;
    opItem.dataset.numero_op = op.numero_op;
    opItem.dataset.id_orden_produccion = op.id_orden_produccion;

    //console.log(" ✅ ✅ ✅ ",  opItem.dataset.id_orden_produccion);

    const cantidadLotes = Array.isArray(op.ver_orden)
      ? op.ver_orden.reduce((sum, v) => sum + (v.cantidad || 0), 0)
      : 1;

    const tiempoEstimado = calcularDuracion(item.hora_inicio, item.hora_fin);

    const cantidadOV = await cantOVRelacionadas(op.id_orden_produccion);
    //console.log("===============",opItem);
    opItem.innerHTML = `
    <strong>${op.numero_op}</strong> - ${op.ver_orden?.[0]?.nombre || "Sin nombre"}<br>
      <small>
      
        📦Lotes: <b>${cantidadLotes}</b> |
        ⏳  Duración: <b>${tiempoEstimado}</b> |
        🧾 OV: <b>${cantidadOV}</b>
      </small>
    `;

    return opItem;
  }));

  opItems.forEach(opItem => lista.appendChild(opItem));

  activarDragAndDrop();
});



document.getElementById("btnEditarPlanificacion").addEventListener("click", async () => {
  document.getElementById("modalEditarPlanificacion").style.display = "block";
  await cargarLineas2();
  await cargarOPsPendientes();
});

function calcularDuracion(hora_inicio, hora_fin) {
  const [h1, m1] = hora_inicio.split(":").map(Number);
  const [h2, m2] = hora_fin.split(":").map(Number);

  const minutosInicio = h1 * 60 + m1;
  const minutosFin = h2 * 60 + m2;

  const duracionMin = minutosFin - minutosInicio;
  const horas = Math.floor(duracionMin / 60);
  const minutos = duracionMin % 60;

  return `${horas}h ${minutos}m`;
}
async function cantOVRelacionadas(id_op) {
  try {
    const { data, error, count } = await supabaseClient
      .from("op_ov")
      .select("*", { count: "exact" })
      .eq("id_op", id_op);

    if (error) {
      console.error("Error al consultar OV relacionadas:", error.message);
      return 0;
    }
    console.log("Cantidad de OV relacionadas para OP", count);
    return count || 0;
  } catch (err) {
    console.error("Excepción al consultar OV relacionadas:", err);
    return 0;
  }
}

document.getElementById("filtroLineas").addEventListener("change", async (e) => {
  lineaSeleccionada = e.target.value;
  console.log("🔁 Línea seleccionada:", lineaSeleccionada);
  await recalcularDuracionesPendientes();
});


async function recalcularDuracionesPendientes() {
  if (!lineaSeleccionada) return;
  console.log("🔄 Recalculando duraciones para línea:", lineaSeleccionada);

  const { data: lineasProd, error } = await supabaseClient
    .from("linea_produccion")
    .select("*");

  if (error) {
    console.error("❌ Error al cargar linea_produccion:", error);
    return;
  }

  document.querySelectorAll("#listaPendientes .op-item").forEach(item => {
    const idProducto = Number(item.dataset.idProducto);
    const cantidadLotes = Number(item.dataset.cantidadLotes) || 1;

    /*console.log(" OP pendiente →", {
      idProducto,
      lineaSeleccionada,
      cantidadLotes
    });*/


    const lineaElegida = lineasProd.find(
      l =>
        Number(l.id_producto) === idProducto &&
        Number(l.id_linea) === Number(lineaSeleccionada)
    );

    let duracionMin = 0;
    let lineaUsada = "";

    if (lineaElegida) {

      duracionMin = lineaElegida.duracion * cantidadLotes;
      lineaUsada = lineaElegida.id_linea;
      //console.log(` Produce en línea ${lineaUsada}: ${duracionMin} min`);
    } else {

      const recomendada = obtenerLineaRecomendada(idProducto, lineasProd);
      duracionMin = recomendada.duracion * cantidadLotes;
      lineaUsada = recomendada.id_linea;

      /*console.warn(
        `⚠️ No produce en línea ${lineaSeleccionada}. Usando línea ${lineaUsada}: ${duracionMin} min`
      );*/
    }


    const duracionTexto = formatoDuracion(duracionMin);
    const durElem = item.querySelector(".duracion-texto");
    if (durElem) durElem.textContent = duracionTexto;
  });
}

//-----------&&&&&&&&&&&&&&&&&&&&&&--------------------
function actualizarTiemposLinea(idLinea) {
  try {

    const contenedorLinea =
      document.querySelector(`#andanivel-linea-${idLinea}`) ||
      document.querySelector("#listaLinea");
    if (!contenedorLinea) return;

    const ops = contenedorLinea.querySelectorAll(".op-item");

    let tiempoOcupado = 0;
    ops.forEach(op => {
      const textoDuracion = op.querySelector(".duracion-texto")?.textContent || "0h 0m";
      const match = textoDuracion.match(/(\d+)h\s*(\d+)m/);
      if (match) {
        const horas = parseInt(match[1]) || 0;
        const minutos = parseInt(match[2]) || 0;
        tiempoOcupado += horas * 60 + minutos;
      }
    });

    window.tiempoRequeridoOPUrgente = tiempoOcupado;
    console.log("$$$$$", window.tiempoRequeridoOPUrgente);

    //const spanRequerido = document.getElementById("tiempo-requerido");
    if (spanRequerido) {
      spanRequerido.textContent = `⚙️ Tiempo requerido: ${formatoDuracion(tiempoOcupado)}`;
    }

    //console.log(`⏱ Tiempo requerido (${idLinea}): ${formatoDuracion(tiempoOcupado)} (${tiempoOcupado} min)`);
    validarTiempoTotal();
  } catch (error) {
    console.error("Error al actualizar tiempos de la línea:", error);
  }
}

function formatoDuracion(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h ${m}m`;
}

function calcularDuracionEnMinutos(hora_inicio, hora_fin) {
  const [h1, m1] = hora_inicio.split(":").map(Number);
  const [h2, m2] = hora_fin.split(":").map(Number);

  const minutosInicio = h1 * 60 + m1;
  const minutosFin = h2 * 60 + m2;

  return minutosFin - minutosInicio; // devuelve número
}

function formatoDuracion(minutos) {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${horas}h ${mins}m`;
}

function calcularTiempoPlanificado(data) {
  let total = 0;
  data.forEach(op => {
    const dur = calcularDuracionEnMinutos(op.hora_inicio, op.hora_fin);
    total += dur;
  });


  window.tiempoPlanificadoLinea = total;


  //console.log(`⏱ Tiempo planificado línea: ${formatoDuracion(total)}`);

  /*const spanRequerido = document.getElementById("tiempo-requerido");
  if (spanRequerido) {
    spanRequerido.textContent = `⏱ Tiempo planificado línea: ${formatoDuracion(total)}`;
  }*/
}
// --- FUNCIÓN PARA CALCULAR TIEMPO TOTAL Y VALIDAR ---
function validarTiempoTotal() {
  const DURACION_JORNADA = 480; // 8 horas
  window.tiempoTotal = window.tiempoPlanificadoLinea + window.tiempoRequeridoOPUrgente;
  //console.log("???????", window.tiempoRequeridoOPUrgente);
  console.log(`Tiempo total: ${tiempoTotal} min (planificado ${window.tiempoPlanificadoLinea} + requerido ${window.tiempoRequeridoOPUrgente})`);

  if (tiempoTotal <= DURACION_JORNADA) {
    const horas = Math.floor(tiempoTotal / 60);
    const minutos = tiempoTotal % 60;
    mostrarAviso22(`✅ Horas de producción de la línea:  ${horas}h ${minutos}m`, "ok");
    return true;
  } else {
    const exceso = tiempoTotal - DURACION_JORNADA;
    const horasExceso = Math.floor(exceso / 60);
    const minutosExceso = exceso % 60;
    mostrarAviso22(
      `⚠️ Excede las horas de producción ${horasExceso}h ${minutosExceso}m. Tiene que sacar OPs de la línea.`,
      "error"
    );
    return false;
  }
}

// --- FUNCIÓN PARA QUITAR UNA OP PLANIFICADA Y RESTAR SU TIEMPO ---
function quitarOPPlanificada(duracionMinutos) {

  window.tiempoPlanificadoLinea -= duracionMinutos;
  if (window.tiempoPlanificadoLinea < 0) window.tiempoPlanificadoLinea = 0;


  //const spanRequerido = document.getElementById("tiempo-requerido");
  if (spanRequerido) {
    spanRequerido.textContent = `⏱ Tiempo planificado línea: ${formatoDuracion(window.tiempoPlanificadoLinea)}`;
  }


  validarTiempoTotal();
}

// --- FUNCIÓN PARA MOSTRAR AVISOS ---
function mostrarAviso22(msg, tipo) {
  let aviso = document.getElementById("aviso-tiempo");
  if (!aviso) {
    aviso = document.createElement("div");
    aviso.id = "aviso-tiempo";
    aviso.style.marginTop = "8px";
    document.querySelector(".info-tiempo")?.appendChild(aviso);
  }
  aviso.textContent = msg;
  aviso.style.color = tipo === "error" ? "red" : "green";
}

function obtenerIDsOPsPlanificadas() {
  try {
    const contenedor = document.getElementById("listaLinea");
    const ops = contenedor.querySelectorAll(".op-item");

    const resultado = Array.from(ops)
      .map(op => {
        const id = op.dataset.id_orden_produccion || op.dataset.id || null;
        const numero = op.dataset.numero_op || "Sin número";
        return id ? { id, numero } : null;
      })
      .filter(Boolean);

    return resultado;
  } catch (error) {
    console.error("Error al obtener OPs planificadas:", error);
    return [];
  }
}


document.getElementById("btnGuardarLinea").addEventListener("click", async () => {
  const tiempoTotal = window.tiempoPlanificadoLinea + window.tiempoRequeridoOPUrgente;
  if (tiempoTotal > 480) {
    const exceso = tiempoTotal - 480;
    const horasExceso = Math.floor(exceso / 60);
    const minutosExceso = exceso % 60;
    mostrarAviso22(`⚠️ No se puede guardar. Excede la jornada por ${horasExceso}h ${minutosExceso}m.`, "error");
    return;
  }

  const opsPlanificadas = obtenerIDsOPsPlanificadas();
  console.log("⚠️ OPs planificadas:", opsPlanificadas);

  const idSet = new Set();
  const duplicados = [];

  opsPlanificadas.forEach(op => {
    if (idSet.has(op.id)) {
      duplicados.push(op.numero);
    } else {
      idSet.add(op.id);
    }
  });

  if (duplicados.length > 0) {
    const mensaje = `❌ No se puede guardar.<br><b>OP duplicada:</b> ${[...new Set(duplicados)].join(", ")}`;
    mostrarAviso(mensaje, "error");
    return;
  }

  const ids = opsPlanificadas.map(op => op.id);
  console.log("⚠️❌", ids);



  const idLinea = document.getElementById("filtroLineas").value;
  const hoy = new Date().toISOString().split("T")[0];





  const exito = await fijarOPsEnLineaSeleccionada(ids, idLinea, hoy);

  if (!exito) {
    mostrarAviso("❌ Error al guardar la planificación", "error");
    return;
  }

  mostrarAviso(`
    <span style="font-size:1.2em;">
      ✅ Planificación guardada correctamente<br>
      <strong>GENERE OTRA VEZ LA PLANIFICACIÓN</strong>
    </span>
  `);

  // planificarSemana();
  document.getElementById("modalEditarPlanificacion").style.display = "none";
  resetearModalPlanificacion();
});

document.getElementById("btnGuardarLinea").disabled = (window.tiempoPlanificadoLinea + window.tiempoRequeridoOPUrgente) > 480;

async function fijarOPsEnLineaSeleccionada(ids, idLineaSeleccionada, hoy) {
  let huboError = false;

  for (const id_op of ids) {
    const { data, error } = await supabaseClient
      .from("planificacion_semanal")
      .select("id_linea, dia")
      .eq("id_op", id_op);

    if (error) {
      console.error(`Error al consultar OP ${id_op}:`, error);
      huboError = true;
      continue;
    }

    const hoyISO = new Date(hoy).toISOString().split("T")[0];
    const hoyDate = new Date(hoyISO);

    const planificacionHoy = data.find(p => p.dia === hoyISO);
    const planificacionFutura = data.find(p => new Date(p.dia) > hoyDate);

    try {
      if (planificacionHoy) {
        await supabaseClient
          .from("planificacion_semanal")
          .update({ id_linea: idLineaSeleccionada, fijada: true })
          .eq("id_op", id_op)
          .eq("dia", hoyISO);
      } else if (planificacionFutura) {
        await supabaseClient
          .from("planificacion_semanal")
          .update({ dia: hoyISO, id_linea: idLineaSeleccionada, fijada: true })
          .eq("id_op", id_op)
          .eq("dia", planificacionFutura.dia);
      } else {

        await supabaseClient
          .from("planificacion_semanal")
          .insert({
            id_op: id_op,
            id_linea: idLineaSeleccionada,
            dia: hoyISO,
            fijada: true,
          });
      }
    } catch (e) {
      console.error(`Error al fijar OP ${id_op}:`, e);
      huboError = true;
    }
  }

  return !huboError;
}
document.querySelector("#modalEditarPlanificacion .close").addEventListener("click", () => {
  resetearModalPlanificacion();
  document.getElementById("modalEditarPlanificacion").style.display = "none";
});



function resetearModalPlanificacion() {
  document.getElementById("filtroLineas").value = "";
  document.getElementById("buscadorPendientes").value = "";
  document.getElementById("listaLinea").innerHTML = "";
  document.getElementById("listaPendientes").innerHTML = "";
  window.tiempoPlanificadoLinea = 0;
  window.tiempoRequeridoOPUrgente = 0;
  // document.getElementById("tiempo-liberado").textContent = "⏱ Tiempo liberado: 0h 0m";
  //document.getElementById("tiempo-requerido").textContent = "⚙️ Tiempo requerido: 0h 0m";

  mostrarAviso22(" ", "ok");

}

//|||||||||||||||||||INFO MODAL EDITAR PLANIFICACIÓN|||||||||||||||||||||
const modalAyuda = document.getElementById("modalAyuda");
const btnAyuda = document.getElementById("btnAyuda");
const closeAyuda = document.querySelector(".close-ayuda");

btnAyuda.addEventListener("click", () => {
  modalAyuda.style.display = "block";
});

closeAyuda.addEventListener("click", () => {
  modalAyuda.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modalAyuda) modalAyuda.style.display = "none";
});