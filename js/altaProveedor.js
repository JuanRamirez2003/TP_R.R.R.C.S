// ===================== FUNCIONES GENERALES =====================
function mostrarSeccion(seccionId) {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
  document.getElementById(seccionId).style.display = 'block';

  if (seccionId === 'proveedor') {

    const mensaje = document.getElementById('mensajeExitoOP');
    if (mensaje) mensaje.style.display = 'none';

    document.getElementById('formProveedor').style.display = 'none';
    document.getElementById('mensajeExitoProveedor').style.display = 'none';
    document.getElementById('tablaProveedorContainer').style.display = 'block';
    listarProveedores();
  }

  if (seccionId === 'ordenes') {
    document.getElementById('formOrden').style.display = 'none';
    document.getElementById('mensajeExitoOrden').style.display = 'none';
    document.getElementById('tablaOrdenesContainer').style.display = 'block';
    listarOrdenes();
  }
}

function volverPanel() {
  document.getElementById("mensajeExitoProveedor").style.display = "none";
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== PROVEEDORES =====================
function mostrarFormularioProveedor() {
  document.getElementById('formProveedor').style.display = 'block';
  document.getElementById('proveedorForm').reset();
  document.getElementById('mensajeExitoProveedor').style.display = 'none';
  document.getElementById('tablaProveedorContainer').style.display = 'none';
}

function cancelarProveedor() {
  document.getElementById('tablaProveedorContainer').style.display = 'block';
  document.getElementById('formProveedor').style.display = 'none';
}

async function listarProveedores() {
  try {
    const { data, error } = await supabaseClient.from('proveedor').select('*').order('dni_cuil');
    if (error) throw error;

    const tbody = document.querySelector('#tablaProveedor tbody');
    tbody.innerHTML = '';

    data.forEach(proveedor => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${proveedor.dni_cuil}</td>
        <td>${proveedor.nombre}</td>
        <td>${proveedor.tipo_proveedor}</td>
        <td>${proveedor.email}</td>
        <td>${proveedor.telefono}</td>
        <td>${proveedor.pref_cont}</td>
        <td>${proveedor.direccion}</td>
        <td>${proveedor.estado}</td>
        <td>${proveedor.alta_id_emp || '-'}</td>
        <td>
          <button class="btn-editar" onclick="editarProveedor('${proveedor.dni_cuil}')">Editar</button>
          <button class="btn-eliminar" onclick="bajaProveedor('${proveedor.dni_cuil}')">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error listando proveedores:', err);
  }
}

// ================== VALIDACIONES ==================
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarTelefono(telefono) {
  return /^[0-9]{10}$/.test(telefono);
}

function validarCUIT(cuit, tipo) {
  if (!/^[0-9]{11}$/.test(cuit)) return false;
  const prefix = cuit.slice(0, 2);

  if (tipo === 'responsable inscripto') {
    return prefix === '30' || prefix === '33';
  } else if (tipo === 'monotributista') {
    return prefix === '20' || prefix === '23' || prefix === '27';
  }
  return false;
}

function mostrarError(mensaje) {
  const div = document.getElementById('mensajeError');
  if (!div) return alert(mensaje);
  div.innerText = mensaje;
  div.style.display = 'block';
  setTimeout(() => div.style.display = 'none', 4000);
}

// ================== INPUTS Y VALIDACIONES DINÁMICAS ==================
const tipoProveedorSelect = document.getElementById("tipoProveedor");
const documentoLabel = document.getElementById("labelDocumento");
const documentoInput = document.getElementById("documento");

// CUIT/DNI: solo números, máximo 11
documentoInput.addEventListener("input", () => {
  documentoInput.value = documentoInput.value.replace(/\D/g, '');
  if (documentoInput.value.length > 11) documentoInput.value = documentoInput.value.slice(0, 11);
});

tipoProveedorSelect.addEventListener("change", () => {
  if (tipoProveedorSelect.value === "monotributista") {
    documentoLabel.innerText = "CUIT (Monotributista):";
    documentoInput.placeholder = "Ej: 20XXXXXXXXX";
    documentoInput.value = "";
  } else if (tipoProveedorSelect.value === "responsable inscripto") {
    documentoLabel.innerText = "CUIT (Responsable Inscripto):";
    documentoInput.placeholder = "Ej: 30XXXXXXXXX";
    documentoInput.value = "";
  } else {
    documentoLabel.innerText = "Documento:";
    documentoInput.placeholder = "Seleccione tipo primero";
    documentoInput.value = "";
  }
});

// Teléfono: solo números, máximo 10 dígitos
const telefonoInput = document.getElementById("telefono");
telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, '');
  if (telefonoInput.value.length > 10) telefonoInput.value = telefonoInput.value.slice(0, 10);
});

// ================== AUTOCOMPLETADO Y NORMALIZACIÓN DE DIRECCIONES (OSM) ==================
let direccionesValidas = [];

function inicializarNormalizacionDireccion() {
  const input = document.getElementById("direccion");

  // Contenedor de sugerencias
  const contenedor = document.createElement("ul");
  contenedor.id = "listaDirecciones";
  contenedor.style.position = "absolute";
  contenedor.style.top = input.offsetHeight + 4 + "px";
  contenedor.style.left = "0";
  contenedor.style.width = "100%";
  contenedor.style.maxHeight = "180px";
  contenedor.style.overflowY = "auto";
  contenedor.style.background = "#fff";
  contenedor.style.border = "1px solid #ccc";
  contenedor.style.borderRadius = "6px";
  contenedor.style.padding = "0";
  contenedor.style.margin = "0";
  contenedor.style.listStyle = "none";
  contenedor.style.zIndex = "1000";
  contenedor.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";

  input.parentNode.style.position = "relative";
  input.parentNode.appendChild(contenedor);

  let timeout;

  input.addEventListener("input", () => {
    const query = input.value.trim();
    contenedor.innerHTML = "";
    if (query.length < 3) return;

    clearTimeout(timeout);
    timeout = setTimeout(() => buscarDireccionOSM(query, contenedor, input), 500);
  });

  // Cerrar lista al perder foco
  input.addEventListener("blur", () => {
    setTimeout(() => contenedor.innerHTML = "", 150);
  });
}

async function buscarDireccionOSM(query, contenedor, input) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&countrycodes=ar&limit=5`;

  try {
    const response = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await response.json();

    direccionesValidas = data;

    if (!data || data.length === 0) {
      contenedor.innerHTML = `<li style="padding:8px;">Sin resultados</li>`;
      return;
    }

    data.forEach(item => {
      const li = document.createElement("li");
      li.style.padding = "8px";
      li.style.cursor = "pointer";
      li.style.borderBottom = "1px solid #eee";
      li.style.fontSize = "14px";
      li.textContent = item.display_name;

      li.addEventListener("mouseover", () => li.style.background = "#f0f0f0");
      li.addEventListener("mouseout", () => li.style.background = "#fff");

      li.addEventListener("click", () => {
        input.value = item.display_name;
        contenedor.innerHTML = "";
      });

      contenedor.appendChild(li);
    });
  } catch (err) {
    console.error("Error al buscar direcciones OSM:", err);
  }
}

function direccionEsValida(direccion) {
  return direccionesValidas.some(item => direccion.includes(item.display_name));
}

// Inicializar al cargar
document.addEventListener("DOMContentLoaded", inicializarNormalizacionDireccion);

// ================== SUBMIT FORM ==================
document.getElementById("proveedorForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  const id_proveedor = document.getElementById("id_proveedor").value;
  const nombre = document.getElementById("nombre").value.trim();
  const tipo_proveedor = document.getElementById("tipoProveedor").value;
  const dni_cuil = document.getElementById("documento").value.trim();
  const pref_cont = document.getElementById("preferenciaContacto").value;
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const estado = document.getElementById("estado").value;

  if (!nombre) return mostrarError("El nombre es obligatorio");
  if (!tipo_proveedor) return mostrarError("Debe seleccionar el tipo de proveedor");
  if (!validarCUIT(dni_cuil, tipo_proveedor)) return mostrarError("CUIT inválido según tipo de proveedor");
  if (!pref_cont) return mostrarError("Debe seleccionar la preferencia de contacto");
  if (!validarEmail(email)) return mostrarError("El email no tiene un formato válido");
  if (!validarTelefono(telefono)) return mostrarError("El teléfono debe tener 10 números");
  if (!direccionEsValida(direccion)) return mostrarError("Debe seleccionar una dirección válida de la lista");

  try {
    const { data: existente } = await supabaseClient
      .from('proveedor')
      .select('id_proveedor')
      .eq('dni_cuil', dni_cuil)
      .maybeSingle();

    if (existente && Number(id_proveedor) !== existente.id_proveedor) {
      throw new Error("Ya existe un proveedor con ese CUIT/DNI");
    }

    const nuevoProveedor = {
      nombre,
      tipo_proveedor,
      dni_cuil,
      pref_cont,
      email,
      telefono,
      direccion,
      estado
    };

    if (id_proveedor) {
      const { error } = await supabaseClient
        .from("proveedor")
        .update(nuevoProveedor)
        .eq('id_proveedor', id_proveedor);
      if (error) throw error;
      document.getElementById("textoExitoProveedor").innerText = "Proveedor actualizado con éxito";
    } else {
      const { error } = await supabaseClient
        .from("proveedor")
        .insert([nuevoProveedor]);
      if (error) throw error;
      document.getElementById("textoExitoProveedor").innerText = "Proveedor creado con éxito";
    }

    document.getElementById("formProveedor").style.display = "none";
    document.getElementById("mensajeExitoProveedor").style.display = "block";
    listarProveedores();

  } catch (err) {
    console.error("Error:", err);
    mostrarError(err.message || "Error al procesar el proveedor");
  }
});

// ================== EDITAR / BAJA ==================
async function editarProveedor(dni) {
  try {
    const { data, error } = await supabaseClient.from('proveedor').select('*').eq('dni_cuil', dni).single();
    if (error) throw error;

    tipoProveedorSelect.value = data.tipo_proveedor;
    documentoInput.value = data.dni_cuil;
    document.getElementById('nombre').value = data.nombre;
    document.getElementById('direccion').value = data.direccion;
    document.getElementById('email').value = data.email;
    document.getElementById('telefono').value = data.telefono;
    document.getElementById('preferenciaContacto').value = data.pref_cont;
    document.getElementById('estado').value = data.estado;
    document.getElementById('id_proveedor').value = data.id_proveedor;

    document.getElementById('formProveedor').style.display = 'block';
    document.getElementById('tablaProveedorContainer').style.display = 'none';
  } catch (err) {
    console.error(err);
    mostrarError('Error al cargar datos del proveedor');
  }
}

async function bajaProveedor(dni) {
  if (!confirm('¿Desea dar de baja este proveedor?')) return;
  try {
    const { error } = await supabaseClient.from('proveedor')
      .update({ estado: 'inactivo' })
      .eq('dni_cuil', dni);
    if (error) throw error;
    listarProveedores();
  } catch (err) {
    console.error(err);
    mostrarError('Error al dar de baja el proveedor');
  }
}
