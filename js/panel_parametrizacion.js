// ---------------------- Configuración Supabase ----------------------
const SUPABASE_URL = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// -------------------------------------------------------------------

let productos = [];
let filaEditando = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarProductos();
  await cargarLineasProduccion();
});

// Cargar lista de productos
async function cargarProductos() {
  const { data, error } = await supabase.from("productos").select("id_producto, nombre");
  if (error) console.error("Error cargando productos:", error);
  productos = data ?? [];
}

// Cargar líneas de producción
async function cargarLineasProduccion() {
  const { data, error } = await supabase.from("linea_produccion").select("*");
  if (error) {
    console.error("Error cargando líneas de producción:", error);
    return;
  }

  const tbody = document.querySelector("#tabla-parametros tbody");
  tbody.innerHTML = "";

  data.forEach((l) => {
    const prod = productos.find((p) => Number(p.id_producto) === Number(l.id_producto));
    const nombreProd = prod ? prod.nombre : "—";

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${l.id_linea ?? ""}</td>
      <td>${nombreProd}</td>
      <td>${l.duracion ?? ""}</td>
      <td>${l.horas_jornada ?? ""}</td>
      <td>${l.eficiencia ?? 0}%</td>
      <td>${l.capacidad_diaria ?? 0}</td>
      <td>${l.estado ?? ""}</td>
      <td><button class="btn-editar"><i class="fas fa-edit"></i></button></td>
    `;

    fila.querySelector(".btn-editar").addEventListener("click", () => editarFila(l));
    tbody.appendChild(fila);
  });
}

// Editar una fila
function editarFila(datos) {
  const form = document.getElementById("form-parametros");

  form.id_linea.value = datos.id_linea ?? "";
  form.id_producto.value = datos.id_producto ?? "";
  form.duracion.value = datos.duracion ?? "";
  form.horas_jornada.value = datos.horas_jornada ?? "";
  form.eficiencia.value = datos.eficiencia ?? "";
  form.capacidad_diaria.value = datos.capacidad_diaria ?? "";
  form.estado.value = datos.estado ?? "Activa";

  filaEditando = datos.id;
  form.querySelector(".btn-guardar").innerHTML = `<i class="fas fa-check"></i> Guardar cambios`;
}

// Recalcular capacidad diaria automáticamente
["duracion", "horas_jornada", "eficiencia"].forEach((id) => {
  document.getElementById(id).addEventListener("input", calcularCapacidad);
});

function calcularCapacidad() {
  const duracion = parseFloat(document.getElementById("duracion").value) || 0;
  const horas = parseFloat(document.getElementById("horas_jornada").value) || 0;
  const eficiencia = parseFloat(document.getElementById("eficiencia").value) || 0;

  // Fórmula: (horas * 60 / duración) * eficiencia%
  const capacidad = ((horas * 60) / (duracion || 1)) * (eficiencia / 100);
  document.getElementById("capacidad_diaria").value = capacidad.toFixed(2);
}

// Guardar cambios
document.getElementById("form-parametros").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const datos = Object.fromEntries(new FormData(form));

  const payload = {
    id_linea: Number(datos.id_linea),
    id_producto: Number(datos.id_producto),
    duracion: Number(datos.duracion),
    horas_jornada: Number(datos.horas_jornada),
    eficiencia: Number(datos.eficiencia),
    capacidad_diaria: Number(datos.capacidad_diaria),
    estado: datos.estado,
  };

  let error;
  if (filaEditando) {
    ({ error } = await supabase.from("linea_produccion").update(payload).eq("id", filaEditando));
  } else {
    ({ error } = await supabase.from("linea_produccion").insert([payload]));
  }

  if (error) {
    console.error("Error al guardar:", error);
    alert("Error al guardar los datos.");
    return;
  }

  alert(filaEditando ? "Datos actualizados correctamente" : "Línea agregada correctamente");
  form.reset();
  filaEditando = null;
  form.querySelector(".btn-guardar").innerHTML = `<i class="fas fa-save"></i> Guardar parámetros`;
  await cargarLineasProduccion();
});
