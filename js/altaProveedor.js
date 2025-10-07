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

function validarTelefono(telefono) {
  const regex = /^[0-9]{8,15}$/;//15 por numero internacional
  return regex.test(telefono);
}

function validarDNI(dni) {
  const regex = /^[0-9]{8}$/;
  return regex.test(dni);
}

function validarCUIL(cuil) {
  const regex = /^[0-9]{2}-[0-9]{8}-[0-9]$/;
  return regex.test(cuil);
}

function mostrarError(mensaje) {
  const div = document.getElementById('mensajeError');
  if (!div) return alert(mensaje); // fallback si no hay div
  div.innerText = mensaje;
  div.style.display = 'block';
  setTimeout(() => div.style.display = 'none', 4000);
}


// ================== CAMBIO DINÁMICO LABEL DOCUMENTO ==================
const tipoProveedorSelect = document.getElementById("tipoProveedor");
const documentoLabel = document.getElementById("labelDocumento");
const documentoInput = document.getElementById("documento");


tipoProveedorSelect.addEventListener("change", () => {
  if (tipoProveedorSelect.value === "monotributista") {
    documentoLabel.innerText = "DNI:";
    documentoInput.placeholder = "Ej: 12345678";
    documentoInput.value = "";
  } else if (tipoProveedorSelect.value === "responsable inscripto") {
    documentoLabel.innerText = "CUIL:";
    documentoInput.placeholder = "Ej CUIL: 20-12345678-3";
  } else {
    documentoLabel.innerText = "Documento:";
    documentoInput.placeholder = "Seleccione tipo primero";
    documentoInput.value = "";
  }
});

// ================== EVENTO SUBMIT ==================
document.getElementById("proveedorForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  // Tomar valores
  const id_proveedor = document.getElementById("id_proveedor").value;
  const nombre = document.getElementById("nombre").value.trim();
  const tipo_proveedor = document.getElementById("tipoProveedor").value;
  const dni_cuil = document.getElementById("documento").value.trim();
  const pref_cont = document.getElementById("preferenciaContacto").value;
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const estado = document.getElementById("estado").value;

  // ============ VALIDACIONES ============
  if (!nombre) return mostrarError("El nombre es obligatorio");
  if (!tipo_proveedor) return mostrarError("Debe seleccionar el tipo de proveedor");

  if (tipo_proveedor === "consumidor final" && !validarDNI(dni_cuil)) {
    return mostrarError("Formato incorrecto de DNI. Ej: 12345678");
  }

  if (tipo_proveedor === "comercial" && !validarCUIL(dni_cuil)) {
    return mostrarError("Formato incorrecto de CUIL. Ej: 20-12345678-3");
  }

  if (!pref_cont) return mostrarError("Debe seleccionar la preferencia de contacto");
  if (!validarEmail(email)) return mostrarError("El email no tiene un formato válido");
  if (!validarTelefono(telefono)) return mostrarError("Formato incorrecto de teléfono. Solo números, Ej: 1123456789");
  if (!direccionEsValida(direccion)) return mostrarError("Debe seleccionar una dirección de la lista de direcciones validadas");

  try {
    // ============ VERIFICAR DUPLICADOS ============
    const { data: existente } = await supabaseClient
      .from('proveedor')
      .select('id_proveedor')
      .eq('dni_cuil', dni_cuil)
      .maybeSingle();

    // Permite que el mismo proveedor mantenga su DNI/CUIL
    if (existente && Number(id_proveedor) !== existente.id_proveedor) {
      throw new Error("Ya existe un proveedor con ese DNI/CUIL");
    }

    // ============ DATOS DEL PROVEEDOR ============
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

    // ============ CREAR O EDITAR ============
    if (id_proveedor) {
      // === EDICIÓN ===
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

    // Mapear tipo_cliente de DB al value del select
    let tipoValue = '';
    if (data.tipo_proveedor === "responsable inscripto") tipoValue = "responsable inscripto";
    else if (data.tipo_proveedor === "monotributista") tipoValue = "monotributista";

    tipoProveedorSelect.value = tipoValue;

    if (tipoValue === "monotributista") {

      documentoLabel.innerText = "DNI:";
      documentoInput.placeholder = "Ingrese DNI (7 u 8 dígitos)";
    } else if (tipoValue === "responsable inscripto") {
      documentoLabel.innerText = "CUIL:";
      documentoInput.placeholder = "Ingrese CUIL (XX-XXXXXXXX-X)";
    }

    documentoInput.value = data.dni_cuil;

    // Resto de campos
    document.getElementById('nombre').value = data.nombre;
    document.getElementById('direccion').value = data.direccion;
    document.getElementById('email').value = data.email;
    document.getElementById('telefono').value = data.telefono;
    document.getElementById('preferenciaContacto').value = data.pref_cont;
    document.getElementById('estado').value = data.estado;

    document.getElementById('id_proveedor').value = data.id_proveedor;

    // Mostrar formulario
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



