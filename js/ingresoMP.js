let materiaPrimaData = [];

// ============================
// Utilidades
// ============================
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
            if(sec.id === 'ingresoMP') {
                const form = sec.querySelector('form');
                if(form) form.reset();
                habilitarCampos(['lote', 'cantidad', 'fecha_ingreso', 'fecha_cad', 'estado', 'provMP'], false);
                resetSelect('provMP');
            }
        });

        const target = document.getElementById(seccionId);
        if(target) target.style.display = 'block';
        if(seccionId === 'vistaMP') cargarMP();
    } catch(err) {
        console.error("Error mostrando sección:", err);
    }
}

// ============================
// Cargar Materia Prima
// ============================
async function cargarMateriaPrima() {
    try {
        const { data, error } = await supabaseClient.from('materia_prima').select('*');
        if (error) throw error;

        materiaPrimaData = data || [];

        const select = document.getElementById('id_mp');
        if (select) {
            resetSelect('id_mp');
            materiaPrimaData.forEach(mp => {
                const option = document.createElement('option');
                option.value = mp.id_mp;
                option.textContent = mp.nombre;
                select.appendChild(option);
            });
        }
    } catch(err) {
        console.error("Error cargando materia prima:", err);
    }
}

// ============================
// Mostrar datos al seleccionar MP
// ============================
async function mostrarDatosMP() {
    try {
        const id = document.getElementById('id_mp').value;
        const campos = ['lote', 'cantidad', 'fecha_ingreso', 'fecha_cad', 'estado'];
        const mp = materiaPrimaData.find(item => item.id_mp == id);

        if (!mp) {
            campos.forEach(c => document.getElementById(c).disabled = true);
            habilitarCampos(['provMP'], false);
            resetSelect('provMP');
            document.getElementById('descMP').value = '';
            document.getElementById('unidadMP').value = '';
            return;
        }

        document.getElementById('descMP').value = mp.descr || '';
        document.getElementById('unidadMP').value = mp.unidad || '';

        // Obtener proveedores asociados
        const { data: relaciones, error: errRel } = await supabaseClient
            .from('materiaprima_proveedor')
            .select('id_proveedor')
            .eq('id_mp', id);
        if (errRel) throw errRel;

        resetSelect('provMP');
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
                document.getElementById('provMP').appendChild(option);
            });
        }

        habilitarCampos(campos, true);
        habilitarCampos(['provMP'], true);

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
        console.error("Error mostrando datos MP:", err);
    }
}

// ============================
// Eventos Botones
// ============================
document.getElementById('btnCancelar')?.addEventListener('click', () => {
    const form = document.getElementById('materiaPrimaForm');
    form.reset();
    form.style.display = 'grid';
    document.getElementById('mensajeExito').style.display = 'none';
    habilitarCampos(['lote', 'cantidad', 'fecha_ingreso', 'fecha_cad', 'estado', 'provMP'], false);
    resetSelect('provMP');
    mostrarSeccion('vistaMP');
});

document.getElementById('btnOtroLote')?.addEventListener('click', () => {
    const form = document.getElementById('materiaPrimaForm');
    form.reset();
    form.style.display = 'grid';
    document.getElementById('mensajeExito').style.display = 'none';
    habilitarCampos(['lote', 'cantidad', 'fecha_ingreso', 'fecha_cad', 'estado', 'provMP'], false);
    resetSelect('provMP');
});

document.getElementById('btnVolverPrincipal')?.addEventListener('click', () => {
    document.getElementById('mensajeExito').style.display = 'none';
    mostrarSeccion('vistaMP');
});

// ============================
// Insertar lote
// ============================
document.getElementById('materiaPrimaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const nuevoLote = {
            id_mp: parseInt(document.getElementById('id_mp').value),
            id_proveedor: parseInt(document.getElementById('provMP').value),
            lote: document.getElementById('lote').value,
            cantidad: parseFloat(document.getElementById('cantidad').value),
            fecha_ingreso: document.getElementById('fecha_ingreso').value,
            fecha_caducidad: document.getElementById('fecha_cad').value,
            estado: document.getElementById('estado').value
        };
        const { error } = await supabaseClient.from('lote_mp').insert([nuevoLote]);
        if (error) throw error;

        const form = document.getElementById('materiaPrimaForm');
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
async function cargarMP() {
    try {
        const { data: materias, error } = await supabaseClient.from('materia_prima').select(`*, lote_mp(cantidad)`);
        if (error) throw error;

        const { data: proveedores } = await supabaseClient.from('proveedor').select('id_proveedor,nombre');
        const tbody = document.querySelector('#tablaMP tbody');
        tbody.innerHTML = '';

        materias.forEach(mp => {
            const stock = mp.lote_mp?.reduce((acc,l)=> acc+l.cantidad,0) || 0;
            const nombreProv = proveedores.find(p=>p.id_proveedor===mp.id_proveedor)?.nombre || '';
            const nombreProvSec = proveedores.find(p=>p.id_proveedor===mp.id_proveedorsec)?.nombre || '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${mp.id_mp}</td>
                <td>${mp.nombre}</td>
                <td>${mp.descr}</td>
                <td>${mp.unidad}</td>
                <td>${stock}</td>
                <td>${nombreProv}</td>
                <td>${nombreProvSec}</td>
                <td><button class="btn-editar" onclick="verLotes(${mp.id_mp})">Ver Lotes</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch(err) {
        console.error("Error cargando tabla MP:", err);
    }
}

// ============================
// Ver lotes de una MP
// ============================
async function verLotes(idMP) {
    try {
        mostrarSeccion('vistaLotes');
        const mp = materiaPrimaData.find(m=>m.id_mp==idMP);
        document.getElementById('tituloLotes').textContent = `Lotes de ${mp?.nombre || 'Materia Prima'}`;

        const { data: lotes, error: errorLotes } = await supabaseClient.from('lote_mp').select('*').eq('id_mp', idMP);
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
                <td data-label="Cantidad">${lote.cantidad}</td>
                <td data-label="Fecha Ingreso">${lote.fecha_ingreso}</td>
                <td data-label="Fecha Caducidad">${lote.fecha_caducidad}</td>
                <td data-label="Estado">${lote.estado}</td>
                <td data-label="Cant Disponible">${lote.cantidad_disponible}</td>
                <td data-label="Cant Consumida">${lote.cantidad_consumida}</td>
                <td data-label="Proveedor">${nomProveedor}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch(err) {
        console.error("Error mostrando lotes:", err);
    }
}

// ============================
// Volver a vista MP
// ============================
function volverMP() {
    document.getElementById('vistaLotes').style.display = 'none';
    document.getElementById('vistaMP').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', cargarMateriaPrima);
