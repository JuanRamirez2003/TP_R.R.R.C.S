
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
    mostrarErrorFacturacion('Ocurrió un error al cargar las facturas.');//alert ('Ocurrió un error al cargar las facturas. Ver consola para más detalles.');
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
      mostrarErrorFacturacion('Factura no encontrada');//alert('Factura no encontrada');
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    const formatMoney = (n) =>
      n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });

    // ==== ENCABEZADO EMPRESA ====
    const logo = await loadImageAsBase64('logo1.jpg');
    doc.setFillColor(240, 248, 255);
    doc.rect(15, 15, 180, 40, 'F');

    if (logo) {
      const img = new Image();
      img.src = logo;
      await img.decode();
      const ratio = img.width / img.height;
      const width = 40;
      const height = width / ratio;
      doc.addImage(logo, 'JPEG', 20, 18, width, height);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Frozen © Alimentos Congelados", 110, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("CUIT: 30-12345678-9", 110, 31);
    doc.text("Domicilio Fiscal: Av. Ejemplo 123, Ciudad, Provincia", 110, 36);
    doc.text("Tel: +54 11 1234-5678", 110, 41);

    // 🔹 FACTURA tipo y número
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("FACTURA C", 185, 48, { align: "right" });
    doc.setFontSize(12);
    doc.text(`N° ${data.id.toString().padStart(6, '0')}`, 185, 56, { align: "right" });

    y = 65;

    // ==== SELLO PENDIENTE ====
    doc.saveGraphicsState();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(50);
    doc.setTextColor(255, 0, 0); // rojo
    doc.setGState(new doc.GState({ opacity: 0.15 }));
    doc.text("PENDIENTE", 105, 150, { align: "center", angle: 45 });
    doc.restoreGraphicsState();

    // ==== DATOS DEL CLIENTE ====
    doc.setFillColor(235, 235, 235);
    doc.rect(15, y, 180, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Cliente", 20, y + 6);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text(`Nombre/Razón Social: ${data.clientes?.nombre || '-'}`, 20, y);
    y += 6;
    doc.text(`CUIT/DNI: ${data.clientes?.dni_cuil || '-'}`, 20, y);
    y += 6;
    doc.text(`Domicilio Fiscal: ${data.clientes?.direccion || '-'}`, 20, y);
    y += 10;

    // ==== DATOS DE FACTURA ====
    doc.setFont("helvetica", "bold");
    doc.text("Datos de la Factura", 20, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de Emisión: ${new Date(data.fecha).toLocaleDateString()}`, 20, y);
    y += 6;
    doc.text(`Fecha de Operación: ${data.orden_ventas?.fecha ? new Date(data.orden_ventas.fecha).toLocaleDateString() : '-'}`, 20, y);
    y += 10;

    // ==== TABLA DE DETALLE ====
    const rowHeight = 8;
    const drawHeader = () => {
      doc.setFillColor(220, 220, 220);
      doc.rect(20, y, 170, rowHeight, 'F');
      doc.setFont("helvetica", "bold");
      doc.text("Producto", 25, y + 6);
      doc.text("Cant.", 110, y + 6, { align: "right" });
      doc.text("Precio Unit.", 150, y + 6, { align: "right" });
      doc.text("Subtotal", 190, y + 6, { align: "right" });
      y += rowHeight;
      doc.setFont("helvetica", "normal");
    };
    drawHeader();

    let baseImponible = 0;
    (data.orden_ventas?.detalle_ordenes || []).forEach((det, i) => {
      const nombre = det.productos?.nombre || '-';
      const cantidad = det.cantidad;
      const precio = det.productos?.precio_unitario || 0;
      const subtotal = cantidad * precio;
      baseImponible += subtotal;

      if (y + rowHeight + 50 > pageHeight) {
        doc.addPage();
        y = 20;
        drawHeader();
      }

      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(20, y - 1, 170, rowHeight, 'F');
      }

      doc.text(nombre, 25, y + 5);
      doc.text(cantidad.toString(), 110, y + 5, { align: "right" });
      doc.text(formatMoney(precio), 150, y + 5, { align: "right" });
      doc.text(formatMoney(subtotal), 190, y + 5, { align: "right" });
      y += rowHeight;
    });

    doc.line(20, y, 190, y);
    y += 8;

    // ==== TOTALES ====
    const iva = baseImponible * 0.21;
    const total = baseImponible + iva;

    doc.setFont("helvetica", "normal");
    doc.text(`Base Imponible: ${formatMoney(baseImponible)}`, 190, y, { align: "right" });
    y += 6;
    doc.text(`IVA (21%): ${formatMoney(iva)}`, 190, y, { align: "right" });
    y += 6;
    doc.setFillColor(240, 240, 200);
    doc.rect(120, y - 5, 70, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`TOTAL: ${formatMoney(total)}`, 190, y, { align: "right" });
    y += 20;

    // ==== QR + CÓDIGO DE BARRAS ====
    const qrDataJSON = JSON.stringify({
      id: data.id,
      fecha: data.fecha,
      total: total.toFixed(2),
      cliente: data.clientes?.nombre || "-"
    });

    const qrContainer = document.createElement('div');
    document.body.appendChild(qrContainer);
    const qr = new QRCode(qrContainer, { text: qrDataJSON, width: 60, height: 60 });
    await new Promise(r => setTimeout(r, 400));
    const qrImg = qrContainer.querySelector('img');
    const qrData = qrImg ? qrImg.src : qrContainer.querySelector('canvas').toDataURL("image/png");
    document.body.removeChild(qrContainer);
    doc.addImage(qrData, 'PNG', 30, y, 35, 35);
    doc.setFontSize(9);
    doc.text("Verificación digital", 47, y + 42, { align: "center" });

    const canvasBar = document.createElement('canvas');
    JsBarcode(canvasBar, `F${data.id.toString().padStart(6, '0')}`, {
      format: "CODE128",
      displayValue: true,
      width: 1,
      height: 15,
      fontSize: 10
    });
    const barcodeData = canvasBar.toDataURL('image/png');
    doc.addImage(barcodeData, 'PNG', 130, y + 10, 60, 15);
    doc.text(`Factura N° ${data.id.toString().padStart(6, '0')}`, 160, y + 30, { align: "center" });
    y += 50;

    // ==== PIE ====
    doc.setDrawColor(180);
    doc.line(20, pageHeight - 25, 190, pageHeight - 25);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Forma de Pago: Transferencia bancaria / Efectivo", 20, pageHeight - 20);
    doc.text("Gracias por elegir Frozen ©. Verifique los productos al recibirlos.", 20, pageHeight - 15);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Documento generado digitalmente. No requiere firma ni sello.", 105, pageHeight - 10, { align: "center" });

    // ==== Mostrar PDF ====
    const pdfDataUri = doc.output('datauristring');
    document.getElementById("iframeFactura").src = pdfDataUri;
    document.getElementById("modalFacturaPDF").style.display = "flex";
    window._pdfFactura = doc;

  } catch (err) {
    console.error("Error al ver factura:", err);
    mostrarErrorFacturacion("Ocurrió un error al cargar la factura. Ver consola para más detalles.");//alert("Ocurrió un error al cargar la factura. Ver consola para más detalles.");
  }
}


// ==== Función auxiliar para cargar imágenes ====
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
  else mostrarErrorFacturacion("PDF no disponible para descarga.");//alert("PDF no disponible para descarga.");
}


function mostrarModalBajaC(yaInactivo = false) {
  return new Promise((resolve) => {
    const modal = document.getElementById("modalBajaC");
    if (!modal) {
      console.error("⚠️ No se encontró el modalBajaC en el DOM");
      return resolve(false);
    }

    const titulo = document.getElementById("modalTituloBajaC");
    const mensaje = document.getElementById("modalMensajeBajaC");
    const btnAceptar = document.getElementById("btnAceptarBajaC");

    // Si el cliente ya está dado de baja, mostramos un mensaje distinto
    if (yaInactivo) {
      titulo.textContent = "Cliente ya inactivo";
      mensaje.textContent = "Este cliente ya fue dado de baja y no puede volver a darse de baja.";
      btnAceptar.style.display = "none"; // ocultamos el botón Aceptar
    } else {
      titulo.textContent = "Confirmar baja";
      mensaje.textContent = "¿Desea dar de baja este cliente?";
      btnAceptar.style.display = "inline-block";
    }

    modal.classList.add("mostrar");

    const btnCancelar = document.getElementById("btnCancelarBajaC");

    btnCancelar.onclick = () => {
      modal.classList.remove("mostrar");
      resolve(false);
    };

    btnAceptar.onclick = () => {
      modal.classList.remove("mostrar");
      resolve(true);
    };
  });
}

function mostrarErrorOC(mensaje) {
  const modal = document.getElementById('modalErrorOC');
  const mensajeP = document.getElementById('mensajeErrorTextoOC');
  const btnCerrar = document.getElementById('btnCerrarErrorOC');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de error OC, usando alert()");
    return alert(mensaje);
  }

  mensajeP.textContent = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
}


function mostrarInfoOC(mensaje) {
  const modal = document.getElementById('modalInfoOC');
  const mensajeP = document.getElementById('mensajeInfoTextoOC');
  const btnCerrar = document.getElementById('btnCerrarInfoOC');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de información OC");
    return alert(mensaje);
  }

  mensajeP.textContent = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
}

function mostrarErrorFacturacion(mensaje) {
  const modal = document.getElementById('modalErrorFacturacion');
  const mensajeP = document.getElementById('mensajeErrorTextoFacturacion');
  const btnCerrar = document.getElementById('btnCerrarErrorFacturacion');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de error de facturación, usando alert()");
    return alert(mensaje);
  }

  mensajeP.textContent = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
}




// ================= CAMBIAR SECCIÓN =================
function mostrarSeccion(id) {
  document.querySelectorAll(".seccion").forEach(s => s.style.display = "none");

  const destino = document.getElementById(id);
  if (!destino) return;

  destino.style.display = "block";

  if (id === "verQuejas") cargarQuejas();
  if (id === "responderQuejas") cargarResponder();
  if (id === 'facturas') listarFacturas();
    
  
}

// ================= BUSCADOR INTELIGENTE =================
function filtrarTabla(idTabla, texto) {
  const filtro = texto.toLowerCase();
  const tabla = document.getElementById(idTabla);
  if (!tabla) return;

  tabla.querySelectorAll("tbody tr").forEach(tr => {
    const visible = tr.innerText.toLowerCase().includes(filtro);
    tr.style.display = visible ? "" : "none";
  });
}

// =================== CARGAR QUEJAS ===================
async function cargarQuejas() {
  const tabla = document.querySelector("#tablaQuejas tbody");
  if (!tabla) return;

  tabla.innerHTML = "<tr><td colspan='7'>Cargando...</td></tr>";

  const { data, error } = await supabaseClient
    .from("reclamo")
    .select("id,queja,respuesta,estado,create_at,id_factura,cliente:id_cliente(nombre)")
    .order("id", { ascending: false });

  if (error) {
    console.error("Error cargando quejas:", error);
    tabla.innerHTML = "<tr><td colspan='7'>Error cargando datos</td></tr>";
    return;
  }

  tabla.innerHTML = "";
  data.forEach(r => {
    tabla.innerHTML += `
      <tr>
        <td>${r.id}</td>
        <td>${r.cliente?.nombre || "-"}</td>
        <td>${r.id_factura || "-"}</td>
        <td><button onclick="abrirModalVerTexto('${r.queja}', 'Queja')">Ver</button></td>
        <td>${r.respuesta ? `<button onclick="abrirModalVerTexto('${r.respuesta}', 'Respuesta')">Ver</button>` : "-"}</td>
        <td>${r.estado || "Pendiente"}</td>
        <td>${new Date(r.create_at).toLocaleDateString()}</td>
      </tr>
    `;
  });
}

// =================== CARGAR RECLAMOS SIN RESPUESTA ===================
async function cargarResponder() {
  const tabla = document.querySelector("#tablaResponder tbody");
  if (!tabla) return;

  tabla.innerHTML = "<tr><td colspan='5'>Cargando...</td></tr>";

  const { data, error } = await supabaseClient
    .from("reclamo")
    .select("id,queja,cliente:id_cliente(nombre)")
    .is("respuesta", null);

  if (error) {
    console.error("Error cargando pendientes:", error);
    tabla.innerHTML = "<tr><td colspan='5'>Error cargando datos</td></tr>";
    return;
  }

  tabla.innerHTML = "";
  data.forEach(r => {
    tabla.innerHTML += `
      <tr>
        <td>${r.id}</td>
        <td>${r.cliente?.nombre || "-"}</td>
        <td><button onclick="abrirModalVerTexto('${r.queja}', 'Queja')">Ver</button></td>
        <td><button onclick="abrirModalResponder(${r.id})">Responder</button></td>
      </tr>
    `;
  });
}

// =================== MODAL VER TEXTO ===================
function abrirModalVerTexto(texto, tipo) {
  let modal = document.getElementById("modalVerTexto");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modalVerTexto";
    modal.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:9999;";
    modal.innerHTML = `
      <div style="background:white; padding:20px; border-radius:8px; max-width:500px; width:80%; max-height:80%; overflow:auto;">
        <h3 id="modalVerTitulo"></h3>
        <p id="modalVerContenido"></p>
        <button onclick="cerrarModalVerTexto()">Cerrar</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  document.getElementById("modalVerTitulo").innerText = tipo;
  document.getElementById("modalVerContenido").innerText = texto;
  modal.style.display = "flex";
}

function cerrarModalVerTexto() {
  const modal = document.getElementById("modalVerTexto");
  if (modal) modal.style.display = "none";
}

// =================== MODAL RESPONDER ===================
async function abrirModalResponder(id) {
  let modal = document.getElementById("modalResponder");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modalResponder";
    modal.style = "display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); justify-content:center; align-items:center; z-index:9999;";
    modal.innerHTML = `
      <div style="background:white; padding:20px; border-radius:8px; width:400px;">
        <h3>Responder Reclamo</h3>
        <input type="hidden" id="quejaId">
        <label>Estado:</label>
        <select id="estadoSelect">
          <option value="Aceptada">Aceptada</option>
          <option value="Rechazada">Rechazada</option>
        </select>
        <br><br>
        <label>Motivo / Respuesta:</label>
        <textarea id="respuestaTexto" style="width:100%; height:100px;"></textarea>
        <br><br>
        <button id="guardarRespuestaBtn">Guardar</button>
        <button onclick="cerrarModalResponder()">Cancelar</button>
      </div>
    `;
    document.body.appendChild(modal);
    document.getElementById("guardarRespuestaBtn").addEventListener("click", guardarRespuesta);
  }

  modal.style.display = "flex";
  document.getElementById("quejaId").value = id;

  const { data } = await supabaseClient
    .from("reclamo")
    .select("respuesta,estado")
    .eq("id", id)
    .single();

  document.getElementById("respuestaTexto").value = data?.respuesta || "";
  document.getElementById("estadoSelect").value = data?.estado || "Aceptada";
}

function cerrarModalResponder() {
  const modal = document.getElementById("modalResponder");
  if (modal) modal.style.display = "none";
}

// =================== GUARDAR RESPUESTA ===================
async function guardarRespuesta() {
  const id = document.getElementById("quejaId")?.value;
  const respuesta = document.getElementById("respuestaTexto")?.value;
  const estado = document.getElementById("estadoSelect")?.value;

  if (!id || !respuesta || !estado) return;

  const { error } = await supabaseClient
    .from("reclamo")
    .update({ respuesta, estado })
    .eq("id", id);

  if (error) {
    console.error("Error guardando respuesta:", error);
    return;
  }

  cerrarModalResponder();
  cargarResponder();
  cargarQuejas();
}

// =================== CARGA AUTOMÁTICA ===================
document.addEventListener("DOMContentLoaded", () => {
  cargarQuejas();
  cargarResponder();
});
