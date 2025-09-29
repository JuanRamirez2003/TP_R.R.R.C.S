let materiaPrimaData = [];

function mostrarSeccion(seccionId) {
    const secciones = document.querySelectorAll('.seccion');
    secciones.forEach(sec => sec.style.display = 'none');
    document.getElementById(seccionId).style.display = 'block';
    if (seccionId === 'vistaMP') cargarMP();
}

async function cargarMateriaPrima() {
    // Traer todas las materias primas
    const { data, error } = await supabaseClient
        .from('materia_prima')
        .select('*');

    if (error) {
        console.error(error);
        return;
    }

    materiaPrimaData = data;

    const select = document.getElementById('id_mp');
    select.innerHTML = '<option value="">Seleccione...</option>';
    materiaPrimaData.forEach(mp => {
        const option = document.createElement('option');
        option.value = mp.id_mp;
        option.textContent = mp.nombre;
        select.appendChild(option);
    });
}

async function mostrarDatosMP() {
    const id = document.getElementById('id_mp').value;
    const campos = ['lote', 'cantidad', 'fecha_ingreso', 'fecha_cad', 'estado'];
    const mp = materiaPrimaData.find(item => item.id_mp == id);

    if (mp) {
        document.getElementById('descMP').value = mp.descr;
        document.getElementById('unidadMP').value = mp.unidad;

        const { data: relaciones, error: errRel } = await supabaseClient
            .from('materiaprima_proveedor')
            .select('id_proveedor')
            .eq('id_mp', id);

        const selectProv = document.getElementById('provMP');
        selectProv.innerHTML = '<option value="">Seleccione...</option>';

        if (!errRel && relaciones.length > 0) {
            const idsProveedores = relaciones.map(r => r.id_proveedor);

            const { data: proveedores, error: errProv } = await supabaseClient
                .from('proveedor')
                .select('*')
                .in('id_proveedor', idsProveedores);

            if (!errProv && proveedores) {
                proveedores.forEach(p => {
                    const option = document.createElement('option');
                    option.value = p.id_proveedor;
                    option.textContent = p.nombre;
                    selectProv.appendChild(option);
                });
            } else if (errProv) {
                console.error('Error proveedores:', errProv);
            }
        }

        campos.forEach(c => document.getElementById(c).disabled = false);
        selectProv.disabled = false;
        document.querySelector('.btn-submit').disabled = false;
    } else {
        document.getElementById('descMP').value = '';
        document.getElementById('unidadMP').value = '';
        document.getElementById('provMP').innerHTML = '<option value="">Seleccione...</option>';
        campos.forEach(c => document.getElementById(c).disabled = true);
        document.getElementById('provMP').disabled = true;
        document.querySelector('.btn-submit').disabled = true;
    }
}

// Insertar lote
document.getElementById('materiaPrimaForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nuevoLote = {
        id_mp: parseInt(document.getElementById('id_mp').value),
        id_proveedor: parseInt(document.getElementById('provMP').value),
        lote: document.getElementById('lote').value,
        cantidad: parseFloat(document.getElementById('cantidad').value),
        fecha_ingreso: document.getElementById('fecha_ingreso').value,
        fecha_caducidad: document.getElementById('fecha_cad').value,
        estado: document.getElementById('estado').value
    };

    const { error } = await supabaseClient
        .from('lote_mp')
        .insert([nuevoLote]);

    if (!error) {
        const form = document.getElementById('materiaPrimaForm');
        form.style.display = 'none';
        const mensajeExito = document.getElementById('mensajeExito');
        document.getElementById('textoExito').textContent = "Lote registrado correctamente";
        mensajeExito.style.display = 'block';
    } else {
        console.error(error);
        document.getElementById('mensaje').textContent = "Error al registrar el lote";
    }
});

document.getElementById('btnOtroLote').addEventListener('click', () => {
    const form = document.getElementById('materiaPrimaForm');
    form.reset();
    form.style.display = 'grid';
    document.getElementById('mensajeExito').style.display = 'none';

    const campos = ['lote', 'cantidad', 'fecha_ingreso', 'fecha_cad', 'estado', 'provMP'];
    campos.forEach(c => document.getElementById(c).disabled = true);
    document.querySelector('.btn-submit').disabled = true;
    document.getElementById('provMP').innerHTML = '<option value="">Seleccione...</option>';
});

document.getElementById('btnVolverPrincipal').addEventListener('click', () => {
    document.getElementById('mensajeExito').style.display = 'none';
    mostrarSeccion('vistaMP');
});

async function cargarMP() {
    // Traer materias primas con lotes para calcular stock
    const { data: materias, error } = await supabaseClient
        .from('materia_prima')
        .select(`
            *,
            lote_mp(cantidad)
        `);

    if (error) {
        console.error(error);
        return;
    }

    // Traer todos los proveedores
    const { data: proveedores } = await supabaseClient
        .from('proveedor')
        .select('id_proveedor,nombre');

    const tbody = document.querySelector('#tablaMP tbody');
    tbody.innerHTML = '';

    materias.forEach(mp => {
        const stock = mp.lote_mp?.reduce((acc, l) => acc + l.cantidad, 0) || 0;
        const nombreProv = proveedores.find(p => p.id_proveedor === mp.id_proveedor)?.nombre || '';
        const nombreProvSec = proveedores.find(p => p.id_proveedor === mp.id_proveedorsec)?.nombre || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${mp.id_mp}</td>
            <td>${mp.nombre}</td>
            <td>${mp.descr}</td>
            <td>${mp.unidad}</td>
            <td>${stock}</td>
            <td>${nombreProv}</td>
            <td>${nombreProvSec}</td>
            
            <td><button onclick="verLotes(${mp.id_mp})">Ver Lotes</button></td>
        `;//<td><img src="${mp.img || 'imagenes/default.jpg'}" width="40"></td>
        tbody.appendChild(tr);
    });
}
async function verLotes(idMP) {
    // Ocultar la lista de MP y mostrar la vista de lotes
    document.getElementById('vistaMP').style.display = 'none';
    document.getElementById('vistaLotes').style.display = 'block';

    // Actualizar título dinámico de los lotes
    const mp = materiaPrimaData.find(m => m.id_mp == idMP);
    const nombreMP = mp ? mp.nombre : 'Materia Prima';
    document.getElementById('tituloLotes').textContent = `Lotes de ${nombreMP}`;

    // Traer los lotes de la materia prima
    const { data: lotes, error: errorLotes } = await supabaseClient
        .from('lote_mp')
        .select('*')
        .eq('id_mp', idMP);

    if (errorLotes) {
        console.error(errorLotes);
        return;
    }

    // Traer todos los proveedores que aparezcan en estos lotes
    const idsProveedores = lotes.map(l => l.id_proveedor).filter((v, i, a) => a.indexOf(v) === i); // únicos
    const { data: proveedores, error: errorProv } = await supabaseClient
        .from('proveedor')
        .select('id_proveedor,nombre')
        .in('id_proveedor', idsProveedores);

    if (errorProv) {
        console.error(errorProv);
        return;
    }

    const tbody = document.querySelector('#tablaLotes tbody');
    tbody.innerHTML = '';

    lotes.forEach(lote => {
        const prov = proveedores.find(p => p.id_proveedor === lote.id_proveedor);
        const nomProveedor = prov ? prov.nombre : '';

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
}



function volverMP() {
    document.getElementById('vistaLotes').style.display = 'none';
    document.getElementById('vistaMP').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', cargarMateriaPrima);
