const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let idEliminar = null;
let lineaSeleccionada = null;

document.addEventListener("DOMContentLoaded", () => {
  cargarLineas();

  document.getElementById("btnAgregar").addEventListener("click", abrirModalAgregar);
  document.getElementById("buscador").addEventListener("input", filtrarLineas);
  document.getElementById("formAgregar").addEventListener("submit", guardarLinea);
  document.getElementById("cancelarModal").addEventListener("click", cerrarModalAgregar);
  document.getElementById("formEditar").addEventListener("submit", actualizarLinea);
  document.getElementById("cancelarEditar").addEventListener("click", cerrarModalEditar);
  document.getElementById("confirmarEliminar").addEventListener("click", eliminarLineaConfirmado);
  document.getElementById("cancelarEliminar").addEventListener("click", cerrarModalEliminar);

  // Productos
  document.getElementById("cerrarProductos").addEventListener("click", cerrarModalProductos);
  document.getElementById("btnAgregarProducto").addEventListener("click", abrirModalAgregarProducto);
  document.getElementById("cancelarGestionProducto").addEventListener("click", cerrarModalGestionProducto);
  document.getElementById("formGestionProducto").addEventListener("submit", guardarProducto);
});

async function cargarLineas() {
  try {
    const { data: lineas, error } = await supabaseClient
      .from("linea_productos")
      .select("*")
      .order("id_linea", { ascending: true });

    if (error) throw error;

    const tbody = document.querySelector("#tablaLineas tbody");
    tbody.innerHTML = "";

    for (const linea of lineas) {
      const { data: productos, error: prodError } = await supabaseClient
        .from("productos")
        .select("id_producto, nombre")
        .eq("id_linea", linea.id_linea);

      if (prodError) console.warn(prodError);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${linea.id_linea}</td>
        <td>${linea.codigo_linea || ""}</td>
        <td>${linea.descripcion || ""}</td>
        <td>${linea.capacidad_teorica ?? "-"}</td>
        <td class="${linea.estado === "Baja" ? "baja" : "activa"}">${linea.estado}</td>
        <td>
          <button class="btn-editar" onclick="abrirModalEditar(${linea.id_linea})">Editar</button>
          <button class="btn-eliminar" onclick="abrirModalEliminar(${linea.id_linea})">Eliminar</button>
          <button class="btn-ver" onclick="verProductosLinea(${linea.id_linea}, '${linea.descripcion}')">Ver Detalle</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error(err);
    alert("❌ Error al cargar líneas.");
  }
}

/* === AGREGAR LÍNEA === */
function abrirModalAgregar() {
  document.getElementById("modalAgregar").style.display = "flex";
}
function cerrarModalAgregar() {
  document.getElementById("modalAgregar").style.display = "none";
  document.getElementById("formAgregar").reset();
}

async function guardarLinea(e) {
  e.preventDefault();
  const codigo = document.getElementById("codigoLinea").value.trim();
  const descripcion = document.getElementById("descripcionLinea").value.trim();
  const capacidad = parseFloat(document.getElementById("capacidadLinea").value);

  if (!codigo || !descripcion || isNaN(capacidad))
    return alert("⚠️ Complete los campos correctamente.");

  const { error } = await supabaseClient
    .from("linea_productos")
    .insert([{ codigo_linea: codigo, descripcion, capacidad_teorica: capacidad, estado: "Activa" }]);

  if (error) return alert("❌ Error al agregar línea.");
  alert("✅ Línea agregada.");
  cerrarModalAgregar();
  cargarLineas();
}

/* === EDITAR LÍNEA === */
async function abrirModalEditar(id) {
  const { data, error } = await supabaseClient.from("linea_productos").select("*").eq("id_linea", id).single();
  if (error) return alert("❌ No se pudo cargar la línea.");

  document.getElementById("editarIdLinea").value = data.id_linea;
  document.getElementById("editarCodigo").value = data.codigo_linea;
  document.getElementById("editarDescripcion").value = data.descripcion;
  document.getElementById("editarCapacidad").value = data.capacidad_teorica;
  document.getElementById("editarEstado").value = data.estado;
  document.getElementById("modalEditar").style.display = "flex";
}
function cerrarModalEditar() {
  document.getElementById("modalEditar").style.display = "none";
}

async function actualizarLinea(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById("editarIdLinea").value);
  const codigo = document.getElementById("editarCodigo").value.trim();
  const descripcion = document.getElementById("editarDescripcion").value.trim();
  const capacidad = parseFloat(document.getElementById("editarCapacidad").value);
  const estado = document.getElementById("editarEstado").value;

  const { error } = await supabaseClient
    .from("linea_productos")
    .update({ codigo_linea: codigo, descripcion, capacidad_teorica: capacidad, estado })
    .eq("id_linea", id);

  if (error) return alert("❌ Error al actualizar línea.");
  alert("✅ Línea actualizada.");
  cerrarModalEditar();
  cargarLineas();
}

/* === ELIMINAR LÍNEA === */
function abrirModalEliminar(id) {
  idEliminar = id;
  document.getElementById("modalConfirmar").style.display = "flex";
}
function cerrarModalEliminar() {
  idEliminar = null;
  document.getElementById("modalConfirmar").style.display = "none";
}
async function eliminarLineaConfirmado() {
  if (!idEliminar) return;
  const { error } = await supabaseClient.from("linea_productos").delete().eq("id_linea", idEliminar);
  if (error) return alert("❌ Error al eliminar línea.");
  alert("❌ Línea eliminada.");
  cerrarModalEliminar();
  cargarLineas();
}

/* === BUSCADOR === */
function filtrarLineas() {
  const filtro = document.getElementById("buscador").value.toLowerCase();
  document.querySelectorAll("#tablaLineas tbody tr").forEach(fila => {
    fila.style.display = fila.innerText.toLowerCase().includes(filtro) ? "" : "none";
  });
}

/* === PRODUCTOS POR LÍNEA === */
async function verProductosLinea(idLinea, descripcion) {
  lineaSeleccionada = idLinea;
  descripcionLineaSeleccionada = descripcion;
  document.getElementById("modalProductos").style.display = "flex";
  document.getElementById("idLineaProducto").value = idLinea;

  // 🔹 Obtener también el código de la línea desde Supabase
  const { data: lineaData, error: lineaError } = await supabaseClient
    .from("linea_productos")
    .select("codigo_linea")
    .eq("id_linea", idLinea)
    .single();

  if (lineaError) {
    console.warn("No se pudo obtener código de línea");
    document.getElementById("tituloLinea").innerText = `Línea: ${descripcion}`;
  } else {
    document.getElementById("tituloLinea").innerText = `Línea ${lineaData.codigo_linea}`;
  }

  const tbody = document.querySelector("#tablaProductosLinea tbody");
  tbody.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";

  const { data: productos, error } = await supabaseClient
    .from("productos")
    .select("*")
    .eq("id_linea", idLinea)
    .order("id_producto");

  if (error) return alert("❌ Error al cargar productos.");
  if (!productos.length) return (tbody.innerHTML = "<tr><td colspan='5'>No hay productos.</td></tr>");

  tbody.innerHTML = productos
    .map(p => `
      <tr>
        <td>${p.id_producto}</td>
        <td>${p.nombre}</td>
        <td>$${p.precio_unitario?.toFixed(2) ?? "0.00"}</td>
        <td>${p.stock ?? 0}</td>
        <td>
          <button class="btn-editar" onclick="editarProducto(${p.id_producto})">Editar</button>
          <button class="btn-eliminar" onclick="eliminarProducto(${p.id_producto})">Eliminar</button>
        </td>
      </tr>
    `).join("");
}


function cerrarModalProductos() {
  document.getElementById("modalProductos").style.display = "none";
}

/* === AGREGAR PRODUCTO === */
function abrirModalAgregarProducto() {
  document.getElementById("tituloModalProducto").innerText = "➕ Nuevo Producto";
  document.getElementById("formGestionProducto").reset();
  document.getElementById("idProductoEditar").value = "";
  document.getElementById("modalGestionProducto").style.display = "flex";
}

async function guardarProducto(e) {
  e.preventDefault();
  const idEditar = document.getElementById("idProductoEditar").value;
  const idLinea = parseInt(document.getElementById("idLineaProducto").value);
  const nombre = document.getElementById("nombreProducto").value.trim();
  const precio = parseFloat(document.getElementById("precioProducto").value);
  const stock = parseInt(document.getElementById("stockProducto").value);
  const estado = document.getElementById("estadoProducto").value;

  if (!nombre || isNaN(precio) || isNaN(stock))
    return alert("⚠️ Complete todos los campos correctamente.");

  if (idEditar) {
    await supabaseClient.from("productos").update({ nombre, precio_unitario: precio, stock, estado }).eq("id_producto", idEditar);
    alert("✅ Producto actualizado.");
  } else {
    await supabaseClient.from("productos").insert([{ nombre, precio_unitario: precio, stock, estado, id_linea: idLinea }]);
    alert("✅ Producto agregado.");
  }

  cerrarModalGestionProducto();
  verProductosLinea(idLinea, descripcionLineaSeleccionada); // ← Corrección
}

async function editarProducto(idProducto) {
  const { data, error } = await supabaseClient.from("productos").select("*").eq("id_producto", idProducto).single();
  if (error) return alert("❌ No se pudo cargar producto.");

  document.getElementById("idProductoEditar").value = data.id_producto;
  document.getElementById("nombreProducto").value = data.nombre;
  document.getElementById("precioProducto").value = data.precio_unitario;
  document.getElementById("stockProducto").value = data.stock;
  document.getElementById("estadoProducto").value = data.estado;
  document.getElementById("tituloModalProducto").innerText = "✏️ Editar Producto";
  document.getElementById("modalGestionProducto").style.display = "flex";
}

async function eliminarProducto(idProducto) {
  if (!confirm("⚠️ ¿Eliminar producto?")) return;
  await supabaseClient.from("productos").delete().eq("id_producto", idProducto);
  alert("❌ Producto eliminado.");
  verProductosLinea(lineaSeleccionada, document.getElementById("tituloLinea").innerText);
}

function cerrarModalGestionProducto() {
  document.getElementById("modalGestionProducto").style.display = "none";
}
