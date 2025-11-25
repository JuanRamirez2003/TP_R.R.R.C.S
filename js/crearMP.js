// ==================== INICIALIZAR SUPABASE ====================
const supabaseClient = supabase.createClient(
  "https://ldgrlfnmuvvaqsezjsvj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo"
);

// ==================== REFERENCIAS DOM ====================
const formMp = document.getElementById("formMp");
const proveedorSelect = document.getElementById("id_proveedor");
const proveedorSecSelect = document.getElementById("id_proveedorsec");
const tablaMateriales = document.getElementById("tbodyMateriales");
const buscarInput = document.getElementById("buscarMaterial");
const mensaje = document.getElementById("mensaje");
const modal = document.getElementById("modalForm");
const btnAbrirModal = document.getElementById("btnAbrirModal");
const btnCerrarModal = document.getElementById("btnCerrarModal");

// Cache de proveedores para mostrar nombres
let proveedoresCache = {};

// ==================== ABRIR / CERRAR MODAL ====================
btnAbrirModal.addEventListener("click", () => {
  formMp.reset();
  delete formMp.dataset.editId;
  modal.style.display = "flex";
});

btnCerrarModal.addEventListener("click", () => modal.style.display = "none");

window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ==================== CARGAR DATOS INICIALES ====================
document.addEventListener("DOMContentLoaded", async () => {
  await cargarProveedores();
  cargarMateriales();
});

// ==================== CARGAR PROVEEDORES ====================
async function cargarProveedores() {
  const { data, error } = await supabaseClient
    .from("proveedor")
    .select("id_proveedor, nombre");

  if (error) return console.error("Error cargando proveedores:", error.message);

  proveedorSelect.innerHTML = `<option value="">Seleccione...</option>`;
  proveedorSecSelect.innerHTML = `<option value="">-- Ninguno --</option>`;

  data.forEach((prov) => {
    proveedorSelect.innerHTML += `<option value="${prov.id_proveedor}">${prov.nombre}</option>`;
    proveedorSecSelect.innerHTML += `<option value="${prov.id_proveedor}">${prov.nombre}</option>`;
    proveedoresCache[prov.id_proveedor] = prov.nombre;
  });
}

// ==================== EVITAR PROVEEDOR REPETIDO ====================
proveedorSelect.addEventListener("change", () => {
  [...proveedorSecSelect.options].forEach(opt => {
    opt.hidden = opt.value === proveedorSelect.value;
  });
});

// ==================== VALIDACIONES ====================
function validarFormulario() {
  if (!nombre.value.trim()) return mostrarError("Nombre es obligatorio", nombre);
  if (!unidad.value.trim()) return mostrarError("Unidad es obligatoria", unidad);
  if (!tipo.value.trim()) return mostrarError("Tipo es obligatorio", tipo);
  if (!proveedorSelect.value) return mostrarError("Proveedor principal es obligatorio", proveedorSelect);
  return true;
}

function mostrarError(texto, campo) {
  Swal.fire({
    icon: "error",
    title: "Error",
    text: texto,
    confirmButtonColor: "#dc3545",
    background: "#1e1e1e",
    color: "#e0e0e0"
  }).then(() => {
    if (campo) campo.focus();
  });
}


// ==================== GUARDAR / EDITAR MATERIAL ====================
formMp.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validarFormulario()) return;

  Swal.fire({
    title: "Guardando...",
    text: "Procesando la información",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
    background: "#1e1e1e",
    color: "#e0e0e0"
  });

  const material = {
    nombre: nombre.value.trim(),
    descr: descr.value.trim(),
    unidad: unidad.value,
    Tipo: tipo.value,
    id_proveedor: proveedorSelect.value,
    id_proveedorsec: proveedorSecSelect.value || null,
    stock_disponible: 0,
    stock_reservado: 0,
    stock_total: 0,
    stock_minimo: 0
  };

  try {
    if (formMp.dataset.editId) {
      await supabaseClient.from("materiales").update(material).eq("id_mp", formMp.dataset.editId);
      delete formMp.dataset.editId;

      Swal.fire({
        icon: "success",
        title: "Actualizado",
        text: "El material fue actualizado correctamente",
        timer: 2000,
        showConfirmButton: false,
        background: "#1e1e1e",
        color: "#e0e0e0"
      });

    } else {
      await supabaseClient.from("materiales").insert([material]);

      Swal.fire({
        icon: "success",
        title: "Guardado",
        text: "El material fue guardado correctamente",
        timer: 2000,
        showConfirmButton: false,
        background: "#1e1e1e",
        color: "#e0e0e0"
      });
    }

    modal.style.display = "none";
    formMp.reset();
    cargarMateriales();

  } catch (err) {
    mostrarError("Error: " + err.message);
  }
});


// ==================== CARGAR MATERIALES ====================
async function cargarMateriales() {
  const { data, error } = await supabaseClient
    .from("materiales")
    .select("*");

  if (error) return console.error("Error cargando materiales:", error.message);

  mostrarMateriales(data);
}

// ==================== MOSTRAR MATERIALES ====================
function mostrarMateriales(materiales) {
  tablaMateriales.innerHTML = materiales.map(mat => `
    <tr data-id="${mat.id}">
      <td>${mat.nombre || "-"}</td>
      <td>${mat.descr || "-"}</td>
      <td>${mat.unidad || "-"}</td>
      <td>${mat.Tipo || "-"}</td>
      <td>${mat.stock_total ?? 0}</td>
      <td>${mat.stock_minimo ?? 0}</td>
      <td>${proveedoresCache[mat.id_proveedor] || mat.id_proveedor || "-"}</td>
      <td>${proveedoresCache[mat.id_proveedorsec] || mat.id_proveedorsec || "-"}</td>
      <td>
        <button class="btn-edit" onclick="editarMaterial(${mat.id_mp})">Editar</button>
        <button class="btn-delete" onclick="eliminarMaterial(${mat.id_mp}, '${mat.nombre}')">Eliminar</button>
      </td>
    </tr>
  `).join("");
}

// ==================== EDITAR / ELIMINAR ====================
window.editarMaterial = async function(id) {
  const { data, error } = await supabaseClient.from("materiales").select("*").eq("id_mp", id).single();
  if (error) {
    return Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo cargar el material",
      confirmButtonColor: "#dc3545",
      background: "#1e1e1e",
      color: "#e0e0e0"
    });
  }

  modal.style.display = "flex";
  nombre.value = data.nombre;
  descr.value = data.descr || "";
  unidad.value = data.unidad || "";
  tipo.value = data.Tipo || "";
  proveedorSelect.value = data.id_proveedor || "";
  proveedorSecSelect.value = data.id_proveedorsec || "";
  formMp.dataset.editId = id;
};


window.eliminarMaterial = async function (id, nombre) {
  const resultado = await Swal.fire({
    title: `¿Eliminar "${nombre}"?`,
    text: "Esta acción no se puede deshacer.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    reverseButtons: true,
    confirmButtonColor: "#28a745", // Verde
    cancelButtonColor: "#dc3545", // Rojo
    background: "#1e1e1e",
    color: "#e0e0e0"
  });
    if (!resultado.isConfirmed) return;

  const { error } = await supabaseClient.from("materiales").delete().eq("id_mp", id);

  if (error) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message,
      confirmButtonColor: "#dc3545",
      background: "#1e1e1e",
      color: "#e0e0e0"
    });
    return;
  }

  Swal.fire({
    icon: "success",
    title: "Eliminado",
    text: `"${nombre}" fue eliminado correctamente.`,
    timer: 2000,
    showConfirmButton: false,
    background: "#1e1e1e",
    color: "#e0e0e0"
  });

  cargarMateriales();
};

// ==================== BUSCADOR ====================
buscarInput.addEventListener("input", function () {
  const filtro = this.value.toLowerCase();
  [...tablaMateriales.getElementsByTagName("tr")].forEach(fila => {
    fila.style.display = fila.textContent.toLowerCase().includes(filtro) ? "" : "none";
  });
});

