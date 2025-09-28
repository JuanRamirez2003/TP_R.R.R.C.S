console.log("Iniciando aplicación...");

// ============================
// Configuración Supabase
// ============================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);




// DOM
const ordenLoteInput = document.getElementById("ordenLote");
const ordenVentaSelect = document.getElementById("ordenVentaSelect");
const materiaSelect = document.getElementById("materiaSelect");
const materiasLista = document.getElementById("materiasLista");
const btnAgregarMateria = document.getElementById("btnAgregarMateria");
const ordenForm = document.getElementById("formCrearOrden");
const ordenBody = document.getElementById("ordenBody");

// Variables
let materias = [];
let contadorLote = 1;
let ordenesVentas = [];
let lotesMP = [];

// Generar lote automático
function generarCodigoLote() {
  const fecha = new Date();
  const yyyymmdd = fecha.toISOString().slice(0, 10).replace(/-/g, "");
  const codigo = `LOTE-${yyyymmdd}-${String(contadorLote).padStart(3, "0")}`;
  ordenLoteInput.value = codigo;
}

// Cargar órdenes de venta
async function cargarOrdenesVenta() {
  const { data, error } = await supabaseClient.from("orden_ventas").select("*");
  if (error) return console.error("Error cargando órdenes de venta:", error.message);

  ordenesVentas = data;
  ordenVentaSelect.innerHTML = `<option value="">Seleccione una orden de venta...</option>`;
  data.forEach(ov => {
    const opt = document.createElement("option");
    opt.value = ov.id_orden;
    opt.textContent = `Orden: ${ov.id_orden} - Cantidad: ${ov.cantidad}`;
    ordenVentaSelect.appendChild(opt);
  });
}

// Cargar lotes de materia prima
async function cargarMateriasPrimas() {
  const { data, error } = await supabaseClient.from("lote_mp").select("*");
  if (error) return console.error("Error cargando lotes:", error.message);

  lotesMP = data;
  materiaSelect.innerHTML = `<option value="">Seleccione un lote...</option>`;
  data.forEach(lote => {
    const opt = document.createElement("option");
    opt.value = lote.id_lote;
    opt.textContent = `Lote: ${lote.id_lote} - Disponible: ${lote.cantidad_disponible}`;
    materiaSelect.appendChild(opt);
  });
}

// Agregar lote y controlar cantidades
function agregarMateria() {
  const loteId = materiaSelect.value;
  const lote = lotesMP.find(l => l.id_lote == loteId);
  const ordenId = ordenVentaSelect.value;
  const orden = ordenesVentas.find(o => o.id_orden == ordenId);

  if (!lote || !orden) return alert("Selecciona orden y lote");

  let cantidadNecesaria = orden.cantidad; // cantidad solicitada
  let cantidadDisponible = lote.cantidad_disponible;

  if (cantidadDisponible <= 0) return alert("Lote sin disponibilidad");

  // Determinar cuánto se va a tomar de este lote
  let cantidadTomada = Math.min(cantidadNecesaria, cantidadDisponible);

  // Agregar a lista temporal
  materias.push({ id_lote: lote.id_lote, texto: `${lote.id_lote} (tomado: ${cantidadTomada})`, cantidad: cantidadTomada });

  // Restar del lote disponible
  lote.cantidad_disponible -= cantidadTomada;

  // Mostrar en lista
  const li = document.createElement("li");
  li.textContent = `${lote.id_lote} - Tomado: ${cantidadTomada}`;
  materiasLista.appendChild(li);

  // Actualizar select visualmente
  cargarMateriasPrimas();

  console.log("Materia agregada:", lote.id_lote, "Cantidad tomada:", cantidadTomada);
}

// Guardar orden de producción
async function guardarOrden(e) {
  e.preventDefault();
  const lote = ordenLoteInput.value;
  const ordenVentaId = ordenVentaSelect.value;
  if (!ordenVentaId || materias.length === 0) return alert("Selecciona orden y al menos un lote");

  // Crear orden
  const { data: orden, error: errorOrden } = await supabaseClient
    .from("ordenes_produccion")
    .insert([{ lote, orden_venta_id: ordenVentaId, etapa: "Inicial", estado: "Pendiente" }])
    .select()
    .single();
  if (errorOrden) return console.error("Error:", errorOrden.message);

  // Insertar lotes usados
  const requerimientos = materias.map(m => ({ orden_id: orden.id, lote_mp_id: m.id_lote, cantidad_usada: m.cantidad }));
  const { error: errorMaterias } = await supabaseClient.from("ordenes_materias").insert(requerimientos);
  if (errorMaterias) return console.error("Error lotes:", errorMaterias.message);

  // Actualizar tabla
  await cargarOrdenesProduccion();

  // Reset
  contadorLote++;
  generarCodigoLote();
  ordenVentaSelect.value = "";
  materias = [];
  materiasLista.innerHTML = "";
}

// Cargar órdenes de producción
async function cargarOrdenesProduccion() {
  const { data, error } = await supabaseClient
    .from("ordenes_produccion")
    .select(`
      id, lote, etapa, estado, orden_venta_id,
      ordenes_materias(lote_mp(id_lote), cantidad_usada)
    `);
  if (error) return console.error("Error:", error.message);

  ordenBody.innerHTML = "";
  data.forEach(o => {
    const lotes = o.ordenes_materias.map(r => `Lote: ${r.lote_mp.id_lote} (Usado: ${r.cantidad_usada})`).join(", ");
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${o.lote}</td>
      <td>#${o.orden_venta_id}</td>
      <td>${lotes}</td>
      <td>${o.etapa}</td>
      <td>${o.estado}</td>
    `;
    ordenBody.appendChild(row);
  });
}

// Eventos
btnAgregarMateria.addEventListener("click", agregarMateria);
ordenForm.addEventListener("submit", guardarOrden);

// Inicio
generarCodigoLote();
cargarOrdenesVenta();
cargarMateriasPrimas();
cargarOrdenesProduccion();
