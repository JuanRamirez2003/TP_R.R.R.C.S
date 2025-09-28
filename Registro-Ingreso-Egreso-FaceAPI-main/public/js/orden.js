console.log("Iniciando aplicación...");

// ===== CONFIGURAR SUPABASE =====
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ===== ELEMENTOS DEL DOM =====
const ordenLoteInput = document.getElementById("ordenLote");
const ordenVentaSelect = document.getElementById("ordenVentaSelect");
const materiaSelect = document.getElementById("materiaSelect");
const materiasLista = document.getElementById("materiasLista");
const ordenForm = document.getElementById("formCrearOrden");
const ordenBody = document.getElementById("ordenBody");

// ===== VARIABLES =====
let materias = []; 
let contadorLote = 1;

// ===== FUNCIONES =====
function generarCodigoLote() {
  const fecha = new Date();
  const yyyymmdd = fecha.toISOString().slice(0, 10).replace(/-/g, "");
  const codigo = `LOTE-${yyyymmdd}-${String(contadorLote).padStart(3, "0")}`;
  ordenLoteInput.value = codigo;
  console.log("Código de lote generado:", codigo);
}

async function cargarOrdenesVenta() {
  console.log("Cargando órdenes de venta...");
  const { data, error } = await supabaseClient.from("ordenes_venta").select("id, cliente");
  if (error) {
    console.error("Error cargando órdenes de venta:", error.message);
    return;
  }
  ordenVentaSelect.innerHTML = `<option value="">Seleccione una orden de venta...</option>`;
  data.forEach(ov => {
    const opt = document.createElement("option");
    opt.value = ov.id;
    opt.textContent = `#${ov.id} - ${ov.cliente}`;
    ordenVentaSelect.appendChild(opt);
  });
  console.log("Órdenes de venta cargadas:", data.length);
}

async function cargarMateriasPrimas() {
  console.log("Cargando materias primas...");
  const { data, error } = await supabaseClient.from("materias_primas").select("id, nombre");
  if (error) {
    console.error("Error cargando materias primas:", error.message);
    return;
  }
  materiaSelect.innerHTML = `<option value="">Seleccione materia prima...</option>`;
  data.forEach(mp => {
    const opt = document.createElement("option");
    opt.value = mp.id;
    opt.textContent = mp.nombre;
    materiaSelect.appendChild(opt);
  });
  console.log("Materias primas cargadas:", data.length);
}

function agregarMateria() {
  const materiaId = materiaSelect.value;
  const materiaNombre = materiaSelect.options[materiaSelect.selectedIndex]?.text;
  if (!materiaId) return;

  materias.push({ materia_id: materiaId, nombre: materiaNombre });

  const li = document.createElement("li");
  li.textContent = materiaNombre;
  materiasLista.appendChild(li);

  materiaSelect.value = "";
  console.log("Materia agregada:", materiaNombre);
}

async function guardarOrden(e) {
  e.preventDefault();

  const lote = ordenLoteInput.value;
  const ordenVentaId = ordenVentaSelect.value;

  if (!ordenVentaId || materias.length === 0) {
    alert("Debe seleccionar una orden de venta y al menos una materia prima.");
    return;
  }

  console.log("Guardando orden...");
  const { data: orden, error: errorOrden } = await supabaseClient
    .from("ordenes_produccion")
    .insert([{ lote, orden_venta_id: ordenVentaId, etapa: "Inicial", estado: "Pendiente" }])
    .select()
    .single();

  if (errorOrden) {
    console.error("Error creando orden:", errorOrden.message);
    return;
  }

  const requerimientos = materias.map(m => ({
    orden_id: orden.id,
    materia_id: m.materia_id
  }));

  const { error: errorMaterias } = await supabaseClient.from("ordenes_materias").insert(requerimientos);
  if (errorMaterias) {
    console.error("Error agregando materias:", errorMaterias.message);
  }

  console.log("Orden creada con éxito:", orden);
  await cargarOrdenesProduccion();

  contadorLote++;
  generarCodigoLote();
  ordenVentaSelect.value = "";
  materias = [];
  materiasLista.innerHTML = "";
}

async function cargarOrdenesProduccion() {
  console.log("Cargando órdenes de producción...");
  const { data, error } = await supabaseClient
    .from("ordenes_produccion")
    .select("id, lote, etapa, estado, orden_venta_id, ordenes_materias(cantidad, materias_primas(nombre))");

  if (error) {
    console.error("Error cargando órdenes:", error.message);
    return;
  }

  ordenBody.innerHTML = "";
  data.forEach(o => {
    const requerimientos = o.ordenes_materias
      .map(r => `${r.materias_primas.nombre}`)
      .join(", ");

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${o.lote}</td>
      <td>#${o.orden_venta_id}</td>
      <td>${requerimientos}</td>
      <td>${o.etapa}</td>
      <td>${o.estado}</td>
    `;
    ordenBody.appendChild(row);
  });
  console.log("Órdenes de producción cargadas:", data.length);
}

// ===== EVENTOS =====
materiaSelect.addEventListener("change", agregarMateria);
ordenForm.addEventListener("submit", guardarOrden);

// ===== INICIO =====
generarCodigoLote();
cargarOrdenesVenta();
cargarMateriasPrimas();
cargarOrdenesProduccion();