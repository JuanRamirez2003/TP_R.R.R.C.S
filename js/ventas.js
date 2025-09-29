// ===================== FUNCIONES GENERALES =====================
// Mostrar una sección y ocultar las demás
function mostrarSeccion(seccionId) {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
  document.getElementById(seccionId).style.display = 'block';

  if (seccionId === 'clientes') listarClientes();
  if (seccionId === 'ordenes') listarOrdenes();
}

// Volver al panel principal
function volverPanel() {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== CLIENTES =====================

// Mostrar formulario nuevo cliente
function mostrarFormularioCliente() {
  document.getElementById('formCliente').style.display = 'block';
  document.getElementById('clienteForm').reset();
  document.getElementById('id_cliente').value = '';
  document.getElementById('mensajeExitoCliente').style.display = 'none';
}

// Cancelar formulario cliente
function cancelarCliente() {
  document.getElementById('formCliente').style.display = 'none';
}

// Listar clientes en tabla
async function listarClientes() {
  const { data, error } = await supabaseClient.from('clientes').select('*').order('id_cliente');
  if (error) return console.error(error);

  const tbody = document.querySelector('#tablaClientes tbody');
  tbody.innerHTML = '';
  data.forEach(cliente => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cliente.id_cliente}</td>
      <td>${cliente.nombre}</td>
      <td>${cliente.documento}</td>
      <td>${cliente.contacto}</td>
      <td>${cliente.direccion}</td>
      <td>${cliente.estado}</td>
      <td>
        <button class="btn-editar" onclick="editarCliente(${cliente.id_cliente})">Editar</button>
        <button class="btn-eliminar" onclick="bajaCliente(${cliente.id_cliente})">Eliminar</button>
      </td>
    `;//✏️❌
    tbody.appendChild(tr);
  });
}

// Crear o editar cliente
document.getElementById('clienteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id_cliente = document.getElementById('id_cliente').value;
  const nombre = document.getElementById('nombre').value;
  const documento = document.getElementById('documento').value;
  const contacto = document.getElementById('contacto').value;
  const direccion = document.getElementById('direccion').value;
  const estado = document.getElementById('estado').value;

  if (id_cliente) {
    await supabaseClient.from('clientes').update({ nombre, documento, contacto, direccion, estado }).eq('id_cliente', id_cliente);
  } else {
    await supabaseClient.from('clientes').insert([{ nombre, documento, contacto, direccion, estado }]);
  }

  document.getElementById('formCliente').style.display = 'none';
  document.getElementById('textoExitoCliente').innerText = `Cliente "${nombre}" registrado correctamente.`;
  document.getElementById('mensajeExitoCliente').style.display = 'block';
  listarClientes();
});

// Editar cliente
async function editarCliente(id) {
  const { data } = await supabaseClient.from('clientes').select('*').eq('id_cliente', id).single();
  document.getElementById('id_cliente').value = data.id_cliente;
  document.getElementById('nombre').value = data.nombre;
  document.getElementById('documento').value = data.documento;
  document.getElementById('contacto').value = data.contacto;
  document.getElementById('direccion').value = data.direccion;
  document.getElementById('estado').value = data.estado;
  document.getElementById('formCliente').style.display = 'block';
}

// Dar de baja cliente
async function bajaCliente(id) {
  if (!confirm('¿Desea dar de baja este cliente?')) return;
  await supabaseClient.from('clientes').update({ estado: 'inactivo' }).eq('id_cliente', id);
  listarClientes();
}

// ===================== ÓRDENES DE VENTA =====================
let productosOrdenList = [];

// Mostrar formulario nueva orden
function nuevaOrden() {
  document.getElementById('formOrden').style.display = 'block';
  document.getElementById('ordenForm').reset();
  document.getElementById('mensajeExitoOrden').style.display = 'none';
  document.getElementById('productosContainer').innerHTML = '';
  productosOrdenList = [];
  cargarClientesDropdown();
  agregarProducto(); // siempre inicia con un producto
}

// Cancelar formulario orden
function cancelarOrden() {
  document.getElementById('formOrden').style.display = 'none';
}

// Cargar clientes en dropdown
async function cargarClientesDropdown() {
  const { data } = await supabaseClient.from('clientes').select('id_cliente, nombre').eq('estado','activo');
  const select = document.getElementById('clienteOrden');
  select.innerHTML = '<option value="">Seleccione...</option>';
  data.forEach(c => select.innerHTML += `<option value="${c.id_cliente}">${c.nombre}</option>`);
}

// Agregar producto dinámico
async function agregarProducto() {
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
  const { data } = await supabaseClient.from('productos').select('*').eq('estado','activo');
  const select = div.querySelector('.productoSelect');
  select.innerHTML = '<option value="">Seleccione...</option>';
  data.forEach(p => select.innerHTML += `<option value="${p.id_producto}">${p.nombre} - Stock: ${p.stock}</option>`);
}

// Quitar producto
function quitarProducto(btn) {
  btn.parentElement.remove();
}

// Guardar orden
document.getElementById('ordenForm').addEventListener('submit', async (e) => {
  e.preventDefault();
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
  if (ordenError) { console.error(ordenError); return; }

  // Insertar detalle de productos
  for (const p of productos) {
    await supabaseClient.from('detalle_ordenes').insert([{ id_orden: ordenData.id_orden, id_producto: p.id_producto, cantidad: p.cantidad }]);
  }

  document.getElementById('formOrden').style.display = 'none';
  document.getElementById('textoExitoOrden').innerText = `Orden registrada exitosamente.`;
  document.getElementById('mensajeExitoOrden').style.display = 'block';
  listarOrdenes();
});

// Listar órdenes
async function listarOrdenes() {
  const { data } = await supabaseClient.from('orden_ventas').select('*, clientes(nombre), detalle_ordenes(id_producto, cantidad, productos(nombre, precio_unitario))');
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
}
