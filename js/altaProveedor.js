// ===================== FUNCIONES GENERALES =====================
// Mostrar una sección y ocultar las demás
function mostrarSeccion(seccionId) {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
  document.getElementById(seccionId).style.display = 'block';

  if (seccionId === 'proveedor') {
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

// Volver al panel principal
function volverPanel() {
  document.getElementById("mensajeExitoProveedor").style.display = "none";
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== PROVEEDORES =====================

// Mostrar formulario nuevo PROVEEDOR
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

// Listar proveedores en tabla
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
        <td>${proveedor.alta_id_emp}</td>
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

// Validar email
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Validar teléfono: solo números, 10 dígitos
function validarTelefono(telefono) {
  return /^[0-9]{10}$/.test(telefono);
}

// Validar CUIT según tipo de proveedor
function validarCUIT(cuit, tipo) {
  // Solo números
  if (!/^[0-9]{11}$/.test(cuit)) return false;

  const prefix = cuit.slice(0, 2);

  if (tipo === 'responsable inscripto') {
    return prefix === '30' || prefix === '33';
  } else if (tipo === 'monotributista') {
    return prefix === '20' || prefix === '23' || prefix === '27';
  }
  return false;
}

// Mostrar error
function mostrarError(mensaje) {
  const div = document.getElementById('mensajeError');
  if (!div) return alert(mensaje);
  div.innerText = mensaje;
  div.style.display = 'block';
  setTimeout(() => div.style.display = 'none', 4000);
}

// ================== CAMBIO DINÁMICO LABEL DOCUMENTO ==================
const tipoProveedorSelect = document.getElementById("tipoProveedor");
const documentoLabel = document.getElementById("labelDocumento");
const documentoInput = document.getElementById("documento");

// Solo números en input CUIT/DNI y longitud máxima 11
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

// ================== CAMBIO DINÁMICO INPUT TELÉFONO ==================
const telefonoInput = document.getElementById("telefono");
telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, '');
  if (telefonoInput.value.length > 10) telefonoInput.value = telefonoInput.value.slice(0, 10);
});

// ================== EVENTO SUBMIT ==================
document.getElementById("proveedorForm").addEventListener("submit", async function(e) {
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

  // VALIDACIONES
  if (!nombre) return mostrarError("El nombre es obligatorio");
  if (!tipo_proveedor) return mostrarError("Debe seleccionar el tipo de proveedor");
  if (!validarCUIT(dni_cuil, tipo_proveedor)) return mostrarError("CUIT inválido según tipo de proveedor");
  if (!pref_cont) return mostrarError("Debe seleccionar la preferencia de contacto");
  if (!validarEmail(email)) return mostrarError("El email no tiene un formato válido");
  if (!validarTelefono(telefono)) return mostrarError("El teléfono debe tener 10 números");
  if (!direccionEsValida(direccion)) return mostrarError("Debe seleccionar una dirección de la lista de direcciones validadas");

  try {
    // VERIFICAR DUPLICADOS
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

    // CREAR O EDITAR
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

// ================== EDITAR PROVEEDOR ==================
async function editarProveedor(dni) {
  try {
    const { data, error } = await supabaseClient
      .from('proveedor')
      .select('*')
      .eq('dni_cuil', dni)
      .single();
    if (error) throw error;

    let tipoValue = data.tipo_proveedor;
    tipoProveedorSelect.value = tipoValue;
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

// ================== DAR DE BAJA PROVEEDOR ==================
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
