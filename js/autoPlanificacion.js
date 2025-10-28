// ---------------------- Configuración Supabase ----------------------
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ---------------------- Variables globales ----------------------
const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
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
function calcularFechas(){
  fechasMostrar = [];
  const hoy = new Date();
  for(let i=0; i<3; i++){
    const fecha = new Date();
    fecha.setDate(hoy.getDate()+i);
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
      .sort((a,b)=> (prioridadOrden[a.prioridad?.toLowerCase()]||5) - (prioridadOrden[b.prioridad?.toLowerCase()]||5))
      .forEach(p => {
        const bloque = document.createElement("div");
        const clasePrioridad = p.prioridad?.toLowerCase() || "normal";
        bloque.className = "bloque-produccion " + clasePrioridad;

        // Mostramos numero_op en lugar de id_op
        bloque.innerHTML = `<strong>Línea ${p.id_linea}</strong><br>OP ${p.numero_op || p.id_op}<br>${p.hora_inicio} - ${p.hora_fin}`;

        bloque.addEventListener("click", () => {
          mostrarDetalleOP(p.id_op);
          mostrarDetalleLinea(p.id_linea);
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
  ordenes.sort((a,b)=> (prioridadOrden[a.prioridad?.toLowerCase()]||5) - (prioridadOrden[b.prioridad?.toLowerCase()]||5));

  const planificaciones = [];

  for (const op of ordenes) {
    let cantidadLotes = Array.isArray(op.ver_orden) ? op.ver_orden.reduce((t,i)=>t+(i.cantidad||0),0) : 1;
    const posibles = lineasProd.filter(v=>v.id_producto===op.id_producto);
    if (!posibles.length) continue;
    posibles.sort((a,b)=>a.duracion-b.duracion);

    let asignado = false;
    for (let i=0; i<fechasMostrar.length && !asignado; i++) {
      const fechaKey = fechasMostrar[i].toISOString().split("T")[0];
      for (const cand of posibles) {
        const minutosUsados = carga[cand.id_linea][fechaKey];
        const capacidad = lineas.find(l=>l.id_linea===cand.id_linea)?.capacidad_diaria_min ?? 480;
        const duracionTotal = cand.duracion*cantidadLotes;

        if (minutosUsados + duracionTotal <= capacidad) {
          const horaInicio = minutosUsados;
          const horaFin = minutosUsados+duracionTotal;

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

  if(planificaciones.length){
    const { error: insertError } = await supabaseClient.from("planificacion_semanal").insert(planificaciones);
    if(insertError) return alert("Error al guardar planificación: "+insertError.message);
    alert("Planificación generada correctamente");
    renderAgendaDesdeSupabase();
  } else alert("No se pudo generar planificación");
}

// ---------------------- Minutos a hora ----------------------
function minutosToHora(min) {
  const totalMin = 8*60 + min; // inicio jornada 8:00
  const h = String(Math.floor(totalMin/60)).padStart(2,"0");
  const m = String(totalMin%60).padStart(2,"0");
  return `${h}:${m}:00`;
}

// ---------------------- Mostrar detalle OP ----------------------
async function mostrarDetalleOP(id_op){
  const { data: op, error } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("id_orden_produccion", id_op)
    .single();
  if(error) return alert("Error al cargar OP: "+error.message);

  // Modal limpio con numero_op
  let contenido = `<h3>Detalle OP ${op.numero_op || op.id_orden_produccion}</h3>
                   <p><strong>Prioridad:</strong> ${op.prioridad}</p>
                   <p><strong>Estado:</strong> ${op.estado}</p>
                   <p><strong>Fecha estimada:</strong> ${op.fecha_estimada_entrega||"N/A"}</p>
                   <p><strong>Motivo:</strong> ${op.motivo || "N/A"}</p>
                   <p><strong>Productos/Lotes:</strong></p>
                   <pre>${JSON.stringify(op.ver_orden,null,2)}</pre>`;

  document.getElementById("detalleContenido").innerHTML = contenido;
  document.getElementById("modalDetalle").style.display = "flex";
}

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