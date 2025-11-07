let materialData = [];

// ============================
// Utilidades
// ============================
function habilitarMaterial(habilitar = true) {
        const el = document.getElementById('Id_Material');
        if (el) el.disabled = !habilitar;
        cargarMateriales();
}

function habilitarCampos(campos, habilitar = true) {
    campos.forEach(c => {
        const el = document.getElementById(c);
        if (el) el.disabled = !habilitar;
    });
    const btnSubmit = document.querySelector('.btn-submit');
    if (btnSubmit) btnSubmit.disabled = !habilitar;
}

function resetSelect(selectId, placeholder = "Seleccione...") {
    const sel = document.getElementById(selectId);
    if (sel) sel.innerHTML = `<option value="">${placeholder}</option>`;
}

// ============================
// Navegación entre secciones
// ============================
function mostrarSeccion(seccionId) {
    try {
        document.querySelectorAll('.seccion').forEach(sec => {
            sec.style.display = 'none';
            if(sec.id === 'IngresoMateriales') {
                const form = sec.querySelector('form');
                if(form) form.reset();
                habilitarCampos(['lote', 'cantidad_disponible', 'fecha_ingreso', 'fecha_cad', 'estado',  'provMaterial'], false);
                resetSelect('provMaterial');
            }
        });

        const target = document.getElementById(seccionId);
        if(target) target.style.display = 'block';
        if(seccionId === 'VistaMateriales') cargarMaterial();
    } catch(err) {
        console.error("Error mostrando sección:", err);
    }
}

// ============================
// Cargar Materia Prima
// ============================
async function cargarMateriales() {
    const tipo = document.getElementById('Tipo_Material').value;
    console.log("Tipo seleccionado:", tipo);
    try {
        const { data, error } = await supabaseClient.from('materiales').select('*').eq('Tipo', tipo);
        if (error) throw error;

        materialData = data || [];

        const select = document.getElementById('Id_Material');
        if (select) {
            resetSelect('Id_Material');
            materialData.forEach(material => {
                const option = document.createElement('option');
                option.value = material.id_mp;
                option.textContent = material.nombre;
                select.appendChild(option);
            });
        }
    } catch(err) {
        console.error("Error cargando material:", err);
    }
}

// ============================
// Mostrar datos al seleccionar Material
// ============================
async function mostrarDatosMaterial() {
    try {
        const id = document.getElementById('Id_Material').value;
        const campos = ['lote', 'cantidad_disponible', 'fecha_ingreso', 'fecha_cad', 'estado'];
        const material = materialData.find(item => item.id_mp == id);

        if (!material) {
            campos.forEach(c => document.getElementById(c).disabled = true);
            habilitarCampos(['provMaterial'], false);
            resetSelect('provMaterial');
            document.getElementById('descMaterial').value = '';
            document.getElementById('unidadMaterial').value = '';
            return;
        }

        document.getElementById('descMaterial').value = material.descr || '';
        document.getElementById('unidadMaterial').value = material.unidad || '';

        // Obtener proveedores asociados
        const { data: relaciones, error: errRel } = await supabaseClient
            .from('materiaprima_proveedor')
            .select('id_proveedor')
            .eq('id_mp', id);
        if (errRel) throw errRel;

        resetSelect('provMaterial');
        if (relaciones && relaciones.length) {
            const idsProveedores = relaciones.map(r => r.id_proveedor);
            const { data: proveedores, error: errProv } = await supabaseClient
                .from('proveedor')
                .select('*')
                .in('id_proveedor', idsProveedores);
            if (errProv) throw errProv;

            proveedores.forEach(p => {
                const option = document.createElement('option');
                option.value = p.id_proveedor;
                option.textContent = p.nombre;
                document.getElementById('provMaterial').appendChild(option);
            });
        }

        habilitarCampos(campos, true);
        habilitarCampos(['provMaterial'], true);

        // Configurar fechas
        const fechaIngreso = document.getElementById('fecha_ingreso');
        const fechaCad = document.getElementById('fecha_cad');
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
        fechaIngreso.setAttribute('min', hoyStr);
        fechaIngreso.setAttribute('max', hoyStr);
        fechaCad.setAttribute('min', hoyStr);

        fechaIngreso.addEventListener('change', () => {
            fechaCad.setAttribute('min', fechaIngreso.value);
        });

    } catch(err) {
        console.error("Error mostrando datos Material:", err);
    }
}

// ============================
// Eventos Botones
// ============================
document.getElementById('btnCancelar')?.addEventListener('click', () => {
    const form = document.getElementById('MaterialesForm');
    form.reset();
    form.style.display = 'grid';
    document.getElementById('mensajeExito').style.display = 'none';
    habilitarCampos(['lote', 'cantidad_disponible', 'fecha_ingreso', 'fecha_cad', 'estado',  'provMaterial'], false);
    resetSelect('provMaterial');
    mostrarSeccion('vistaMateriales');
});

document.getElementById('btnOtroLote')?.addEventListener('click', () => {
    const form = document.getElementById('MaterialesForm');
    form.reset();
    form.style.display = 'grid';
    document.getElementById('mensajeExito').style.display = 'none';
    habilitarCampos(['lote', 'cantidad_disponible', 'fecha_ingreso', 'fecha_cad', 'estado',  'provMaterial'], false);
    resetSelect('provMaterial');
});

document.getElementById('btnVolverPrincipal')?.addEventListener('click', () => {
    document.getElementById('mensajeExito').style.display = 'none';
    mostrarSeccion('vistaMateriales');
});

// ============================
// Insertar lote
// ============================
document.getElementById('MaterialesForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const nuevoLote = {
            id_mp: parseInt(document.getElementById('Id_Material').value),
            id_proveedor: parseInt(document.getElementById('provMaterial').value),
            lote: document.getElementById('lote').value,
            cantidad_disponible: parseFloat(document.getElementById('cantidad_disponible').value),
            fecha_ingreso: document.getElementById('fecha_ingreso').value,
            fecha_caducidad: document.getElementById('fecha_cad').value,
            estado: document.getElementById('estado').value
        };
        const { error } = await supabaseClient.from('lote_mp').insert([nuevoLote]);
        if (error) throw error;

        const form = document.getElementById('MaterialesForm');
        form.style.display = 'none';
        const mensajeExito = document.getElementById('mensajeExito');
        document.getElementById('textoExito').textContent = "Lote registrado correctamente";
        mensajeExito.style.display = 'block';

    } catch(err) {
        console.error("Error insertando lote:", err);
        document.getElementById('mensaje').textContent = "Error al registrar el lote";
    }
});

// ============================
// Cargar tabla Materias Primas
// ============================
async function cargarMaterial() {
    try {
        const { data: materias, error } = await supabaseClient.from('materiales').select(`*, lote_mp(cantidad_disponible)`);
        if (error) throw error;

        const { data: proveedores } = await supabaseClient.from('proveedor').select('id_proveedor,nombre');
        const tbody = document.querySelector('#tablaMateriales tbody');
        tbody.innerHTML = '';

        materias.forEach(material => {
            const stock = material.lote_mp?.reduce((acc,l)=> acc+l.cantidad_disponible,0) || 0;
            const nombreProv = proveedores.find(p=>p.id_proveedor===material.id_proveedor)?.nombre || '';
            const nombreProvSec = proveedores.find(p=>p.id_proveedor===material.id_proveedorsec)?.nombre || '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${material.id_mp}</td>
                <td>${material.nombre}</td>
                <td>${material.descr}</td>
                <td>${material.unidad}</td>
                <td>${stock}</td>
                <td>${nombreProv}</td>
                <td>${nombreProvSec}</td>
                <td><button class="btn-editar" onclick="verLotes(${material.id_mp})">Ver Lotes</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch(err) {
        console.error("Error cargando tabla Material:", err);
    }
}

// ============================
// Ver lotes de un material
// ============================
async function verLotes(idMaterial) {
    try {
        mostrarSeccion('vistaLotes');
        const material = materialData.find(m=>m.id_mp==idMaterial);
        document.getElementById('tituloLotes').textContent = `Lotes de ${material?.nombre || 'Material'}`;

        const { data: lotes, error: errorLotes } = await supabaseClient.from('lote_mp').select('*').eq('id_mp', idMaterial);
        if(errorLotes) throw errorLotes;

        const idsProveedores = [...new Set(lotes.map(l=>l.id_proveedor))];
        const { data: proveedores, error: errorProv } = await supabaseClient.from('proveedor').select('id_proveedor,nombre').in('id_proveedor', idsProveedores);
        if(errorProv) throw errorProv;

        const tbody = document.querySelector('#tablaLotes tbody');
        tbody.innerHTML = '';

        lotes.forEach(lote => {
            const nomProveedor = proveedores.find(p=>p.id_proveedor===lote.id_proveedor)?.nombre || '';
            const tr = document.createElement('tr');
            tr.innerHTML = `   
                <td data-label="ID Lote">${lote.id_lote}</td>
                <td data-label="Lote">${lote.lote}</td>
                <td data-label="Cantidad">${lote.cantidad_disponible}</td>
                <td data-label="Fecha Ingreso">${lote.fecha_ingreso}</td>
                <td data-label="Fecha Caducidad">${lote.fecha_caducidad}</td>
                <td data-label="Estado">${lote.estado}</td>
                <td data-label="Cant Disponible">${lote.cantidad_disponible}</td>
                <td data-label="Cant Reservada">${lote.cantidad_reservada}</td>
                <td data-label="Proveedor">${nomProveedor}</td>
      <td><button class="btn-editar-lote" data-id="${lote.id_lote}">Editar</button></td>
            `;
            tbody.appendChild(tr);
        });
        // Activar botones de editar
  document.querySelectorAll(".btn-editar-lote").forEach(btn => {
    btn.addEventListener("click", e => abrirModal(e.target.dataset.id));
  });
    
    
    } catch(err) {
        console.error("Error mostrando lotes:", err);
    }
}

// ============================
// Volver a vista material
// ============================
function volverMateriales() {
    document.getElementById('vistaLotes').style.display = 'none';
    document.getElementById('vistaMateriales').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', cargarMateriales);

////////////////////////////////////////// Editar lote_mp
const modal = document.getElementById("modalEditar");
const form = document.getElementById("formEditar");
const btnCancelar = document.getElementById("btnCancelar2");

// === ABRIR MODAL Y CARGAR DATOS ===
async function abrirModal(idLote) {
  const { data, error } = await supabaseClient.from("lote_mp").select("*").eq("id_lote", idLote).single();
  if (error) {
    alert("❌ Error al cargar el lote seleccionado");
    console.error(error);
    return;
  }

  document.getElementById("editIdLote").value = data.id_lote;
  document.getElementById("editLote").value = data.lote;
  document.getElementById("editCantidad").value = data.cantidad;
  document.getElementById("editFechaCad").value = data.fecha_caducidad;
  document.getElementById("editEstado").value = data.estado;
  document.getElementById("editDisponible").value = data.cantidad_disponible;
  document.getElementById("editConsumida").value = data.cantidad_consumida;
  document.getElementById("editReservada").value = data.cantidad_reservada;

  modal.style.display = "flex";
}
// === CERRAR MODAL ===
btnCancelar.addEventListener("click", () => {
  modal.style.display = "none";
});

// === GUARDAR CAMBIOS ===
form.addEventListener("submit", async e => {
  e.preventDefault();

  const idLote = document.getElementById("editIdLote").value;
  const updates = {
    cantidad: parseFloat(document.getElementById("editCantidad").value),
    fecha_caducidad: document.getElementById("editFechaCad").value,
    estado: document.getElementById("editEstado").value,
    cantidad_disponible: parseFloat(document.getElementById("editDisponible").value),
    cantidad_consumida: parseFloat(document.getElementById("editConsumida").value),
    cantidad_reservada: parseFloat(document.getElementById("editReservada").value),
  };

  const { error } = await supabaseClient.from("lote_mp").update(updates).eq("id_lote", idLote);

  if (error) {
    alert("❌ Error al actualizar el lote");
    console.error(error);
  } else {
    alert("✅ Lote actualizado correctamente");
    modal.style.display = "none";
    location.reload();
  }
});
