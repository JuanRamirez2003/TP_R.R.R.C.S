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
    const cliente = document.getElementById('clienteOrden').value;
    const productosDivs = document.querySelectorAll('#productosContainer .producto-item');

    if (!cliente) return alert('Seleccione un cliente');
    if (productosDivs.length === 0) return alert('Agregue al menos un producto');

    const productosConStock = [];
    const productosPendientes = [];

    // Revisar stock de cada producto
    for (const div of productosDivs) {
      const id_producto = parseInt(div.querySelector('.productoSelect').value);
      const cantidad = parseInt(div.querySelector('.cantidadInput').value);

      if (!id_producto || cantidad < 1) return alert('Complete todos los productos y cantidades');

      const { data: prodData, error: prodError } = await supabaseClient
        .from('productos')
        .select('nombre, precio_unitario, stock')
        .eq('id_producto', id_producto)
        .single();

      if (prodError) throw prodError;

      if (prodData.stock >= cantidad) {
        productosConStock.push({
          id_producto,
          cantidad,
          nombre: prodData.nombre,
          precio_unitario: parseFloat(prodData.precio_unitario),
          stock_actual: prodData.stock
        });
      } else {
        productosPendientes.push({
          id_producto,
          cantidad,
          nombre: prodData.nombre,
          precio_unitario: parseFloat(prodData.precio_unitario),
          stock_actual: prodData.stock
        });
      }
    }

    // === Crear orden de productos con stock (facturable) ===
    let ordenFacturable = null;
    if (productosConStock.length > 0) {
      const { data: ordenData, error: ordenError } = await supabaseClient
        .from('orden_ventas')
        .insert([{ id_cliente: parseInt(cliente), fecha: new Date().toISOString(), estado: 'completada' }])
        .select()
        .single();
      if (ordenError) throw ordenError;
      ordenFacturable = ordenData;

      for (const p of productosConStock) {
        await supabaseClient.from('detalle_ordenes').insert([{ id_orden: ordenData.id_orden, id_producto: p.id_producto, cantidad: p.cantidad }]);
        await supabaseClient.from('productos').update({ stock: p.stock_actual - p.cantidad }).eq('id_producto', p.id_producto);
      }

      // Crear factura
      const totalFactura = productosConStock.reduce((sum, p) => sum + p.cantidad * p.precio_unitario, 0);
      await supabaseClient.from('factura').insert([{
        id_orden: ordenData.id_orden,
        id_cliente: parseInt(cliente),
        fecha: new Date().toISOString(),
        total: totalFactura
      }]);
    }

    // === Crear orden pendiente para productos sin stock ===
    let ordenPendiente = null;
    if (productosPendientes.length > 0) {
      const { data: ordenPendData, error: ordenPendError } = await supabaseClient
        .from('orden_ventas')
        .insert([{ id_cliente: parseInt(cliente), fecha: new Date().toISOString(), estado: 'pendiente' }])
        .select()
        .single();
      if (ordenPendError) throw ordenPendError;
      ordenPendiente = ordenPendData;

      for (const p of productosPendientes) {
        await supabaseClient.from('detalle_ordenes').insert([{ id_orden: ordenPendData.id_orden, id_producto: p.id_producto, cantidad: p.cantidad }]);
      }
    }

    // Mensaje final
    let mensaje = '';
    if (ordenFacturable) mensaje += `Productos facturados: ${productosConStock.map(p => p.nombre).join(', ')}.\n`;
    if (ordenPendiente) mensaje += `Productos pendientes: ${productosPendientes.map(p => p.nombre).join(', ')}.`;

    alert(mensaje);

    document.getElementById('formOrden').style.display = 'none';
    listarOrdenes();
    listarFacturas();

  } catch (err) {
    console.error('Error guardando orden completa:', err);
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

async function verFactura(idFactura) {
  try {
    const { data, error } = await supabaseClient
      .from('factura')
      .select(`
        id,
        id_orden,
        fecha,
        total,
        clientes ( nombre, dni_cuil, direccion ),
        orden_ventas (
          fecha,
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

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    // ==== Logo (más grande y centrado) ====
    const logo = await loadImageAsBase64('logo1.jpg');
    if (logo) {
      const img = new Image();
      img.src = logo;
      await img.decode();
      const ratio = img.width / img.height;
      const width = 60; // más grande
      const height = width / ratio;
      const xCenter = (210 - width) / 2;
      doc.addImage(logo, 'JPEG', xCenter, y, width, height);
      y += height + 5;
    }

    // ==== Título ====
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("FACTURA", 105, y, { align: "center" });
    y += 10;

    // ==== Datos de la empresa ====
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Frozen © Alimentos Congelados", 105, y, { align: "center" });
    doc.setFont("helvetica", "normal");
    y += 5;
    doc.text("CUIT: 30-12345678-9", 105, y, { align: "center" });
    y += 5;
    doc.text("Domicilio Fiscal: Av. Ejemplo 123, Ciudad, Provincia", 105, y, { align: "center" });
    y += 5;
    doc.text("Tel: +54 11 1234-5678", 105, y, { align: "center" });
    y += 10;

    // ==== Datos del cliente ====
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Cliente", 20, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre/Razón Social: ${data.clientes?.nombre || '-'}`, 20, y);
    y += 5;
    doc.text(`CUIT/DNI: ${data.clientes?.dni_cuil || '-'}`, 20, y);
    y += 5;
    doc.text(`Domicilio Fiscal: ${data.clientes?.direccion || '-'}`, 20, y);
    y += 10;

    // ==== Identificación de la factura ====
    doc.setFont("helvetica", "bold");
    doc.text(`Factura N°: ${data.id.toString().padStart(6,'0')}`, 150, y - 10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de Emisión: ${new Date(data.fecha).toLocaleDateString()}`, 150, y - 5);
    doc.text(`Fecha de Operación: ${data.orden_ventas?.fecha ? new Date(data.orden_ventas.fecha).toLocaleDateString() : '-'}`, 150, y);

    // ==== Línea separadora ====
    doc.setLineWidth(0.4);
    doc.line(20, y + 3, 190, y + 3);
    y += 8;

    // ==== Encabezado de tabla ====
    const rowHeight = 7;
    function drawTableHeader() {
      doc.setFont("helvetica", "bold");
      doc.setFillColor(220, 220, 220);
      doc.rect(20, y, 170, rowHeight, 'F');
      doc.text("Descripción", 25, y + 5);
      doc.text("Cant.", 105, y + 5, { align: "right" });
      doc.text("Precio Unit.", 145, y + 5, { align: "right" });
      doc.text("Subtotal", 190, y + 5, { align: "right" });
      y += rowHeight;
      doc.setFont("helvetica", "normal");
    }
    drawTableHeader();

    // ==== Productos ====
    let baseImponible = 0;
    (data.orden_ventas?.detalle_ordenes || []).forEach((det, index) => {
      const nombre = det.productos?.nombre || '-';
      const cantidad = det.cantidad;
      const precio = det.productos?.precio_unitario || 0;
      const subtotal = cantidad * precio;
      baseImponible += subtotal;

      if (y + rowHeight + 40 > pageHeight) {
        doc.addPage();
        y = 20;
        drawTableHeader();
      }

      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(20, y - 1, 170, rowHeight, 'F');
      }

      doc.text(nombre, 25, y + 5);
      doc.text(cantidad.toString(), 105, y + 5, { align: "right" });
      doc.text(`$${precio.toFixed(2)}`, 145, y + 5, { align: "right" });
      doc.text(`$${subtotal.toFixed(2)}`, 190, y + 5, { align: "right" });
      y += rowHeight;
    });

    doc.line(20, y, 190, y);
    y += 6;

    // ==== Totales ====
    const iva = baseImponible * 0.21;
    const total = baseImponible + iva;

    doc.setFont("helvetica", "bold");
    doc.text(`Base Imponible: $${baseImponible.toFixed(2)}`, 190, y, { align: "right" });
    y += 6;
    doc.text(`IVA 21%: $${iva.toFixed(2)}`, 190, y, { align: "right" });
    y += 6;
    doc.text(`TOTAL: $${total.toFixed(2)}`, 190, y, { align: "right" });
    y += 10;

    // ==== QR y Código de Barras (alineados lado a lado) ====

    // Generar código QR (JSON)
    const qrDataJSON = JSON.stringify({
      id: data.id,
      fecha: data.fecha,
      total: total.toFixed(2),
      cliente: data.clientes?.nombre || "-"
    });

    const qrContainer = document.createElement('div');
    document.body.appendChild(qrContainer);
    const qr = new QRCode(qrContainer, { text: qrDataJSON, width: 60, height: 60 });
    await new Promise(r => setTimeout(r, 500)); // espera breve para renderizar
    const qrImg = qrContainer.querySelector('img');
    const qrData = qrImg ? qrImg.src : qrContainer.querySelector('canvas').toDataURL("image/png");
    document.body.removeChild(qrContainer);

    // Agregar QR a la izquierda
    doc.addImage(qrData, 'PNG', 30, y, 35, 35);

    // Código de barras a la derecha
    const canvasBar = document.createElement('canvas');
    JsBarcode(canvasBar, `F${data.id.toString().padStart(6, '0')}`, {
      format: "CODE128",
      displayValue: true,
      width: 1,
      height: 15,
      fontSize: 10
    });
    const barcodeData = canvasBar.toDataURL('image/png');
    doc.addImage(barcodeData, 'PNG', 120, y + 10, 60, 15);
    y += 45;

    // ==== Notas y pie ====
    doc.setFont("helvetica", "normal");
    doc.text("Forma de Pago: Transferencia bancaria / Efectivo", 20, y);
    y += 5;
    doc.text("Notas: Gracias por elegir Frozen ©. Verifique los productos al recibirlos.", 20, y);
    y += 10;

    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text("Factura generada digitalmente por Frozen ©. Validez legal sujeta a la normativa fiscal vigente.", 105, pageHeight - 10, null, null, "center");

    // ==== Mostrar PDF ====
    const pdfDataUri = doc.output('datauristring');
    document.getElementById("iframeFactura").src = pdfDataUri;
    document.getElementById("modalFacturaPDF").style.display = "flex";
    window._pdfFactura = doc;

  } catch (err) {
    console.error("Error al ver factura:", err);
    alert("Ocurrió un error al cargar la factura. Ver consola para más detalles.");
  }
}


// ==== Cargar imagen ====
function loadImageAsBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ==== Modal y descarga ====
function cerrarModalFacturaPDF() {
  document.getElementById("modalFacturaPDF").style.display = "none";
  document.getElementById("iframeFactura").src = "";
  window._pdfFactura = null;
}
function descargarFacturaPDF() {
  if (window._pdfFactura) window._pdfFactura.save("factura.pdf");
  else alert("PDF no disponible para descarga.");
}
