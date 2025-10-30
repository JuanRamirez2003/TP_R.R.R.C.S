console.log("Iniciando Panel de alertas...");

// ================== Configuración Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let alertasGlobal = [];

// ================== Cargar alertas ==================
async function cargarAlertas() {
  console.log("Cargando alertas desde Supabase...");

  const contenedor = document.getElementById("contenedor-alertas");
  const contador = document.getElementById("contador-alertas");
  contenedor.innerHTML = "Cargando alertas...";

  const hoy = new Date();

  const { data: ordenes, error } = await supabaseClient
    .from("orden_produccion")
    .select(`
      numero_op,
      motivo,
      fecha_estimada_entrega,
      estado,
      productos (nombre)
    `)
    .eq("estado", "Pendiente")
    .order("fecha_estimada_entrega", { ascending: true });

  if (error) {
    console.error("Error al cargar alertas:", error.message);
    contenedor.innerHTML = `<p style="color:red">Error al cargar alertas: ${error.message}</p>`;
    return;
  }

  const alertas = ordenes.map((op) => {
    const fechaEntrega = new Date(op.fecha_estimada_entrega);
    const diffDias = Math.ceil((fechaEntrega - hoy) / (1000 * 60 * 60 * 24));

    let urgencia = "";
    let estadoFecha = "";

    if (diffDias < 0) {
      urgencia = "alta";
      estadoFecha = `Vencida hace ${Math.abs(diffDias)} día${Math.abs(diffDias) === 1 ? "" : "s"}`;
    } else if (diffDias === 0) {
      urgencia = "media";
      estadoFecha = "Vence hoy";
    } else if (diffDias <= 2) {
      urgencia = "media";
      estadoFecha = `Vence en ${diffDias} día${diffDias === 1 ? "" : "s"}`;
    } else {
      urgencia = "baja"; // fuera de rango de alerta
      estadoFecha = `Vence en ${diffDias} días`;
    }

    return {
      numero_op: op.numero_op,
      producto: op.productos?.nombre || "Sin producto",
      motivo: op.motivo || "Sin motivo",
      fecha: op.fecha_estimada_entrega,
      estadoFecha,
      urgencia,
    };
  });

  alertasGlobal = alertas;
  aplicarFiltros();
}

// ================== Renderizado ==================
function renderAlertas(alertas) {
  const contenedor = document.getElementById("contenedor-alertas");
  const contador = document.getElementById("contador-alertas");
  contenedor.innerHTML = "";

  if (alertas.length === 0) {
    contenedor.innerHTML = "<p>No hay alertas pendientes 🎉</p>";
    contador.textContent = "0 alertas";
    return;
  }

  alertas.forEach((alerta) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = `alerta ${alerta.urgencia}`;

    let emoji = "🟢";
    if (alerta.urgencia === "media") emoji = "🟠";
    if (alerta.urgencia === "alta") emoji = "🔴";

    tarjeta.innerHTML = `
      <div class="alerta-header">
        <strong>${emoji} OP ${alerta.numero_op}</strong>
        <span class="estado">${alerta.urgencia.toUpperCase()}</span>
      </div>
      <div class="alerta-info">
        <p><b>Producto:</b> ${alerta.producto}</p>
        <p><b>Motivo:</b> ${alerta.motivo}</p>
        <p><b>Fecha estimada:</b> ${new Date(alerta.fecha).toLocaleDateString()}</p>
        <p><b>Estado:</b> ${alerta.estadoFecha}</p>
      </div>
    `;

    contenedor.appendChild(tarjeta);
  });

  contador.textContent = `${alertas.length} alertas encontradas`;
}

// ================== Filtros automáticos ==================
function aplicarFiltros() {
  const texto = document.getElementById("buscador").value.toLowerCase().trim();
  const tipoFiltro = document.getElementById("filtro-estado").value;

  let filtradas = alertasGlobal;

  // 🔍 Filtro por texto
  if (texto) {
    filtradas = filtradas.filter(
      (a) =>
        a.producto.toLowerCase().includes(texto) ||
        a.motivo.toLowerCase().includes(texto) ||
        a.numero_op.toLowerCase().includes(texto)
    );
  }

  // ⚙️ Filtro por tipo (vencidas / por vencer)
  if (tipoFiltro === "vencidas") {
    filtradas = filtradas.filter((a) => a.urgencia === "alta");
  } else if (tipoFiltro === "por-vencer") {
    filtradas = filtradas.filter((a) => a.urgencia === "media");
  }

  renderAlertas(filtradas);
}

// ================== Eventos ==================
document.getElementById("buscador").addEventListener("input", aplicarFiltros);
document.getElementById("filtro-estado").addEventListener("change", aplicarFiltros);

// ================== Iniciar ==================
cargarAlertas();
