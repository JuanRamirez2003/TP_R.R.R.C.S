/* lote_mp.js actualizado
   - Compatible con el HTML/CSS que me pasaste (select id="nuevoIdMp")
   - Requiere SweetAlert2 y supabase-js cargados en el HTML
*/

const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const bodyLotes = document.getElementById("bodyLotes");
const bodyHistorial = document.getElementById("bodyHistorial");
let loteSeleccionado = null;
let todosLosLotes = []; // almacena todos los lotes cargados


/* ---------------------
   CARGA PRINCIPAL DE LOTES
   --------------------- */
async function cargarLotes() {
  try {
    const { data: lotes, error } = await supabaseClient
      .from("lote_mp")
      .select(`
        *,
        materiales (id_mp, nombre)
      `)
      .order("id_lote", { ascending: true });

    if (error) throw error;

    todosLosLotes = lotes; // guardamos todos los lotes
    mostrarLotesEnTabla(lotes);    
  } catch (err) {
    console.error("Error al cargar lotes:", err);
    Swal.fire("Error", "❌ Error al cargar los lotes. Ver consola.", "error");
  }
}

/* ---------------------
   CALCULAR DISPONIBILIDAD (según fecha y cantidad)
   --------------------- */
function calcularEstadoLote(lote) {
  const hoy = new Date();
  const cad = lote.fecha_caducidad ? new Date(lote.fecha_caducidad) : null;
  const cantidadDisponible = Number(lote.cantidad_disponible ?? lote.cantidad ?? 0);

  // prioridad: sin stock => No disponible
  if (cantidadDisponible <= 0) {
    return { text: "No disponible", class: "nodisponible" };
  }

  if (!cad) {
    // sin fecha de caducidad declarada -> Disponible por defecto
    return { text: "Disponible", class: "disponible" };
  }

  const diff = (cad - hoy) / (1000 * 60 * 60 * 24);

  if (diff < 0) return { text: "Vencido", class: "vencido" };
  if (diff <= 14) return { text: "Próximo a vencer", class: "proximo" };
  return { text: "Disponible", class: "disponible" };
}

/* ---------------------
   MODAL NUEVO LOTE
   --------------------- */
function abrirModalNuevoLote() {
  // Limpiar campos del modal (están en el HTML)
  document.getElementById("nuevoIdMp").innerHTML = "<option value=''>Cargando...</option>";
  document.getElementById("nuevoLote").value = "";
  document.getElementById("nuevoCantidad").value = "";
  document.getElementById("nuevoFechaIngreso").value = "";
  document.getElementById("nuevoFechaCaducidad").value = "";

  // Cargar materiales en el select
  cargarMateriasParaSelect().then(() => {
    document.getElementById("modalNuevoLote").style.display = "block";
  });
}

function cerrarModalNuevoLote() {
  document.getElementById("modalNuevoLote").style.display = "none";
}

/* Carga la lista de materiales (tabla 'materiales') */
async function cargarMateriasParaSelect() {
  try {
    // Ajustá el nombre de la tabla/columnas si en tu BD se llaman distinto
    const { data, error } = await supabaseClient
      .from("materiales")
      .select("id_mp, nombre")
      .order("nombre", { ascending: true });

    const sel = document.getElementById("nuevoIdMp");
    if (error || !data) {
      sel.innerHTML = `<option value="">No hay materias</option>`;
      console.error("Error cargando materias:", error);
      return;
    }

    sel.innerHTML = `<option value="">-- Seleccionar materia prima --</option>` +
      data.map(m => `<option value="${m.id_mp}">${m.nombre}</option>`).join("");
  } catch (err) {
    console.error("Error en cargarMateriasParaSelect:", err);
    document.getElementById("nuevoIdMp").innerHTML = `<option value="">Error</option>`;
  }
}

// 🔹 Función para generar automáticamente el código del lote
function generarCodigoLote(id_mp) {
  const fecha = new Date();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  const secuencia = Math.floor(Math.random() * 900 + 100); // aleatorio entre 100-999
  return `LOT-MP${id_mp}-${año}${mes}${dia}-${secuencia}`;
}

// Helper: obtiene valor intentando varios ids (devuelve null si no existe)
function getValueFromIds(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el.value;
  }
  return null;
}

/* guardar lote nuevo */
async function guardarNuevoLote() {
  const id_mp = document.getElementById("nuevoIdMp").value;
  const cantidad = parseFloat(document.getElementById("nuevoCantidad").value);
  const fecha_ingreso = document.getElementById("nuevoFechaIngreso").value;
  const fecha_caducidad = document.getElementById("nuevoFechaCaducidad").value;

  if (!id_mp || !cantidad || !fecha_ingreso || !fecha_caducidad) {
    Swal.fire("Campos incompletos", "Completa todos los campos antes de guardar.", "warning");
    return;
  }

  try {
    // 1️⃣ Obtener el último id_lote para generar el próximo número
    const { data: maxLoteData, error: maxError } = await supabaseClient
      .from("lote_mp")
      .select("id_lote")
      .order("id_lote", { ascending: false })
      .limit(1);

    if (maxError) throw maxError;
    const siguienteId = maxLoteData?.length ? maxLoteData[0].id_lote + 1 : 1;

    // 2️⃣ Generar código de lote automático: LOT-MP{id_mp}-{siguienteId}
    const codigoLote = `LOT-MP${id_mp}-${siguienteId}`;

    // 3️⃣ Armar objeto de inserción
    const nuevoLote = {
      id_mp: parseInt(id_mp),
      lote: codigoLote,
      cantidad,
      cantidad_disponible: cantidad,
      cantidad_consumida: 0,
      cantidad_reservada: 0,
      fecha_ingreso,
      fecha_caducidad,
      disponibilidad: "Disponible",
      estado: "Conforme"
    };

    // 4️⃣ Insertar en Supabase
    const { error: insertError } = await supabaseClient
      .from("lote_mp")
      .insert([nuevoLote]);

    if (insertError) throw insertError;

    Swal.fire("Hecho", `✅ Lote ${codigoLote} agregado correctamente.`, "success");
    cerrarModalNuevoLote();
    cargarLotes();
  } catch (err) {
    console.error("❌ Error insertando nuevo lote:", err);
    Swal.fire("Error", "No se pudo guardar el nuevo lote.", "error");
  }
}


/* ---------------------
   MODAL BAJA (dar de baja cantidad)
   --------------------- */
async function abrirModalBaja(id_lote) {
  try {
    const { data, error } = await supabaseClient
      .from("lote_mp")
      .select("id_lote, id_mp, lote, cantidad, cantidad_disponible, disponibilidad, materiales(nombre)")
      .eq("id_lote", id_lote)
      .single();

    if (error || !data) {
      console.error("Error al obtener lote para baja:", error);
      return Swal.fire("Error", "No se pudo cargar el lote.", "error");
    }

    loteSeleccionado = data;
    document.getElementById("bajaIdLote").value = data.id_lote;
    document.getElementById("bajaNombre").value = data.materiales?.nombre || "—";
    document.getElementById("bajaCantidadActual").value = data.cantidad_disponible ?? 0;
    document.getElementById("bajaCantidad").value = "";
    document.getElementById("bajaMotivo").value = "";

    document.getElementById("modalBaja").style.display = "block";
  } catch (err) {
    console.error("Error abrirModalBaja:", err);
    Swal.fire("Error", "No se pudo abrir modal de baja.", "error");
  }
}

function cerrarModalBaja() {
  document.getElementById("modalBaja").style.display = "none";
}

/* Confirmar baja: actualiza lote_mp y registra en baja_mp */
async function confirmarBaja() {
  try {
    const idLote = Number(document.getElementById("bajaIdLote").value);
    const cantidadBaja = parseFloat(document.getElementById("bajaCantidad").value);
    const motivo = document.getElementById("bajaMotivo").value.trim();

    if (isNaN(cantidadBaja) || cantidadBaja <= 0) {
      return Swal.fire("Error", "Ingresá una cantidad válida (>0).", "error");
    }
    if (!motivo) {
      return Swal.fire("Error", "Especificá un motivo para la baja.", "warning");
    }

    // refetch lote (por si cambió)
    const { data: lote, error: loteErr } = await supabaseClient
      .from("lote_mp")
      .select("*")
      .eq("id_lote", idLote)
      .single();

    if (loteErr || !lote) {
      console.error("Error al obtener lote antes de baja:", loteErr);
      return Swal.fire("Error", "No se pudo obtener la información del lote.", "error");
    }

    // confirmación final
    const confirmacion = await Swal.fire({
      title: "Confirmar baja",
      text: `Se dará de baja ${cantidadBaja} unidades del lote ${lote.lote}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar"
    });
    if (!confirmacion.isConfirmed) return;

    const nuevaCantidad = Number((lote.cantidad_disponible ?? 0) - cantidadBaja);
    const cantidadDisponibleFinal = Math.max(0, nuevaCantidad);

    // determinar nueva disponibilidad según cantidad y fecha
    const disponibilidadInfo = calcularEstadoLote({
      cantidad_disponible: cantidadDisponibleFinal,
      fecha_caducidad: lote.fecha_caducidad
    });
    const nuevaDisponibilidad = disponibilidadInfo.text;

    // actualizar lote_mp
    const { error: errorUpdate } = await supabaseClient
      .from("lote_mp")
      .update({
        cantidad_disponible: cantidadDisponibleFinal,
        cantidad_consumida: (Number(lote.cantidad_consumida ?? 0) + cantidadBaja),
        disponibilidad: nuevaDisponibilidad
      })
      .eq("id_lote", idLote);

    if (errorUpdate) {
      console.error("Error actualizando lote en baja:", errorUpdate);
      return Swal.fire("Error", "No se pudo actualizar el lote.", "error");
    }

    // insertar en baja_mp (historial)
    const usuarioActual = JSON.parse(localStorage.getItem("usuarioActual") || "null"); // si no existe, queda null
    const idUsuario = usuarioActual?.id || null;

    const { error: errorInsert } = await supabaseClient
      .from("baja_mp")
      .insert([{
        id_lote: idLote,
        cantidad_baja: cantidadBaja,
        motivo,
        fecha_baja: new Date().toISOString(),
        id_usuario: idUsuario,
        estado_anterior: lote.disponibilidad ?? null,
        estado_nuevo: nuevaDisponibilidad
      }]);

    if (errorInsert) {
      console.error("Error insert baja_mp:", errorInsert);
      return Swal.fire("Error", "No se pudo registrar la baja en historial.", "error");
    }

    Swal.fire("Hecho", "La baja fue registrada correctamente.", "success");
    cerrarModalBaja();
    await cargarLotes();
  } catch (err) {
    console.error("Error confirmarBaja:", err);
    Swal.fire("Error", "Ocurrió un error al procesar la baja.", "error");
  }
}

/* ---------------------
   HISTORIAL DE BAJAS
   --------------------- */
async function verHistorial(idLote) {
  try {
    const { data: historial, error } = await supabaseClient
      .from("baja_mp")
      .select(`
        id_baja,
        fecha_baja,
        cantidad_baja,
        motivo,
        estado_anterior,
        estado_nuevo,
        usuarios ( id, name )
      `)
      .eq("id_lote", idLote)
      .order("fecha_baja", { ascending: false });

    if (error) {
      console.error("Error al obtener historial:", error);
      return Swal.fire("Error", "No se pudo obtener el historial del lote.", "error");
    }

    bodyHistorial.innerHTML = "";

    if (!historial || historial.length === 0) {
      bodyHistorial.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#aaa;">No hay registros de baja para este lote.</td>
        </tr>`;
    } else {
      historial.forEach((reg) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
          <td>${reg.fecha_baja ? new Date(reg.fecha_baja).toLocaleString() : ""}</td>
          <td>${reg.usuarios?.name || "Desconocido"}</td>
          <td>${reg.cantidad_baja}</td>
          <td>${reg.motivo || "—"}</td>
          <td>${reg.estado_anterior || "—"}</td>
          <td>${reg.estado_nuevo || "—"}</td>
        `;
        bodyHistorial.appendChild(fila);
      });
    }

    document.getElementById("modalHistorial").style.display = "block";
  } catch (err) {
    console.error("Error verHistorial:", err);
    Swal.fire("Error", "No se pudo cargar el historial.", "error");
  }
}

function cerrarHistorial() {
  document.getElementById("modalHistorial").style.display = "none";
}

/* ---------------------
   CIERRE DE MODALES AL HACER CLICK FUERA
   --------------------- */
window.addEventListener("click", (e) => {
  const modals = ["modalNuevoLote", "modalBaja", "modalHistorial"];
  for (const id of modals) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (e.target === el) el.style.display = "none";
  }
});

/* ---------------------
   INICIALIZACIÓN
   --------------------- */
document.addEventListener("DOMContentLoaded", () => {
  cargarLotes();

  const inputBuscador = document.getElementById("buscadorLotes");
  if (inputBuscador) {
    inputBuscador.addEventListener("input", (e) => {
      filtrarLotes(e.target.value);
    });
  }
});


function filtrarLotes(termino) {
  const filtro = termino.toLowerCase();

  // filtrar por nombre de material, código de lote o estado
  const lotesFiltrados = todosLosLotes.filter(lote => {
    const nombre = lote.materiales?.nombre?.toLowerCase() || "";
    const codigo = lote.lote?.toLowerCase() || "";
    const disponibilidad = lote.disponibilidad?.toLowerCase() || "";
    return (
      nombre.includes(filtro) ||
      codigo.includes(filtro) ||
      disponibilidad.includes(filtro)
    );
  });

  mostrarLotesEnTabla(lotesFiltrados);
}

function mostrarLotesEnTabla(lista) {
  bodyLotes.innerHTML = "";
  for (const lote of lista) {
    const estadoInfo = calcularEstadoLote(lote);
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${lote.id_lote}</td>
      <td>${lote.materiales?.nombre || "—"}</td>
      <td>${lote.lote || ""}</td>
      <td>${lote.cantidad ?? 0}</td>
      <td>${lote.cantidad_disponible ?? 0}</td>
      <td>${lote.fecha_ingreso || ""}</td>
      <td>${lote.fecha_caducidad || ""}</td>
      <td class="${estadoInfo.class}">${lote.disponibilidad || estadoInfo.text}</td>
      <td>
        <button class="btn-baja" onclick="abrirModalBaja(${lote.id_lote})">Dar baja</button>
        <button class="btn-historial" onclick="verHistorial(${lote.id_lote})">Historial</button>
      </td>
    `;
    bodyLotes.appendChild(fila);
  }
}
