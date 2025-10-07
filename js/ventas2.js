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
   if (seccionId === 'facturas') {
    listarFacturas();
  }
}

// Volver al panel principal
function volverPanel() {
  document.getElementById("mensajeExitoCliente").style.display = "none";
  document.getElementById("mensajeExitoOrden").style.display = "none";
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== CLIENTES =====================
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

// ===================== VALIDACIONES =====================
function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validarTelefono(telefono) {
  const regex = /^[0-9]{8,15}$/;
  return regex.test(telefono);
}

function validarDNI(dni) {
  const regex = /^[0-9]{7,8}$/;
  return regex.test(dni);
}

function validarCUIL(cuil) {
  const regex = /^[0-9]{2}-[0-9]{8}-[0-9]$/;
  return regex.test(cuil);
}

function mostrarError(mensaje) {
  const div = document.getElementById('mensajeError');
  if (!div) return alert(mensaje);
  div.innerText = mensaje;
  div.style.display = 'block';
  setTimeout(() => div.style.display = 'none', 4000);
}

// ===================== ÓRDENES DE VENTA =====================
let productosOrdenList = [];

async function mostrarOrdenes() {
  document.getElementById('formOrden').style.display = 'none';
  document.getElementById('mensajeExitoOrden').style.display = 'none';
  document.getElementById('tablaOrdenesContainer').style.display = 'block';
  await listarOrdenes();
}

function nuevaOrden() {
  document.getElementById('formOrden').style.display = 'block';
  document.getElementById('ordenForm').reset();
  document.getElementById('mensajeExitoOrden').style.display = 'none';
  document.getElementById('productosContainer').innerHTML = '';
  productosOrdenList = [];
  cargarClientesDropdown();
  agregarProducto();
  document.getElementById('tablaOrdenes').parentElement.style.display = 'none';
}

function cancelarOrden() {
  document.getElementById('formOrden').style.display = 'none';
  document.getElementById('tablaOrdenes').parentElement.style.display = 'block';
}

async function cargarClientesDropdown() {
  try {
    const { data, error } = await supabaseClient
      .from('clientes')
      .select('id_cliente, nombre')
      .eq('estado', 'activo');
    if (error) throw error;

    const select = document.getElementById('clienteOrden');
    select.innerHTML = '<option value="">Seleccione...</option>';

    data.forEach(c => {
      select.innerHTML += `<option value="${c.id_cliente}">${c.id_cliente} - ${c.nombre}</option>`;
    });

    $('#clienteOrden').select2({
      placeholder: "Buscar por Nombre o Numero de Cliente",
      allowClear: true,
      dropdownParent: $('#formOrden'),
      matcher: function (params, data) {
        if ($.trim(params.term) === '') return data;
        const term = params.term.toLowerCase();
        const text = data.text.toLowerCase();
        if (text.includes(term)) return data;
        return null;
      }
    });
  } catch (err) {
    console.error('Error cargando clientes:', err);
  }
}

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
      <div class="form-group" style="width:300px;">
        <label>Producto:</label>
        <select class="productoSelect" required style="width:100%; padding:8px; margin-top:5px; border:1px solid #ccc; border-radius:5px;"></select>
      </div>
      <div class="form-group" style="width:120px;">
        <label>Cant. Cajas:</label>
        <input type="number" class="cantidadInput" min="1" placeholder="Cantidad" required style="width:100%; padding:8px; margin-top:5px; border:1px solid #ccc; border-radius:5px;">
      </div>
      <div class="form-group" style="width:150px;">
        <label>Precio Unitario:</label>
        <input type="text" class="precioUnitarioInput" readonly placeholder="0.00">
      </div>
      <div class="form-group" style="width:150px;">
        <label>Total:</label>
        <input type="text" class="precioTotalInput" readonly placeholder="0.00">
      </div>
      <button type="button" onclick="quitarProducto(this)" class="btn-submit" style="background-color:#e74c3c; padding:8px 12px; margin-top:22px;">❌ Quitar</button>
    `;

    container.appendChild(div);

    const select = div.querySelector('.productoSelect');
    const cantidadInput = div.querySelector('.cantidadInput');
    const precioUnitarioInput = div.querySelector('.precioUnitarioInput');
    const precioTotalInput = div.querySelector('.precioTotalInput');

    const { data, error } = await supabaseClient.from('productos').select('*').eq('estado', 'activo');
    if (error) throw error;

    select.innerHTML = '<option value="">Seleccione...</option>';
    data.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id_producto;
      option.textContent = p.nombre;
      option.dataset.precio = p.precio_unitario ?? 0;
      select.appendChild(option);
    });

    $(select).select2({ placeholder: "Buscar producto...", allowClear: true, dropdownParent: $(container), width: '100%' });

    $(select).on('change', () => {
      const precioUnitario = parseFloat(select.selectedOptions[0]?.dataset.precio || 0);
      precioUnitarioInput.value = precioUnitario.toFixed(2);
      precioTotalInput.value = (precioUnitario * (parseFloat(cantidadInput.value) || 0)).toFixed(2);
    });

    cantidadInput.addEventListener('input', () => {
      const precioUnitario = parseFloat(precioUnitarioInput.value) || 0;
      const cantidad = parseFloat(cantidadInput.value) || 0;
      precioTotalInput.value = (precioUnitario * cantidad).toFixed(2);
    });

  } catch (err) {
    console.error('Error agregando producto:', err);
    alert('Ocurrió un error al agregar el producto.');
  }
}

function quitarProducto(btn) {
  btn.parentElement.remove();
  if(document.querySelectorAll('.producto-item').length === 0) agregarProducto();
}

// ===================== GUARDAR ORDEN Y CREAR FACTURA =====================
document.getElementById('ordenForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    // Obtener cliente y productos del formulario
    const cliente = document.getElementById('clienteOrden').value;
    const productosDivs = document.querySelectorAll('#productosContainer .producto-item');

    if (!cliente) return alert('Seleccione un cliente');
    if (productosDivs.length === 0) return alert('Agregue al menos un producto');

    const productos = [];
    const productosConStock = [];

    // Armar lista de productos y verificar stock individual
    for (const div of productosDivs) {
      const id_producto = parseInt(div.querySelector('.productoSelect').value);
      const cantidad = parseInt(div.querySelector('.cantidadInput').value);

      if (!id_producto || cantidad < 1) return alert('Complete todos los productos y cantidades');

      const { data: prodData, error: prodError } = await supabaseClient
        .from('productos')
        .select('stock, nombre, precio_unitario')
        .eq('id_producto', id_producto)
        .single();
      if (prodError) throw prodError;

      productos.push({
        id_producto,
        cantidad,
        stock_actual: prodData.stock,
        precio_unitario: parseFloat(prodData.precio_unitario),
        nombre: prodData.nombre
      });

      if (prodData.stock >= cantidad) {
        productosConStock.push({
          id_producto,
          cantidad,
          stock_actual: prodData.stock,
          precio_unitario: parseFloat(prodData.precio_unitario),
          nombre: prodData.nombre
        });
      } else {
        alert(`No hay suficiente stock para "${prodData.nombre}". Solo se reservará lo que haya disponible.`);
      }
    }

    // Crear la orden (siempre se crea)
    const { data: ordenData, error: ordenError } = await supabaseClient
      .from('orden_ventas')
      .insert([{
        id_cliente: parseInt(cliente),
        fecha: new Date().toISOString(),
        estado: 'pendiente'
      }])
      .select()
      .single();
    if (ordenError) throw ordenError;

    // Insertar detalle de la orden y actualizar stock solo para los productos con stock
    for (const p of productosConStock) {
      const { error: detalleError } = await supabaseClient
        .from('detalle_ordenes')
        .insert([{ id_orden: ordenData.id_orden, id_producto: p.id_producto, cantidad: p.cantidad }]);
      if (detalleError) throw detalleError;

      const { error: updateError } = await supabaseClient
        .from('productos')
        .update({ stock: p.stock_actual - p.cantidad })
        .eq('id_producto', p.id_producto);
      if (updateError) throw updateError;
    }

    // Crear factura solo si hay productos con stock
    if (productosConStock.length > 0) {
      const totalOrden = productosConStock.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);

      const { data: facturaData, error: facturaError } = await supabaseClient
        .from('factura')
        .insert([{
          id_orden: parseInt(ordenData.id_orden),
          id_cliente: parseInt(cliente),
          fecha: new Date().toISOString(),
          total: totalOrden
        }])
        .select()
        .single();

      if (facturaError) throw facturaError;
    }

    // Mostrar mensaje de éxito
    document.getElementById('formOrden').style.display = 'none';
    document.getElementById('textoExitoOrden').innerText = `Orden registrada exitosamente. Productos reservados: ${productosConStock.length}, faltantes: ${productos.length - productosConStock.length}`;
    document.getElementById('mensajeExitoOrden').style.display = 'block';
    listarOrdenes();
    listarFacturas();

  } catch (err) {
    console.error('Error guardando orden completo:', JSON.stringify(err, null, 2));
    alert('Ocurrió un error al registrar la orden.');
  }
});



// ===================== LISTAR ÓRDENES =====================
async function listarOrdenes() {
  try {
    const { data, error } = await supabaseClient
      .from('orden_ventas')
      .select('*, clientes(nombre), detalle_ordenes(id_producto, cantidad, productos(nombre, precio_unitario))');
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
        <td>${total.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error listando órdenes:', err);
  }
}
// ===================== LISTAR FACTURAS =====================
async function listarFacturas() {
  try {
    // Consulta principal a la tabla factura
    const { data, error } = await supabaseClient
      .from('factura')
      .select('id, id_orden, id_cliente, fecha, total')
      .order('fecha', { ascending: false });

    if (error) throw error;

    const tbody = document.querySelector('#tablaFacturas tbody');
    tbody.innerHTML = '';

    // Recorremos cada factura
    for (const f of data) {
      // Buscar el nombre del cliente correspondiente
      let clienteNombre = '-';
      if (f.id_cliente) {
        const { data: clienteData, error: clienteError } = await supabaseClient
          .from('clientes')
          .select('nombre')
          .eq('id_cliente', f.id_cliente)
          .single();

        if (!clienteError && clienteData) {
          clienteNombre = clienteData.nombre;
        }
      }

      // Crear fila en la tabla
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td>${f.id_orden}</td>
        <td>${clienteNombre}</td>
        <td>${f.fecha ? new Date(f.fecha).toLocaleDateString() : '-'}</td>
        <td>${f.total !== null ? parseFloat(f.total).toFixed(2) : '0.00'}</td>
        <td>
          <button class="btn-ver" onclick="verFactura(${f.id})">Ver</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    console.error('Error listando facturas:', JSON.stringify(err, null, 2));
    alert('Ocurrió un error al cargar las facturas. Ver consola para más detalles.');
  }
}

// ===================== VER FACTURA EN PDF =====================
async function verFactura(idFactura) {
  try {
    const { data, error } = await supabaseClient
      .from('factura')
      .select(`
        id,
        id_orden,
        fecha,
        total,
        clientes ( nombre ),
        orden_ventas (
          detalle_ordenes (
            cantidad,
            productos ( nombre, precio_unitario )
          )
        )
      `)
      .eq('id', idFactura)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      alert('Factura no encontrada');
      return;
    }

    // Crear jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Factura", 105, 20, null, null, "center");

    doc.setFontSize(12);
    doc.text(`ID Factura: ${data.id}`, 20, 40);
    doc.text(`ID Orden: ${data.id_orden}`, 20, 50);
    doc.text(`Cliente: ${data.clientes?.nombre || '-'}`, 20, 60);
    doc.text(`Fecha: ${new Date(data.fecha).toLocaleDateString()}`, 20, 70);
    doc.text(`Total: $${parseFloat(data.total || 0).toFixed(2)}`, 20, 80);

    // Agregar productos
    doc.text("Productos:", 20, 95);
    let y = 105;
    (data.orden_ventas?.detalle_ordenes || []).forEach(det => {
      const nombre = det.productos?.nombre || '-';
      const cantidad = det.cantidad;
      const precio = det.productos?.precio_unitario || 0;
      const subtotal = cantidad * precio;
      doc.text(`${nombre} - Cant: ${cantidad} - Precio: $${precio.toFixed(2)} - Subtotal: $${subtotal.toFixed(2)}`, 25, y);
      y += 10;
    });

    // Generar PDF en base64 y mostrar en iframe
    const pdfDataUri = doc.output('datauristring');
    document.getElementById("iframeFactura").src = pdfDataUri;
    document.getElementById("modalFacturaPDF").style.display = "flex";

    // Guardar PDF para descarga
    window._pdfFactura = doc;

  } catch (err) {
    console.error("Error al ver factura:", err);
    alert("Ocurrió un error al cargar la factura. Ver consola para más detalles.");
  }
}

// ===================== CERRAR MODAL =====================
function cerrarModalFacturaPDF() {
  document.getElementById("modalFacturaPDF").style.display = "none";
  document.getElementById("iframeFactura").src = "";
  window._pdfFactura = null;
}

// ===================== DESCARGAR PDF =====================
function descargarFacturaPDF() {
  if (window._pdfFactura) {
    window._pdfFactura.save("factura.pdf");
  } else {
    alert("PDF no disponible para descarga.");
  }
}