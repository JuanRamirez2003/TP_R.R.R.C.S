// Crear cliente Supabase
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// Botón para generar planificación
document.getElementById("btnPlanificar").addEventListener("click", planificarSemana);

// Convierte minutos desde las 08:00 a HH:mm
function minutosToHora(min) {
  const totalMin = 8 * 60 + min; // horario de inicio 08:00
  const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const m = Math.floor(totalMin % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}

async function planificarSemana() {
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split("T")[0];

  // 1️⃣ Borrar planificaciones futuras desde hoy
  await supabaseClient.from("planificacion_semanal").delete().gte("dia", hoyStr);

  // 2️⃣ Leer OP pendientes
  const { data: ordenes, error: opError } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("estado", "Pendiente");

  if (opError) return alert("Error al cargar órdenes: " + opError.message);
  if (!ordenes?.length) return alert("No hay órdenes pendientes");

  // 3️⃣ Leer líneas y duraciones
  const [{ data: lineas, error: lineasError }, { data: lineasProd, error: lpError }] =
    await Promise.all([
      supabaseClient.from("linea_productos").select("*"),
      supabaseClient.from("linea_produccion").select("*"),
    ]);

  if (lineasError || lpError) return alert("Error al cargar líneas o duraciones");

  // 4️⃣ Inicializar carga diaria por línea
  const carga = {};
  for (const l of lineas) {
    carga[l.id_linea] = {};
    for (let i = 0; i < 7; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);
      carga[l.id_linea][fecha.toISOString().split("T")[0]] = 0;
    }
  }

  // 5️⃣ Ordenar OP por prioridad
  const prioridadOrden = { urgente: 1, alta: 2, normal: 3, baja: 4 };
  ordenes.sort((a, b) => (prioridadOrden[a.prioridad] || 5) - (prioridadOrden[b.prioridad] || 5));

  const planificaciones = [];

  // 6️⃣ Asignar OP a líneas según duración por lote y cantidad de lotes
  for (const op of ordenes) {
    // Total de lotes de la OP
    let cantidadLotes = 1;
    if (Array.isArray(op.ver_orden)) {
      cantidadLotes = op.ver_orden.reduce((total, item) => total + (item.cantidad || 0), 0);
    }

    const posibles = lineasProd.filter(v => v.id_producto === op.id_producto);
    if (!posibles.length) {
      console.warn(`OP ${op.id_orden_produccion} no tiene línea disponible`);
      continue;
    }

    posibles.sort((a, b) => a.duracion - b.duracion);

    let asignado = false;
    for (let i = 0; i < 7 && !asignado; i++) {
      const fecha = new Date();
      fecha.setDate(hoy.getDate() + i);
      const fechaKey = fecha.toISOString().split("T")[0];

      for (const cand of posibles) {
        const minutosUsados = carga[cand.id_linea][fechaKey];
        const capacidad = lineas.find(l => l.id_linea === cand.id_linea)?.capacidad_diaria_min ?? 480;
        const duracionTotal = cand.duracion * cantidadLotes;

        if (minutosUsados + duracionTotal <= capacidad) {
          const horaInicio = minutosUsados;
          const horaFin = minutosUsados + duracionTotal;

          planificaciones.push({
            id_op: op.id_orden_produccion,
            id_linea: cand.id_linea,
            dia: fechaKey,
            hora_inicio: minutosToHora(horaInicio),
            hora_fin: minutosToHora(horaFin),
            prioridad: op.prioridad,
            eficiencia_estimada: Math.round((cand.eficiencia || 1) * 100),
          });

          carga[cand.id_linea][fechaKey] += duracionTotal;
          asignado = true;
          break;
        }
      }
    }

    if (!asignado) console.warn(`OP ${op.id_orden_produccion} no se pudo asignar en 7 días`);
  }

  // 7️⃣ Guardar planificación
  if (planificaciones.length) {
    const { error: insertError } = await supabaseClient
      .from("planificacion_semanal")
      .insert(planificaciones);

    if (insertError) return alert("Error al guardar planificación: " + insertError.message);

    mostrarPlanificacion(planificaciones);
    alert("Planificación generada correctamente");
  } else {
    alert("No se pudo generar planificación");
  }
}


function mostrarPlanificacion(planificaciones) {
  const tbody = document.querySelector("#tablaPlanificacion tbody");
  tbody.innerHTML = "";

  planificaciones.forEach(p => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><button class="btn-op" data-op='${JSON.stringify(p)}'>${p.id_op}</button></td>
      <td><button class="btn-linea" data-linea='${JSON.stringify(p)}'>${p.id_linea}</button></td>
      <td>${p.dia}</td>
      <td>${p.hora_inicio}</td>
      <td>${p.hora_fin}</td>
      <td>${p.prioridad}</td>
      <td>${p.eficiencia_estimada}</td>
    `;

    tbody.appendChild(tr);
  });

  // Asignar eventos a botones
  document.querySelectorAll(".btn-op").forEach(btn => {
    btn.addEventListener("click", async e => {
      const op = JSON.parse(e.target.dataset.op);
      await mostrarDetalleOP(op.id_op);
    });
  });

  document.querySelectorAll(".btn-linea").forEach(btn => {
    btn.addEventListener("click", async e => {
      const linea = JSON.parse(e.target.dataset.linea);
      await mostrarDetalleLinea(linea.id_linea);
    });
  });
}

async function mostrarDetalleOP(id_op) {
  const { data: op, error } = await supabaseClient
    .from("orden_produccion")
    .select("*")
    .eq("id_orden_produccion", id_op)
    .single();

  if (error) return alert("Error al cargar OP: " + error.message);

  const contenido = `
    <h3>Detalle OP ${op.id_orden_produccion}</h3>
    <p>Prioridad: ${op.prioridad}</p>
    <p>Estado: ${op.estado}</p>
    <p>Fecha estimada: ${op.fecha_estimada_entrega}</p>
    <p>Productos/Lotes:</p>
    <pre>${JSON.stringify(op.ver_orden, null, 2)}</pre>
  `;

  document.getElementById("contenidoDetalle").innerHTML = contenido;
  document.getElementById("modalDetalle").style.display = "block";
}
async function mostrarDetalleLinea(id_linea) {
  const { data: lineasProd, error } = await supabaseClient
    .from("linea_produccion")
    .select("*")
    .eq("id_linea", id_linea);

  if (error) return alert("Error al cargar línea: " + error.message);

  let contenido = `<h3>Detalle Línea ${id_linea}</h3>`;
  contenido += "<table border='1'><tr><th>Producto</th><th>Duración (min)</th><th>Eficiencia</th></tr>";

  lineasProd.forEach(lp => {
    contenido += `<tr>
      <td>${lp.id_producto}</td>
      <td>${lp.duracion}</td>
      <td>${lp.eficiencia || 1}</td>
    </tr>`;
  });

  contenido += "</table>";

  document.getElementById("contenidoDetalle").innerHTML = contenido;
  document.getElementById("modalDetalle").style.display = "block";
}

document.getElementById("cerrarModal").addEventListener("click", () => {
  document.getElementById("modalDetalle").style.display = "none";
});