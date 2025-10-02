// ===================== FUNCIONES GENERALES =====================
// Mostrar una sección y ocultar las demás
function mostrarSeccion(seccionId) {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
  document.getElementById(seccionId).style.display = 'block';

  if (seccionId === 'clientes') {
    document.getElementById('formCliente').style.display = 'none';
    document.getElementById('mensajeExitoCliente').style.display = 'none';
    document.getElementById('tablaClientesContainer').style.display = 'block';

    listarClientes();
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
  document.getElementById("mensajeExitoCliente").style.display = "none";
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== CLIENTES =====================

// Mostrar formulario nuevo cliente
function mostrarFormularioCliente() {
  document.getElementById('formCliente').style.display = 'block';
  document.getElementById('clienteForm').reset();
  document.getElementById('mensajeExitoCliente').style.display = 'none';
  document.getElementById('tablaClientesContainer').style.display = 'none';
}


function cancelarCliente() {
  
  document.getElementById('tablaClientesContainer').style.display = 'block';
  document.getElementById('formCliente').style.display = 'none';
  

}

// Listar clientes en tabla
async function listarClientes() {
  try {
    const { data, error } = await supabaseClient.from('clientes').select('*').order('dni_cuil');
    if (error) throw error;

    const tbody = document.querySelector('#tablaClientes tbody');
    tbody.innerHTML = '';

    data.forEach(cliente => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${cliente.dni_cuil}</td>
        <td>${cliente.nombre}</td>
        <td>${cliente.tipo_cliente}</td>
        <td>${cliente.email}</td>
        <td>${cliente.telefono}</td>
        <td>${cliente.pref_cont}</td>
        <td>${cliente.direccion}</td>
        <td>${cliente.estado}</td>
        <td>${cliente.alta_id_emp}</td>
        <td>
          <button class="btn-editar" onclick="editarCliente('${cliente.dni_cuil}')">Editar</button>
          <button class="btn-eliminar" onclick="bajaCliente('${cliente.dni_cuil}')">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error listando clientes:', err);
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
const tipoClienteSelect = document.getElementById("tipoCliente");
const documentoLabel = document.getElementById("labelDocumento");
const documentoInput = document.getElementById("documento");


tipoClienteSelect.addEventListener("change", () => {
  if (tipoClienteSelect.value === "consumidor final") {
    documentoLabel.innerText = "DNI:";
    documentoInput.placeholder = "Ej: 12345678";
    documentoInput.value = "";
  } else if (tipoClienteSelect.value === "comercial") {
    documentoLabel.innerText = "CUIL:";
    documentoInput.placeholder = "Ej CUIL: 20-12345678-3";
  } else {
    documentoLabel.innerText = "Documento:";
    documentoInput.placeholder = "Seleccione tipo primero";
    documentoInput.value = "";
  }
});

// ================== EVENTO SUBMIT ==================
document.getElementById("clienteForm").addEventListener("submit", async function (e) {
  e.preventDefault();

  // Tomar valores
  const id_cliente = document.getElementById("id_cliente").value;
  const nombre = document.getElementById("nombre").value.trim();
  const tipo_cliente = document.getElementById("tipoCliente").value;
  const dni_cuil = document.getElementById("documento").value.trim();
  const pref_cont = document.getElementById("preferenciaContacto").value;
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const estado = document.getElementById("estado").value;

  // ============ VALIDACIONES ============
  if (!nombre) return mostrarError("El nombre es obligatorio");
  if (!tipo_cliente) return mostrarError("Debe seleccionar el tipo de cliente");

  if (tipo_cliente === "consumidor final" && !validarDNI(dni_cuil)) {
    return mostrarError("Formato incorrecto de DNI. Ej: 12345678");
  }

  if (tipo_cliente === "comercial" && !validarCUIL(dni_cuil)) {
    return mostrarError("Formato incorrecto de CUIL. Ej: 20-12345678-3");
  }

  if (!pref_cont) return mostrarError("Debe seleccionar la preferencia de contacto");
  if (!validarEmail(email)) return mostrarError("El email no tiene un formato válido");
  if (!validarTelefono(telefono)) return mostrarError("Formato incorrecto de teléfono. Solo números, Ej: 1123456789");
  if (!direccionEsValida(direccion)) return mostrarError("Debe seleccionar una dirección de la lista de direcciones validadas");

  try {
    // ============ VERIFICAR DUPLICADOS ============
    const { data: existente } = await supabaseClient
      .from('clientes')
      .select('id_cliente')
      .eq('dni_cuil', dni_cuil)
      .maybeSingle();

    // Permite que el mismo cliente mantenga su DNI/CUIL
    if (existente && Number(id_cliente) !== existente.id_cliente) {
      throw new Error("Ya existe un cliente con ese DNI/CUIL");
    }

    // ============ DATOS DEL CLIENTE ============
    const nuevoCliente = {
      nombre,
      tipo_cliente,
      dni_cuil,
      pref_cont,
      email,
      telefono,
      direccion,
      estado
    };

    // ============ CREAR O EDITAR ============
    if (id_cliente) {
      // === EDICIÓN ===
      const { error } = await supabaseClient
        .from("clientes")
        .update(nuevoCliente)
        .eq('id_cliente', id_cliente);
      if (error) throw error;
      document.getElementById("textoExitoCliente").innerText = "Cliente actualizado con éxito";
    } else {
      const { error } = await supabaseClient
        .from("clientes")
        .insert([nuevoCliente]);
      if (error) throw error;
      document.getElementById("textoExitoCliente").innerText = "Cliente creado con éxito";
    }

    document.getElementById("formCliente").style.display = "none";
    document.getElementById("mensajeExitoCliente").style.display = "block";

    listarClientes();

  } catch (err) {
    console.error("Error:", err);
    mostrarError(err.message || "Error al procesar el cliente");
  }
});


// ================== EDITAR CLIENTE ==================
async function editarCliente(dni) {
  try {

    const { data, error } = await supabaseClient
      .from('clientes')
      .select('*')
      .eq('dni_cuil', dni)
      .single();
    if (error) throw error;

    // Mapear tipo_cliente de DB al value del select
    let tipoValue = '';
    if (data.tipo_cliente === "consumidor final") tipoValue = "consumidor final";
    else if (data.tipo_cliente === "comercial") tipoValue = "comercial";

    tipoClienteSelect.value = tipoValue;

    if (tipoValue === "consumidor final") {

      documentoLabel.innerText = "DNI:";
      documentoInput.placeholder = "Ingrese DNI (7 u 8 dígitos)";
    } else if (tipoValue === "comercial") {
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

    document.getElementById('id_cliente').value = data.id_cliente;

    // Mostrar formulario
    document.getElementById('formCliente').style.display = 'block';

    document.getElementById('tablaClientesContainer').style.display = 'none';
  } catch (err) {
    console.error(err);
    mostrarError('Error al cargar datos del cliente');
  }
}




// ================== DAR DE BAJA CLIENTE ==================
async function bajaCliente(dni) {
  if (!confirm('¿Desea dar de baja este cliente?')) return;
  try {
    const { error } = await supabaseClient.from('clientes')
      .update({ estado: 'inactivo' })
      .eq('dni_cuil', dni);
    if (error) throw error;
    listarClientes();
  } catch (err) {
    console.error(err);
    mostrarError('Error al dar de baja el cliente');
  }
}

// ===================== ÓRDENES DE VENTA =====================
let productosOrdenList = [];

async function mostrarOrdenes() {
  document.getElementById('formOrden').style.display = 'none';
  document.getElementById('mensajeExitoOrden').style.display = 'none';
  document.getElementById('tablaOrdenesContainer').style.display = 'block';
  await listarOrdenes();
}
// Mostrar formulario nueva orden


function nuevaOrden() {

  document.getElementById('formOrden').style.display = 'block';
  document.getElementById('ordenForm').reset();
  document.getElementById('mensajeExitoOrden').style.display = 'none';
  document.getElementById('productosContainer').innerHTML = '';
  productosOrdenList = [];
  cargarClientesDropdown();
  agregarProducto(); // siempre inicia con un producto

  // Ocultar tabla de órdenes
  document.getElementById('tablaOrdenes').parentElement.style.display = 'none';
}
// Cancelar formulario orden
function cancelarOrden() {
  document.getElementById('formOrden').style.display = 'none';
  document.getElementById('tablaOrdenes').parentElement.style.display = 'block';
}

// Cargar clientes en dropdown
async function cargarClientesDropdown() {
  try {
    const { data, error } = await supabaseClient.from('clientes').select('id_cliente, nombre').eq('estado', 'activo');
    if (error) throw error;

    const select = document.getElementById('clienteOrden');
    select.innerHTML = '<option value="">Seleccione...</option>';
    data.forEach(c => select.innerHTML += `<option value="${c.id_cliente}">${c.nombre}</option>`);
  } catch (err) {
    console.error('Error cargando clientes para orden:', err);
  }
}

// Agregar producto dinámico
async function agregarProducto() {
  try {
    const container = document.getElementById('productosContainer');
    const div = document.createElement('div');
    div.className = 'producto-item';
    div.style.display = 'flex';
    div.style.gap = '10px';
    div.style.marginBottom = '10px';
    div.style.alignItems = 'center';

    div.innerHTML = `
      <div class="form-group" style="flex:1;">
        <label>Producto:</label>
        <select class="productoSelect" required style="width:100%; padding:8px; margin-top:5px; border:1px solid #ccc; border-radius:5px;"></select>
      </div>
      <div class="form-group" style="width:100px;">
        <label>Cantidad:</label>
        <input type="number" class="cantidadInput" min="1" placeholder="Cantidad" required style="width:100%; padding:8px; margin-top:5px; border:1px solid #ccc; border-radius:5px;">
      </div>
      <button type="button" onclick="quitarProducto(this)" class="btn-submit" style="background-color:#e74c3c; padding:8px 12px; margin-top:22px;">❌ Quitar</button>
    `;

    container.appendChild(div);

    // Cargar productos en el select
    const { data, error } = await supabaseClient.from('productos').select('*').eq('estado', 'activo');
    if (error) throw error;

    const select = div.querySelector('.productoSelect');
    select.innerHTML = '<option value="">Seleccione...</option>';
    data.forEach(p => select.innerHTML += `<option value="${p.id_producto}">${p.nombre} - Stock: ${p.stock}</option>`);
  } catch (err) {
    console.error('Error agregando producto:', err);
    alert('Ocurrió un error al agregar el producto.');
  }
}

// Quitar producto
function quitarProducto(btn) {
  btn.parentElement.remove();
}

// Guardar orden
document.getElementById('ordenForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const cliente = document.getElementById('clienteOrden').value;
    const productosDivs = document.querySelectorAll('#productosContainer .producto-item');

    if (!cliente) { alert('Seleccione un cliente'); return; }
    if (productosDivs.length === 0) { alert('Agregue al menos un producto'); return; }

    const productos = [];
    for (const div of productosDivs) {
      const id_producto = div.querySelector('.productoSelect').value;
      const cantidad = parseInt(div.querySelector('.cantidadInput').value);
      if (!id_producto || cantidad < 1) { alert('Complete todos los productos y cantidades'); return; }
      productos.push({ id_producto, cantidad });
    }

    // Insertar orden principal
    const { data: ordenData, error: ordenError } = await supabaseClient
      .from('orden_ventas')
      .insert([{ id_cliente: cliente, fecha: new Date().toISOString(), estado: 'pendiente' }])
      .select()
      .single();
    if (ordenError) throw ordenError;

    // Insertar detalle de productos
    for (const p of productos) {
      const { error } = await supabaseClient.from('detalle_ordenes').insert([{ id_orden: ordenData.id_orden, id_producto: p.id_producto, cantidad: p.cantidad }]);
      if (error) throw error;
    }

    document.getElementById('formOrden').style.display = 'none';
    document.getElementById('textoExitoOrden').innerText = `Orden registrada exitosamente.`;
    document.getElementById('mensajeExitoOrden').style.display = 'block';
    listarOrdenes();
  } catch (err) {
    console.error('Error guardando orden:', err);
    alert('Ocurrió un error al registrar la orden.');
  }
});

// Listar órdenes
async function listarOrdenes() {
  try {
    const { data, error } = await supabaseClient.from('orden_ventas').select('*, clientes(nombre), detalle_ordenes(id_producto, cantidad, productos(nombre, precio_unitario))');
    if (error) throw error;

    const tbody = document.querySelector('#tablaOrdenes tbody');
    tbody.innerHTML = '';

    data.forEach(o => {
      const productosText = o.detalle_ordenes.map(d => `${d.productos.nombre} x${d.cantidad}`).join(', ');
      const total = o.detalle_ordenes.reduce((sum, d) => sum + (d.cantidad * d.productos.precio_unitario), 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${o.id_orden}</td>
        <td>${o.clientes.nombre}</td>
        <td>${productosText}</td>
        <td>${new Date(o.fecha).toLocaleDateString()}</td>
        <td>${o.estado}</td>
        <td>${total}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error listando órdenes:', err);
  }
}
