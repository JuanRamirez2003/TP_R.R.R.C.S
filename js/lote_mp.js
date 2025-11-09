const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const bodyLotes = document.getElementById("bodyLotes");
let loteSeleccionado = null;

// 🔹 Cargar todos los lotes
async function cargarLotes() {
  try {
    const { data: lotes, error } = await supabaseClient
      .from("lote_mp")
      .select(`
        *,
        materiales (nombre, unidad)
      `)
      .order("id_lote", { ascending: true });

    if (error) throw error;

    bodyLotes.innerHTML = "";

    lotes.forEach((lote) => {
      const estadoInfo = calcularEstadoLote(lote);

      const fila = document.createElement("tr");
      fila.innerHTML = `
        <td>${lote.id_lote}</td>
        <td>${lote.materiales?.nombre || "—"}</td>
        <td>${lote.lote}</td>
        <td>${lote.cantidad}</td>
        <td>${lote.cantidad_disponible}</td>
        <td>${new Date(lote.fecha_ingreso).toLocaleDateString()}</td>
        <td>${new Date(lote.fecha_caducidad).toLocaleDateString()}</td>
        <td class="${estadoInfo.class}">${estadoInfo.text}</td>
        <td>
          <button class="btn-baja" onclick="abrirModalBaja(${lote.id_lote})">Dar baja</button>
          <button class="btn-historial" onclick="verHistorial(${lote.id_lote})">Historial</button>
        </td>
      `;
      bodyLotes.appendChild(fila);
    });
  } catch (err) {
    console.error("Error al cargar lotes:", err);
    Swal.fire("Error", "❌ Error al cargar los lotes.", "error");
  }
}

function calcularEstadoLote(lote) {
  const hoy = new Date();
  const cad = new Date(lote.fecha_caducidad);
  const diff = (cad - hoy) / (1000 * 60 * 60 * 24);

  if (diff <= 0) return { text: "Vencido", class: "vencido" };
  if (diff <= 14) return { text: "Próximo a vencer", class: "proximo" };
  if (lote.estado === "No disponible") return { text: "No disponible", class: "nodisponible" };
  return { text: "Disponible", class: "disponible" };
}

// 🔹 Abrir modal de baja
async function abrirModalBaja(id_lote) {
  const { data, error } = await supabaseClient
    .from("lote_mp")
    .select("id_lote, cantidad_disponible, estado, materiales(nombre)")
    .eq("id_lote", id_lote)
    .single();

  if (error) {
    console.error(error);
    Swal.fire("Error", "Error al obtener el lote.", "error");
    return;
  }

  loteSeleccionado = data;
  document.getElementById("bajaIdLote").value = data.id_lote;
  document.getElementById("bajaNombre").value = data.materiales?.nombre || "—";
  document.getElementById("bajaCantidadActual").value = data.cantidad_disponible;
  document.getElementById("bajaCantidad").value = "";
  document.getElementById("bajaMotivo").value = "";

  document.getElementById("modalBaja").style.display = "block";
}

function cerrarModalBaja() {
  document.getElementById("modalBaja").style.display = "none";
}

// 🔹 Confirmar baja
async function confirmarBaja() {
  const idLote = document.getElementById("bajaIdLote").value;
  const cantidadBaja = parseFloat(document.getElementById("bajaCantidad").value);
  const motivo = document.getElementById("bajaMotivo").value.trim();

  if (!cantidadBaja || cantidadBaja <= 0) {
    Swal.fire("Error", "Ingrese una cantidad válida.", "error");
    return;
  }

  const { data: lote, error: errorLote } = await supabaseClient
    .from("lote_mp")
    .select("*")
    .eq("id_lote", idLote)
    .single();

  if (errorLote || !lote) {
    Swal.fire("Error", "No se pudo obtener la información del lote.", "error");
    return;
  }
    // 🔹 Confirmación antes de proceder
  const confirmacion = await Swal.fire({
    title: "¿Confirmar baja?",
    text: "Esta acción actualizará el stock y no podrá revertirse.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#00c896",
    cancelButtonColor: "#d33",
    confirmButtonText: "Sí, confirmar",
    cancelButtonText: "Cancelar"
  });

  if (!confirmacion.isConfirmed) return;

  // ⬇️ Si el usuario confirma, sigue el proceso normal

  const nuevaCantidad = lote.cantidad_disponible - cantidadBaja;
  const nuevoEstado = nuevaCantidad <= 0 ? "No disponible" : lote.estado;

  const { error: errorUpdate } = await supabaseClient
    .from("lote_mp")
    .update({
      cantidad_disponible: nuevaCantidad,
      estado: nuevoEstado
    })
    .eq("id_lote", idLote);

  if (errorUpdate) {
    Swal.fire("Error", "No se pudo actualizar el lote.", "error");
    return;
  }

  const usuarioActual = JSON.parse(localStorage.getItem("usuarioActual"));
  const idUsuario = usuarioActual?.id || null;

  const { error: errorInsert } = await supabaseClient.from("baja_mp").insert({
    id_lote: idLote,
    cantidad_baja: cantidadBaja,
    motivo,
    fecha_baja: new Date().toISOString(),
    id_usuario: idUsuario,
    estado_anterior: lote.estado,
    estado_nuevo: nuevoEstado
  });

  if (errorInsert) {
    Swal.fire("Error", "No se pudo registrar la baja en el historial.", "error");
    return;
  }

  Swal.fire("Éxito", "La baja fue registrada correctamente.", "success");
  cerrarModalBaja();
  cargarLotes();
}

// 🔹 Ver historial
async function verHistorial(idLote) {
  try {
    const { data: historial, error } = await supabaseClient
      .from("baja_mp")
      .select(`
        fecha_baja,
        cantidad_baja,
        motivo,
        estado_anterior,
        estado_nuevo,
        usuarios ( name )
      `)
      .eq("id_lote", idLote)
      .order("fecha_baja", { ascending: false });

    if (error) throw error;

    const bodyHistorial = document.getElementById("bodyHistorial");
    bodyHistorial.innerHTML = "";

    if (!historial || historial.length === 0) {
      bodyHistorial.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#aaa;">No hay registros de baja para este lote.</td>
        </tr>`;
    } else {
      historial.forEach((registro) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
          <td>${new Date(registro.fecha_baja).toLocaleString()}</td>
          <td>${registro.usuarios?.name || "Desconocido"}</td>
          <td>${registro.cantidad_baja}</td>
          <td>${registro.motivo || "—"}</td>
          <td>${registro.estado_anterior}</td>
          <td>${registro.estado_nuevo}</td>
        `;
        bodyHistorial.appendChild(fila);
      });
    }

    document.getElementById("modalHistorial").style.display = "block";
  } catch (err) {
    console.error("Error al obtener historial:", err);
    Swal.fire("Error", "No se pudo obtener el historial del lote.", "error");
  }
}

//Ver Historial Version 2 ---> con usuario
/*
async function verHistorial(idLote) {
  try {
    const { data: historial, error } = await supabaseClient
      .from("baja_mp")
      .select(`
        fecha_baja,
        cantidad_baja,
        motivo,
        estado_anterior,
        estado_nuevo,
        usuarios:usuarios!id_usuario_fkey ( name )
      `)
      .eq("id_lote", idLote)
      .order("fecha_baja", { ascending: false });

    if (error) throw error;

    const tbody = document.querySelector("#tablaHistorial tbody");
    tbody.innerHTML = "";

    if (!historial || historial.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; color:#aaa;">
            No hay registros de baja para este lote.
          </td>
        </tr>`;
    } else {
      historial.forEach((registro) => {
        const fila = document.createElement("tr");
        fila.innerHTML = `
          <td>${new Date(registro.fecha_baja).toLocaleString()}</td>
          <td>${registro.usuarios?.name || "Desconocido"}</td>
          <td>${registro.cantidad_baja}</td>
          <td>${registro.motivo || "—"}</td>
          <td>${registro.estado_anterior}</td>
          <td>${registro.estado_nuevo}</td>
        `;
        tbody.appendChild(fila);
      });
    }

    document.getElementById("modalHistorial").style.display = "block";
  } catch (err) {
    console.error("Error al obtener historial:", err);
    Swal.fire("Error", "No se pudo obtener el historial del lote.", "error");
  }
}
*/

function cerrarHistorial() {
  document.getElementById("modalHistorial").style.display = "none";
}

// 🔹 Inicializar
cargarLotes();
