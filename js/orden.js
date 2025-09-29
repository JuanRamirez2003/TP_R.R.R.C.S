console.log("Iniciando aplicación...");

// ============================
// Configuración Supabase
// ============================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ============================
// DOM
// ============================
const ordenLoteInput = document.getElementById("ordenLote");
const ordenVentaSelect = document.getElementById("ordenVentaSelect");
const materiaSelect = document.getElementById("materiaSelect");
const materiasLista = document.getElementById("materiasLista");
const btnAgregarMateria = document.getElementById("btnAgregarMateria");
const ordenForm = document.getElementById("formCrearOrden");
const ordenBody = document.getElementById("ordenBody");
const detalleOrdenDiv = document.getElementById("detalleOrdenVenta");

// ============================
// Variables
// ============================
let materias = [];
let contadorLote = 1;
let ordenesVentas = [];
let lotesMP = [];

// ============================
// Generar lote automático
// ============================
function generarCodigoLote() {
  const fecha = new Date();
  const yyyymmdd = fecha.toISOString().slice(0, 10).replace(/-/g, "");
  ordenLoteInput.value = `LOTE-${yyyymmdd}-${String(contadorLote).padStart(3, "0")}`;
}

// ============================
// Cargar órdenes de venta
// ============================
async function cargarOrdenesVenta() {
  const { data, error } = await supabaseClient.from("orden_ventas").select("*");
  if (error) return console.error(error.message);

  ordenesVentas = data;
  ordenVentaSelect.innerHTML = `<option value="">Seleccione una orden...</option>`;
  data.forEach(ov => {
    const opt = document.createElement("option");
    opt.value = ov.id_orden;
    opt.textContent = `#${ov.id_orden}`;
    ordenVentaSelect.appendChild(opt);
  });
}

// ============================
// Mostrar detalle de orden
// ============================
async function mostrarDetalleOrden() {
  const ordenId = ordenVentaSelect.value;
  detalleOrdenDiv.innerHTML = "";
  document.getElementById("productosOrden").innerHTML = "";

  if (!ordenId) return;

  const orden = ordenesVentas.find(o => o.id_orden == ordenId);
  if (!orden) return;

  const { data: detalles, error } = await supabaseClient
    .from("detalle_ordenes")
    .select(`id_producto, cantidad, productos: id_producto(nombre)`)
    .eq("id_orden", ordenId);

  if (error) return console.error(error.message);

  // Mostrar detalle
  let listaProductos = detalles.map(d => `<li>${d.productos.nombre} - Cantidad: ${d.cantidad}</li>`).join("");
  detalleOrdenDiv.innerHTML = `
    <p><b>Orden #${orden.id_orden}</b></p>
    <p>Cliente: ${orden.id_cliente ?? "N/A"}</p>
    <p>Fecha: ${orden.fecha ?? "N/A"}</p>
    <b>Productos:</b>
    <ul>${listaProductos}</ul>
  `;

  // Productos con botón asignar
  const contenedor = document.getElementById("productosOrden");
  contenedor.innerHTML = "";
  detalles.forEach(d => {
    const div = document.createElement("div");
    div.className = "producto-card";
    div.innerHTML = `
      <div>
        <div><b>${d.productos.nombre}</b></div>
        <div class="small-muted">Cantidad: ${d.cantidad}</div>
      </div>
      <div class="right">
        <button type="button" class="small btn-primary" data-assign-prod="${d.id_producto}">Asignar lotes</button>
      </div>
    `;
    contenedor.appendChild(div);
  });
}

// ============================
// Cargar lotes disponibles por producto
// ============================
async function cargarMateriasPrimas(id_producto) {
  // Traer las materias primas asociadas al producto
  const { data: mpRelacionados, error: err1 } = await supabaseClient
    .from("producto_materia")
    .select("id_mp")
    .eq("id_producto", id_producto);
  if(err1) return console.error(err1);

  const idsMP = mpRelacionados.map(m => m.id_mp);

  // Traer los lotes disponibles
  const { data: lotes, error: err2 } = await supabaseClient
    .from("lote_mp")
    .select("*")
    .in("id_mp", idsMP)
    .eq("estado","disponible");
  if(err2) return console.error(err2);

  lotesMP = lotes;
  materiaSelect.innerHTML = '<option value="">Seleccione un lote...</option>';
  lotes.forEach(lote => {
    const opt = document.createElement("option");
    opt.value = lote.id_lote;
    opt.textContent = `Lote ${lote.d_lote} - Cant: ${lote.cantidad_disponible} - Ing: ${lote.fecha_ingreso} - Cad: ${lote.fecha_caducidad}`;
    materiaSelect.appendChild(opt);
  });
}

// ============================
// Agregar materia a lista temporal
// ============================
function agregarMateria() {
  const loteId = materiaSelect.value;
  if (!loteId) return alert("Seleccione un lote");

  const lote = lotesMP.find(l => l.id_lote == loteId);
  if (!lote || lote.cantidad_disponible <= 0) return alert("Lote inválido o sin stock");

  // Tomar toda la cantidad disponible
  const cantidadTomada = lote.cantidad_disponible;
  lote.cantidad_disponible = 0;

  const existente = materias.find(m => m.id_lote === lote.id_lote);
  if (existente) {
    existente.cantidad += cantidadTomada;
  } else {
    materias.push({ id_lote: lote.id_lote, cantidad: cantidadTomada });
  }

  refrescarListaMaterias();
  cargarMateriasPrimas(lote.id_mp); // recarga lotes del mismo producto
}

// ============================
// Refrescar lista de materias asignadas
// ============================
function refrescarListaMaterias() {
  materiasLista.innerHTML = "";
  materias.forEach((m, index) => {
    const li = document.createElement("li");
    li.textContent = `Lote ${m.id_lote} - Tomado: ${m.cantidad}`;

    const btn = document.createElement("button");
    btn.textContent = "❌";
    btn.style.marginLeft = "10px";
    btn.addEventListener("click", () => eliminarMateria(index));

    li.appendChild(btn);
    materiasLista.appendChild(li);
  });
}

// ============================
// Eliminar materia de la lista
// ============================
function eliminarMateria(index) {
  const materia = materias[index];
  const loteOriginal = lotesMP.find(l => l.id_lote === materia.id_lote);
  if (loteOriginal) loteOriginal.cantidad_disponible += materia.cantidad;

  materias.splice(index, 1);
  refrescarListaMaterias();
}

// ============================
// Guardar orden de producción
// ============================
async function guardarOrden(e) {
  e.preventDefault();
  if (!ordenVentaSelect.value || materias.length === 0) return alert("Seleccione orden y al menos un lote");

  const loteCodigo = ordenLoteInput.value;

  const { error } = await supabaseClient.from("orden_produccion").insert({
    lote: loteCodigo,
    id_orden_venta: ordenVentaSelect.value,
    estado: "Pendiente",
    inicio: new Date().toISOString()
  });

  if (error) return console.error(error.message);

  alert("Orden de producción creada ✅");
  materias = [];
  refrescarListaMaterias();
  generarCodigoLote();
  cargarOrdenesProduccion();
}

// ============================
// Cargar órdenes de producción
// ============================
async function cargarOrdenesProduccion() {
  const { data, error } = await supabaseClient.from("ordenes_produccion").select("*");
  if (error) return console.error(error.message);

  ordenBody.innerHTML = "";
  data.forEach(o => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${o.lote}</td>
      <td>#${o.id_orden_venta}</td>
      <td>-</td>
      <td>${o.inicio ?? ""}</td>
      <td>${o.fin ?? ""}</td>
      <td>${o.estado}</td>
    `;
    ordenBody.appendChild(row);
  });
}

// ============================
// Eventos
// ============================
btnAgregarMateria.addEventListener("click", agregarMateria);
ordenForm.addEventListener("submit", guardarOrden);
ordenVentaSelect.addEventListener("change", mostrarDetalleOrden);

document.getElementById("productosOrden").addEventListener("click", e => {
  if (e.target.matches("[data-assign-prod]")) {
    cargarMateriasPrimas(e.target.dataset.assignProd);
  }
});

// ============================
// Inicialización
// ============================
generarCodigoLote();
cargarOrdenesVenta();
cargarOrdenesProduccion();
