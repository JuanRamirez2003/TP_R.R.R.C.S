console.log("Iniciando aplicación de Compras...");

// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ================== Variables ==================
let materiaPrimaData = [];
let proveedorData = [];

// ================== Inicialización EmailJS ==================
if (typeof emailjs !== 'undefined') {
    emailjs.init("SJ34lI1ytF8WPEMSi"); // Tu Public Key
} else {
    console.warn("EmailJS no cargado. Revisa tu <script> en HTML.");
}

// ================== Funciones ==================
async function cargarMaterias() {
    try {
        const { data, error } = await supabaseClient.from('materia_prima').select('*');
        if (error) throw error;

        materiaPrimaData = data || [];
        const select = document.getElementById('materiaSelect');
        select.innerHTML = "<option value=''>Seleccione...</option>";

        materiaPrimaData.forEach(mp => {
            const opt = document.createElement('option');
            opt.value = mp.id_mp;
            opt.textContent = mp.nombre;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error("Error cargando materias:", err);
    }
}

async function cargarProveedores(id_mp) {
    try {
        const proveedorSelect = document.getElementById('proveedorSelect');
        proveedorSelect.innerHTML = "<option value=''>Seleccione...</option>";
        if (!id_mp) return;

        const { data: relaciones, error: errRel } = await supabaseClient
            .from('materiaprima_proveedor')
            .select('id_proveedor')
            .eq('id_mp', id_mp);
        if (errRel) throw errRel;

        if (relaciones.length > 0) {
            const idsProveedores = relaciones.map(r => r.id_proveedor);
            const { data: proveedores, error: errProv } = await supabaseClient
                .from('proveedor')
                .select('*')
                .in('id_proveedor', idsProveedores);
            if (errProv) throw errProv;

            proveedorData = proveedores;
            proveedores.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id_proveedor;
                opt.textContent = p.nombre;
                proveedorSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error cargando proveedores:", err);
    }
}

// ================== Eventos ==================
document.getElementById('materiaSelect').addEventListener('change', e => {
    cargarProveedores(e.target.value);
});

document.getElementById('pedidoForm').addEventListener('submit', async e => {
    e.preventDefault();

    const materiaSelect = document.getElementById('materiaSelect');
    const proveedorSelect = document.getElementById('proveedorSelect');
    const cantidadInput = document.getElementById('cantidad');
    const mensajeError = document.getElementById('mensajeError');
    const mensajeExito = document.getElementById('mensajeExito');

    if (!materiaSelect.value || !proveedorSelect.value || !cantidadInput.value) {
        mensajeError.textContent = "Complete todos los campos correctamente.";
        mensajeError.style.display = "block";
        return;
    }

    const cantidad = parseInt(cantidadInput.value);
    if (cantidad <= 0) {
        mensajeError.textContent = "La cantidad debe ser mayor a 0.";
        mensajeError.style.display = "block";
        return;
    }

    try {
        const materia = materiaSelect.selectedOptions[0].textContent;
        const proveedor = proveedorSelect.selectedOptions[0].textContent;

        // --- Guardar en Supabase ---
        const { data, error } = await supabaseClient
            .from('orden_compra_mp')
            .insert([{ materia_prima: materia, proveedor: proveedor, cantidad, estado: 'Pendiente' }]);
        if (error) throw error;

        // --- Mensajes ---
        mensajeExito.style.display = "block";
        mensajeError.style.display = "none";
        e.target.reset();
        proveedorSelect.innerHTML = "<option value=''>Seleccione una materia primero</option>";

        // --- Actualizar tabla ---
        cargarTablaPedidos();
        mostrarSeccion('vistaPedidos');

        // --- Enviar email ---
        if (typeof emailjs !== 'undefined') {
            emailjs.send('service_n3qcy6p', 'template_80elrdn', {
                materia_prima: materia,
                proveedor: proveedor,
                cantidad: cantidad,
                estado: 'Pendiente'
            }).then(() => {
                console.log("Email enviado correctamente");
            }).catch(err => {
                console.error("Error enviando email:", err);
            });
        } else {
            console.warn("EmailJS no cargado. No se pudo enviar el email.");
        }

    } catch (err) {
        console.error("Error guardando pedido:", err);
        mensajeError.textContent = "Error al enviar el pedido. Revisa consola.";
        mensajeError.style.display = "block";
    }
});

// ================== Tabla Pedidos ==================
async function cargarTablaPedidos() {
    try {
        const { data, error } = await supabaseClient.from('orden_compra_mp').select('*');
        if (error) throw error;

        const tbody = document.querySelector("#tablaPedidos tbody");
        tbody.innerHTML = "";

        if (!data || data.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5'>No hay pedidos aún.</td></tr>";
            return;
        }

        data.forEach(d => {
            const color = d.estado === 'Pendiente' ? 'orange' : d.estado === 'Aprobado' ? 'green' : 'red';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.id}</td>
                <td>${d.materia_prima}</td>
                <td>${d.proveedor}</td>
                <td>${d.cantidad}</td>
                <td style="color:${color}; font-weight:bold;">${d.estado}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error cargando tabla de pedidos:", err);
    }
}

// ================== Navegación ==================
function mostrarSeccion(id) {
    document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
    document.getElementById(id).style.display = 'block';
}

// ================== Inicialización ==================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarMaterias();
    await cargarTablaPedidos();
    mostrarSeccion('pedidoMP');
});
