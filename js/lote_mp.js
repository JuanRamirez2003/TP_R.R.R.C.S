/* lote_mp.js actualizado
   - Compatible con el HTML/CSS existente
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

async function cargarProveedoresPorMaterial(id_mp) {
  try {
    // Primero obtenemos los IDs de proveedor principal y secundario
    const { data: matData, error: matError } = await supabaseClient
      .from("materiales")
      .select("id_proveedor, id_proveedorsec")
      .eq("id_mp", id_mp)
      .single();

    if (matError || !matData) throw matError || new Error("No se encontró la materia prima");

    const idsProveedores = [matData.id_proveedor, matData.id_proveedorsec].filter(Boolean);
    const selProveedor = document.getElementById("nuevoProveedor");

    if (!idsProveedores.length) {
      selProveedor.innerHTML = "<option value=''>No hay proveedores asociados</option>";
      return;
    }

    // Ahora obtenemos los datos de esos proveedores
    const { data: proveedores, error: provError } = await supabaseClient
      .from("proveedor")
      .select("id_proveedor, nombre")
      .in("id_proveedor", idsProveedores);

    if (provError || !proveedores?.length) {
      selProveedor.innerHTML = "<option value=''>No se encontraron proveedores</option>";
      console.error("Error cargando proveedores:", provError);
      return;
    }

    selProveedor.innerHTML = `<option value="">-- Seleccionar proveedor --</option>` +
      proveedores.map(p => `<option value="${p.id_proveedor}">${p.nombre}</option>`).join("");

  } catch (err) {
    console.error("Error en cargarProveedoresPorMaterial:", err);
    document.getElementById("nuevoProveedor").innerHTML = "<option value=''>Error al cargar</option>";
  }
}

/* ---------------------
   CARGA PRINCIPAL DE LOTES
--------------------- */
async function cargarLotes() {
  try {
    const { data: lotes, error } = await supabaseClient
      .from("lote_mp")
      .select(`*, materiales (id_mp, nombre)`)
      .order("id_lote", { ascending: true });

    if (error) throw error;

    todosLosLotes = lotes;
    mostrarLotesEnTabla(lotes);
  } catch (err) {
    console.error("Error al cargar lotes:", err);
    Swal.fire("Error", "❌ Error al cargar los lotes. Ver consola.", "error");
  }
}

/* ---------------------
   CALCULAR DISPONIBILIDAD (según fecha y cantidad)
--------------------- */
function calcularEstadoLote({ cantidad_disponible, fecha_caducidad }) {
  const hoy = new Date();
  const cad = fecha_caducidad ? new Date(fecha_caducidad) : null;
  const cantidad = Number(cantidad_disponible ?? 0);

  if (cantidad <= 0) return { text: "No disponible", class: "nodisponible" };
  if (!cad) return { text: "Disponible", class: "disponible" };

  const diff = (cad - hoy) / (1000 * 60 * 60 * 24);
  if (diff < 0) return { text: "Vencido", class: "vencido" };
  if (diff <= 14) return { text: "Próximo a vencer", class: "proximo" };
  return { text: "Disponible", class: "disponible" };
}

/* ---------------------
   MODAL NUEVO LOTE
--------------------- */
function abrirModalNuevoLote() {
  document.getElementById("nuevoIdMp").innerHTML = "<option value=''>Cargando...</option>";
  document.getElementById("nuevoProveedor").innerHTML = "<option value=''>Seleccione un proveedor</option>";
  document.getElementById("nuevoLote").value = "";
  document.getElementById("nuevoCantidad").value = "";
  document.getElementById("nuevoFechaIngreso").value = "";
  document.getElementById("nuevoFechaCaducidad").value = "";

  cargarMateriasParaSelect().then(() => {
    document.getElementById("modalNuevoLote").style.display = "block";

    // Cada vez que cambie la materia prima, cargamos sus proveedores
    document.getElementById("nuevoIdMp").addEventListener("change", (e) => {
      const idMp = e.target.value;
      if (idMp) cargarProveedoresPorMaterial(idMp);
      else document.getElementById("nuevoProveedor").innerHTML = "<option value=''>Seleccione una materia prima primero</option>";
    });
  });
}


function cerrarModalNuevoLote() {
  document.getElementById("modalNuevoLote").style.display = "none";
}

/* Carga lista de materiales */
async function cargarMateriasParaSelect() {
  try {
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

/* Generar código de lote */
function generarCodigoLote(id_mp) {
  const fecha = new Date();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  const secuencia = Math.floor(Math.random() * 900 + 100);
  return `LOT-MP${id_mp}-${año}${mes}${dia}-${secuencia}`;
}

/* Guardar nuevo lote */
async function guardarNuevoLote() {
  const id_mp = document.getElementById("nuevoIdMp").value;
  const id_proveedor = document.getElementById("nuevoProveedor").value;
  const cantidad = parseFloat(document.getElementById("nuevoCantidad").value);
  const fecha_ingreso = document.getElementById("nuevoFechaIngreso").value;
  const fecha_caducidad = document.getElementById("nuevoFechaCaducidad").value;

  if (!id_mp || !id_proveedor || !cantidad || !fecha_ingreso || !fecha_caducidad) {
    Swal.fire("Campos incompletos", "Completa todos los campos antes de guardar.", "warning");
    return;
  }

  try {
    const { data: maxLoteData, error: maxError } = await supabaseClient
      .from("lote_mp")
      .select("id_lote")
      .order("id_lote", { ascending: false })
      .limit(1);
    if (maxError) throw maxError;

    const siguienteId = maxLoteData?.length ? maxLoteData[0].id_lote + 1 : 1;
    const codigoLote = `LOT-MP${id_mp}-${siguienteId}`;

    const { text: disponibilidad } = calcularEstadoLote({
      cantidad_disponible: cantidad,
      fecha_caducidad
    });

    const nuevoLote = {
      id_mp: parseInt(id_mp),
      id_proveedor: parseInt(id_proveedor),
      lote: codigoLote,
      cantidad,
      cantidad_disponible: cantidad,
      cantidad_consumida: 0,
      cantidad_reservada: 0,
      fecha_ingreso,
      fecha_caducidad,
      disponibilidad,
      estado: "Conforme"
    };

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
   MODAL BAJA
--------------------- */
async function abrirModalBaja(id_lote) {
  try {
    const { data, error } = await supabaseClient
      .from("lote_mp")
      .select("id_lote, id_mp, lote, cantidad, cantidad_disponible, disponibilidad, materiales(nombre)")
      .eq("id_lote", id_lote)
      .single();

    if (error || !data) return Swal.fire("Error", "No se pudo cargar el lote.", "error");

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

/* Confirmar baja */
async function confirmarBaja() {
  try {
    const idLote = Number(document.getElementById("bajaIdLote").value);
    const cantidadBaja = parseFloat(document.getElementById("bajaCantidad").value);
    const motivo = document.getElementById("bajaMotivo").value.trim();

    if (isNaN(cantidadBaja) || cantidadBaja <= 0) return Swal.fire("Error", "Cantidad inválida.", "error");
    if (!motivo) return Swal.fire("Error", "Especificá un motivo.", "warning");

    const { data: lote, error: loteErr } = await supabaseClient
      .from("lote_mp")
      .select("*")
      .eq("id_lote", idLote)
      .single();
    if (loteErr || !lote) return Swal.fire("Error", "No se pudo obtener el lote.", "error");

    const confirmacion = await Swal.fire({
      title: "Confirmar baja",
      text: `Se dará de baja ${cantidadBaja} unidades del lote ${lote.lote}.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar"
    });
    if (!confirmacion.isConfirmed) return;

    const cantidadFinal = Math.max(0, (lote.cantidad_disponible ?? 0) - cantidadBaja);
    const { text: nuevaDisponibilidad } = calcularEstadoLote({
      cantidad_disponible: cantidadFinal,
      fecha_caducidad: lote.fecha_caducidad
    });

    const { error: errorUpdate } = await supabaseClient
      .from("lote_mp")
      .update({
        cantidad_disponible: cantidadFinal,
        cantidad_consumida: (Number(lote.cantidad_consumida ?? 0) + cantidadBaja),
        disponibilidad: nuevaDisponibilidad
      })
      .eq("id_lote", idLote);
    if (errorUpdate) return Swal.fire("Error", "No se pudo actualizar el lote.", "error");

    const usuarioActual = JSON.parse(localStorage.getItem("usuarioActual") || "null");
    const idUsuario = usuarioActual?.id ?? null;

    await supabaseClient
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

    Swal.fire("Hecho", "Baja registrada correctamente.", "success");
    cerrarModalBaja();
    cargarLotes();
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
      .select(`id_baja, fecha_baja, cantidad_baja, motivo, estado_anterior, estado_nuevo, usuarios(id, name)`)
      .eq("id_lote", idLote)
      .order("fecha_baja", { ascending: false });
    if (error) return Swal.fire("Error", "No se pudo obtener el historial.", "error");

    bodyHistorial.innerHTML = historial?.length
      ? historial.map(reg => `
          <tr>
            <td>${reg.fecha_baja ? new Date(reg.fecha_baja).toLocaleString() : ""}</td>
            <td>${reg.usuarios?.name || "Desconocido"}</td>
            <td>${reg.cantidad_baja}</td>
            <td>${reg.motivo || "—"}</td>
            <td>${reg.estado_anterior || "—"}</td>
            <td>${reg.estado_nuevo || "—"}</td>
          </tr>`).join("")
      : `<tr><td colspan="6" style="text-align:center; color:#aaa;">No hay registros de baja para este lote.</td></tr>`;

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
  ["modalNuevoLote", "modalBaja", "modalHistorial"].forEach(id => {
    const el = document.getElementById(id);
    if (el && e.target === el) el.style.display = "none";
  });
});

/* ---------------------
   BUSCADOR DE LOTES
--------------------- */
function filtrarLotes(termino) {
  const filtro = termino.toLowerCase();
  const lotesFiltrados = todosLosLotes.filter(lote => {
    const nombre = lote.materiales?.nombre?.toLowerCase() || "";
    const codigo = lote.lote?.toLowerCase() || "";
    const disponibilidad = lote.disponibilidad?.toLowerCase() || "";
    return nombre.includes(filtro) || codigo.includes(filtro) || disponibilidad.includes(filtro);
  });
  mostrarLotesEnTabla(lotesFiltrados);
}

function mostrarLotesEnTabla(lista) {
  bodyLotes.innerHTML = "";
  lista.forEach(lote => {
    const { text, class: clase } = calcularEstadoLote(lote);
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${lote.id_lote}</td>
      <td>${lote.materiales?.nombre || "—"}</td>
      <td>${lote.lote || ""}</td>
      <td>${lote.cantidad ?? 0}</td>
      <td>${lote.cantidad_disponible ?? 0}</td>
      <td>${lote.fecha_ingreso || ""}</td>
      <td>${lote.fecha_caducidad || ""}</td>
      <td class="${clase}">${lote.disponibilidad || text}</td>
      <td>
        <button class="btn-baja" onclick="abrirModalBaja(${lote.id_lote})">Dar baja</button>
        <button class="btn-historial" onclick="verHistorial(${lote.id_lote})">Historial</button>
      </td>
    `;
    bodyLotes.appendChild(fila);
  });
}

/* ---------------------
   ACTUALIZAR DISPONIBILIDAD LOTES
--------------------- */
async function actualizarDisponibilidadLotes() {
  try {
    const { data: lotes, error } = await supabaseClient
      .from("lote_mp")
      .select("id_lote, cantidad_disponible, fecha_caducidad, disponibilidad");

    if (error) throw error;

    for (const lote of lotes) {
      const { text: nuevoEstado } = calcularEstadoLote(lote);
      if (lote.disponibilidad !== nuevoEstado) {
        await supabaseClient
          .from("lote_mp")
          .update({ disponibilidad: nuevoEstado })
          .eq("id_lote", lote.id_lote);
      }
    }

    // recargar tabla sin sobrecargar
    await cargarLotes();
  } catch (err) {
    console.error("Error actualizando disponibilidad:", err);
  }
}

/* ---------------------
   INICIALIZACIÓN
--------------------- */
document.addEventListener("DOMContentLoaded", () => {
  cargarLotes();

  const inputBuscador = document.getElementById("buscadorLotes");
  if (inputBuscador) inputBuscador.addEventListener("input", e => filtrarLotes(e.target.value));

  // actualizar disponibilidad inicial y luego cada 5 minutos
  actualizarDisponibilidadLotes();
  setInterval(actualizarDisponibilidadLotes, 5 * 60 * 1000);
});


// --------------------------Notificador------------------------------------------------------------------
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

    // Filtrar lotes próximos a vencer y que tengan stock disponible
    const proximosAVencer = lotes.filter(lote => {
      if (!lote.fecha_caducidad) return false;
      if ((lote.cantidad_disponible ?? 0) <= 0) return false; // ignorar no disponible
      const diffDias = (new Date(lote.fecha_caducidad) - hoy) / (1000 * 60 * 60 * 24);
      return diffDias <= 14 && diffDias >= 0;
    });

    // Actualizar contador
    const contador = document.getElementById("contadorNotificaciones");
    contador.textContent = proximosAVencer.length;
    contador.style.display = proximosAVencer.length > 0 ? "inline-block" : "none";

    // Actualizar lista con vista mejorada
    const lista = document.getElementById("listaNotificaciones");
    if (proximosAVencer.length === 0) {
      lista.innerHTML = `<li>No hay notificaciones pendientes</li>`;
    } else {
      lista.innerHTML = proximosAVencer.map(lote => {
        const fechaCad = new Date(lote.fecha_caducidad);
        const diffDias = Math.floor((fechaCad - hoy) / (1000 * 60 * 60 * 24));
        return `<li class="notif-item">
          <strong>${lote.materiales?.nombre || '—'}</strong><br>
          Lote: ${lote.lote}<br>
          Próximo a vencer: ${diffDias} días<br>
          Fecha. Venc: ${lote.fecha_caducidad}
        </li>`;
      }).join("");
    }
  } catch (err) {
    console.error("Error actualizando notificaciones:", err);
  }
}

// Inicializar al cargar la página
document.addEventListener("DOMContentLoaded", actualizarNotificaciones);

// Opcional: actualizar cada X minutos
setInterval(actualizarNotificaciones, 5 * 60 * 1000); // cada 5 minutos

