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
    document.getElementById("filtroGProveedores").style.display = "block";
    listarProveedores();
  }

  if (seccionId === 'ordenes') {
    document.getElementById('opForm').style.display = 'none';
    document.getElementById('mensajeExitoOrden').style.display = 'none';
    document.getElementById('tablaOrdenesContainer').style.display = 'block';
    listarOrdenes();
  }
  if (seccionId === "ordenProduccion") {
    document.getElementById('opForm').style.display = 'block';
    document.getElementById('mensajeExitoOrden').style.display = 'none';
    document.getElementById('tablaOrdenesContainer').style.display = 'block';
    listarOrdenes();
  };
}

function volverPanel() {
  document.getElementById("mensajeExitoProveedor").style.display = "none";
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== PROVEEDORES =====================
function mostrarFormularioProveedor() { 
    const submitBtn = document.querySelector("#proveedorForm button[type='submit']");
  submitBtn.disabled = false;
  
  document.getElementById("id_proveedor").value = "";
  document.getElementById('formProveedor').style.display = 'block';
  document.getElementById('proveedorForm').reset();
  document.getElementById('mensajeExitoProveedor').style.display = 'none';
  document.getElementById('tablaProveedorContainer').style.display = 'none';
  document.getElementById("filtroGProveedores").style.display = "none";
  const container = document.getElementById("materialesContainer");
  container.innerHTML = "";
  agregarMaterial();

}

function cancelarProveedor() {
  document.getElementById('tablaProveedorContainer').style.display = 'block';
  document.getElementById('formProveedor').style.display = 'none';
  document.getElementById("filtroGProveedores").style.display = "block";
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
        
        <td>
          <div class="acciones-proveedor">
            <button class="btn-editar" onclick="editarProveedor('${proveedor.dni_cuil}')">Editar</button>
            <button class="btn-eliminar" onclick="bajaProveedor('${proveedor.dni_cuil}')">Eliminar</button>
          </div>
      </td>
      `;//<td>${proveedor.alta_id_emp || '-'}</td>
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

/*function mostrarAviso(mensaje) {
  const div = document.getElementById('mensajeError');
  if (!div) return alert(mensaje);
  div.innerText = mensaje;
  div.style.display = 'block';
  setTimeout(() => div.style.display = 'none', 4000);
}*/

function mostrarAviso(mensaje) {
  const modal = document.getElementById('modalAviso');
  const mensajeP = document.getElementById('mensajeAvisoTexto');
  const btnCerrar = document.getElementById('btnCerrarAviso');

  if (!modal || !mensajeP || !btnCerrar) {
    console.error("⚠️ No se encontró el modal de aviso");
    return alert(mensaje);
  }

  mensajeP.textContent = mensaje;
  modal.classList.add('mostrar');

  btnCerrar.onclick = () => modal.classList.remove('mostrar');
  modal.onclick = (e) => {
    if (e.target === modal) modal.classList.remove('mostrar');
  };
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
  contenedor.style.background = "#333";
  //contenedor.style.border = "1px solid #eee";
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

      li.addEventListener("mouseover", () => li.style.background = "#007bff");
      li.addEventListener("mouseout", () => li.style.background = "#333");

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


  const submitBtn = this.querySelector('button[type="submit"]');
  submitBtn.disabled = true; // Desactiva el botón al hacer submit

  const id_proveedor = document.getElementById("id_proveedor").value;
  const nombre = document.getElementById("nombre").value.trim();
  const tipo_proveedor = document.getElementById("tipoProveedor").value;
  const dni_cuil = document.getElementById("documento").value.trim();
  const pref_cont = document.getElementById("preferenciaContacto").value;
  const email = document.getElementById("email").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  //const estado = document.getElementById("estado").value;

  // Validaciones
  if (!nombre || !tipo_proveedor || !validarCUIT(dni_cuil, tipo_proveedor) ||
    !pref_cont || !validarEmail(email) || !validarTelefono(telefono) ||
    !direccionEsValida(direccion)) {
    submitBtn.disabled = false; // Rehabilitar si hay error de validación
    return mostrarAviso("Revisar campos. Hay datos inválidos.");
  }
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) {
    console.warn("⚠️ No hay usuario logueado en localStorage");
    mostrarAviso("No se pudo identificar al usuario para auditoría");
    return;
  }
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
      audit_user_id: currentUserId
      //estado
    };

    //console.log("$$$$$$$$$$$$$$",currentUserId);

    if (id_proveedor) {
      const { error } = await supabaseClient
        .from("proveedor")
        .update(nuevoProveedor)
        .eq('id_proveedor', id_proveedor);
      if (error) throw error;

      await supabaseClient
        .from("materiaprima_proveedor")
        .delete()
        .eq("id_proveedor", id_proveedor);

      const materialSelects = document.querySelectorAll(".materialSelect");

      for (const select of materialSelects) {
        const id_mp = select.value;
        if (!id_mp) continue;

        const { error: errRel } = await supabaseClient
          .from("materiaprima_proveedor")
          .insert({
            id_mp,
            id_proveedor: id_proveedor
          });

        if (errRel) throw errRel;
      }


      //document.getElementById("textoExitoProveedor").innerText = "Proveedor actualizado con éxito";
      mostrarAviso("Proveedor actualizado con éxito");
      
    } else {
      const { data: provCreado, error } = await supabaseClient
        .from("proveedor")
        .insert([nuevoProveedor])
        .select("id_proveedor")
        .single();

      if (error) throw error;
      const proveedorId = provCreado.id_proveedor;

      const materialSelects = document.querySelectorAll(".materialSelect");

      for (const select of materialSelects) {
        const id_mp = select.value;
        if (!id_mp) continue;

        const { error: errRel } = await supabaseClient
          .from("materiaprima_proveedor")
          .insert({
            id_mp,
            id_proveedor: proveedorId
          });

        if (errRel) throw errRel;
      }

      //document.getElementById("textoExitoProveedor").innerText = "Proveedor creado con éxito";
      mostrarAviso("Proveedor creado con éxito");
    }

    document.getElementById("formProveedor").style.display = "none";
    document.getElementById("mensajeExitoProveedor").style.display = "block";
    listarProveedores();

  } catch (err) {
    console.error("Error:", err);
    mostrarAviso(err.message || "Error al procesar el proveedor");
    submitBtn.disabled = false; // Se vuelve a habilitar si hubo error
  }
});

// ================== EDITAR / BAJA ==================
async function editarProveedor(dni) {

  document.getElementById("filtroGProveedores").style.display = "none";
  try {
    const { data, error } = await supabaseClient
      .from('proveedor')
      .select('*')
      .eq('dni_cuil', dni)

      .single();
    if (error) throw error;

    tipoProveedorSelect.value = data.tipo_proveedor;
    documentoInput.value = data.dni_cuil;
    document.getElementById('nombre').value = data.nombre;
    document.getElementById('direccion').value = data.direccion;
    document.getElementById('email').value = data.email;
    document.getElementById('telefono').value = data.telefono;
    document.getElementById('preferenciaContacto').value = data.pref_cont;
    //document.getElementById('estado').value = data.estado;
    document.getElementById('id_proveedor').value = data.id_proveedor;

    document.getElementById('formProveedor').style.display = 'block';
    document.getElementById('tablaProveedorContainer').style.display = 'none';
    cargarMaterialesDeProveedor(data.id_proveedor);
  } catch (err) {
    console.error(err);
    mostrarAviso('Error al cargar datos del proveedor');
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
    mostrarAviso('Error al dar de baja el proveedor');
  }
}
async function cargarMaterialesDeProveedor(idProveedor) {
  const container = document.getElementById("materialesContainer");
  container.innerHTML = "";
  const { data, error } = await supabaseClient
    .from("materiaprima_proveedor")
    .select("id_mp")
    .eq("id_proveedor", idProveedor);

  if (error) {
    console.error(error);
    return;
  }

  for (const row of data) {
    await agregarMaterial();
    const selects = document.querySelectorAll(".materialSelect");
    const last = selects[selects.length - 1];
    last.value = row.id_mp;
    $(last).trigger("change");
  }
}
//===========FILTRO DE TABLA PROVEEDORES ======================
document.addEventListener("DOMContentLoaded", () => {
  const inputFiltro = document.getElementById("filtroGProveedores");
  const tbody = document.querySelector("#tablaProveedor tbody");

  const mensajeNoResultados = document.createElement("p");
  mensajeNoResultados.id = "mensajeNoResultadosProveedores";
  mensajeNoResultados.style.display = "none";
  mensajeNoResultados.style.textAlign = "center";
  mensajeNoResultados.style.marginTop = "10px";
  mensajeNoResultados.style.color = "#ccc";
  mensajeNoResultados.textContent = "No se encontraron proveedores.";

  document.querySelector("#tablaProveedor").parentElement.appendChild(mensajeNoResultados);

  inputFiltro.addEventListener("input", function () {
    const filtro = this.value.toLowerCase();
    const filas = tbody.querySelectorAll("tr");
    let visibles = 0;

    filas.forEach(fila => {
      const celdas = Array.from(fila.cells)
        .map((c, i) => ({ index: i, texto: c.textContent.toLowerCase() }))
        .filter(c => [0, 1, 2, 7].includes(c.index))
        .map(c => c.texto);

      const coincide = celdas.some(texto => texto.includes(filtro));
      fila.style.display = coincide ? "" : "none";

      if (coincide) visibles++;
    });

    mensajeNoResultados.style.display = visibles === 0 ? "block" : "none";
  });
});


async function agregarMaterial() {
  try {
    const container = document.getElementById("materialesContainer");

    const div = document.createElement("div");
    div.className = "material-item";
    div.style.display = "flex";
    div.style.gap = "10px";
    div.style.marginBottom = "10px";
    div.style.alignItems = "flex-end";

    div.innerHTML = `
      <div class="form-group" style="flex:1;">
        <label>Material Suministrado:</label>
        <select class="materialSelect" required></select>
      </div>
      <div>
      <button type="button" onclick="quitarMaterial(this)" class="btn-eliminar">❌ Quitar</button></div>
    `;

    container.appendChild(div);

    const select = div.querySelector(".materialSelect");

    const { data, error } = await supabaseClient
      .from("materiales")
      .select("id_mp, nombre")
      .order("nombre", { ascending: true });

    if (error) throw error;

    select.innerHTML = '<option value="">Seleccione material...</option>';

    data.forEach(m => {
      const option = document.createElement("option");
      option.value = m.id_mp;
      option.textContent = m.nombre;
      select.appendChild(option);
    });

    // ---- Activar Select2 ----
    $(select).select2({
      placeholder: "Buscar material...",
      allowClear: true,
      dropdownParent: $(container),
      width: "100%"
    });

  } catch (err) {
    console.error("Error agregando material:", err);
    mostrarAviso("Ocurrió un error al agregar el material.");
  }
}

function quitarMaterial(btn) {
  const container = document.getElementById("materialesContainer");
  const item = btn.closest(".material-item");
  const items = container.querySelectorAll(".material-item");

  if (items.length === 1) {
    mostrarAviso("Debe haber al menos un material.");
    return;
  }

  const select = item.querySelector(".materialSelect");
  if (select) {
    $(select).select2("destroy");
  }

  item.remove();
}

