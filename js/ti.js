console.log("Iniciando Panel de TI...");

// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
console.log("Iniciando Panel de TI...");


// ================== Cerrar sesión ==================
window.cerrarSesion = function () {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "index.html";
}

// ================== Cargar auditoría ==================
async function cargarAuditoria() {
    const container = document.getElementById('auditoriaContainer');
    const tbody = document.querySelector('#auditoriaTable tbody');
    tbody.innerHTML = ''; // limpiar tabla

    try {
        // Traer todos los registros de auditoría
        const { data, error } = await supabaseClient
            .from('auditoria')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) throw error;

        // Traer todos los usuarios para mapear nombre y rol
        const { data: usuarios, error: errorUsuarios } = await supabaseClient
            .from('usuarios')
            .select('id, name, area');

        if (errorUsuarios) throw errorUsuarios;

        // Crear mapa de usuarios por ID
        const mapaUsuarios = {};
        usuarios.forEach(u => {
            mapaUsuarios[u.id] = {
                nombre: u.name,
                rol: u.area
            };
        });

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">No hay registros</td></tr>';
            container.style.display = 'block';
            return;
        }

        data.forEach((row, index) => {
            const usuario = mapaUsuarios[row.usuario]?.nombre || 'Sistema';
            const rol = mapaUsuarios[row.usuario]?.rol || 'Sistema';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id ?? ''}</td>
                <td>${row.tabla ?? ''}</td>
                <td>${row.operacion ?? ''}</td>
                <td>${usuario}</td>
                <td>${rol}</td>
                <td>${row.fecha ? new Date(row.fecha).toLocaleString() : ''}</td>
                <td><button class="btn-ver" data-index="${index}">Ver</button></td>
            `;
                    tbody.appendChild(tr);
        });
        //<td>${row.usuario ?? ''}</td>   //COMO ESTBA ANTES
        //<td>${row.rol ?? ''}</td>
        
        container.style.display = 'block';

        // Agregar eventos a los botones "Ver"
        document.querySelectorAll('.btn-ver').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const i = e.target.dataset.index;
                mostrarModal(data[i]);
            });
        });

    } catch (err) {
        console.error('Error al cargar auditoría:', err.message);
        alert('No se pudo cargar la tabla de auditoría.');
    }
}
// ================== Modal Detalle ==================
function mostrarModal(registro) {
    const modal = document.getElementById('modalDetalle');
    const modalBody = document.getElementById('modalBody');

    // Crear contenido del registro en formato limpio
    let detalleHTML = '';
    if (registro.registro && typeof registro.registro === 'object') {
        detalleHTML += '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">';
        for (const [key, value] of Object.entries(registro.registro)) {
            detalleHTML += `
                <div style="
                    background:#f0f0f0;
                    padding:8px 12px;
                    border-radius:6px;
                    font-family:sans-serif;
                    color:#111;
                ">
                    <strong>${key}:</strong> ${value ?? ''}
                </div>
            `;
        }
        detalleHTML += '</div>';
    } else {
        detalleHTML = '<p style="color:#333;">No hay detalles disponibles</p>';
    }

    modalBody.innerHTML = `
        <div style="
            font-family:sans-serif;
            color:#222;
            padding:20px;
            background:#fff;
            border-radius:10px;
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
        ">
            <h3 style="margin-top:0; color:#111;">Detalle de Auditoría</h3>
            <p><strong>ID:</strong> ${registro.id ?? ''}</p>
            <p><strong>Tabla:</strong> ${registro.tabla ?? ''}</p>
            <p><strong>Operación:</strong> ${registro.operacion ?? ''}</p>
            <p><strong>Usuario:</strong> ${registro.usuario ?? ''}</p>
            <p><strong>Rol:</strong> ${registro.rol ?? ''}</p>
            <p><strong>Fecha:</strong> ${registro.fecha ? new Date(registro.fecha).toLocaleString() : ''}</p>
            <hr>
            <p><strong>Registro:</strong></p>
            ${detalleHTML}
        </div>
    `;

    modal.style.display = 'flex';
}


function cerrarModal() {
    document.getElementById('modalDetalle').style.display = 'none';
}

// ================== Buscador ==================
function filtrarTabla() {
    const input = document.getElementById('buscador').value.toLowerCase();
    const rows = document.querySelectorAll('#auditoriaTable tbody tr');

    rows.forEach(row => {
        const texto = row.innerText.toLowerCase();
        row.style.display = texto.includes(input) ? '' : 'none';
    });
}

// ================== Listeners ==================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnOpcion1').addEventListener('click', cargarAuditoria);
    document.getElementById('buscador').addEventListener('input', filtrarTabla);
    document.getElementById('cerrarModal').addEventListener('click', cerrarModal);
});
