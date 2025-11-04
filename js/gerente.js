console.log("Iniciando Dashboard Área TI...");

// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ================== Cerrar sesión ==================
function cerrarSesion() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "index.html";
}

// ================== Cargar KPIs ==================
async function cargarKPIs() {
    try {
        // Total usuarios activos/inactivos
        const { data: usuarios, error: errUsuarios } = await supabaseClient
            .from('usuarios')
            .select('id, name, estado, area, created_at');
        if (errUsuarios) throw errUsuarios;

        const activos = usuarios.filter(u => u.estado === 'Activo').length;
        const inactivos = usuarios.length - activos;

        document.getElementById('totalUsuariosActivos').innerText = activos;
        document.getElementById('totalUsuariosInactivos').innerText = inactivos;

        // Usuarios nuevos últimos 30 días
        const fecha30 = new Date();
        fecha30.setDate(fecha30.getDate() - 30);
        const nuevos = usuarios.filter(u => new Date(u.created_at) >= fecha30).length;
        document.getElementById('usuariosNuevosMes').innerText = nuevos;

        // Accesos
        const { data: accesos, error: errAccesos } = await supabaseClient
            .from('accesos')
            .select('usuario_id, tipo, accion, fecha_hora');
        if (errAccesos) throw errAccesos;

        // Usuarios sin acceso
        const usuariosConAcceso = new Set(accesos.map(a => a.usuario_id));
        const sinAcceso = usuarios.filter(u => !usuariosConAcceso.has(u.id)).length;
        document.getElementById('usuariosSinAcceso').innerText = sinAcceso;

        // Total accesos
        document.getElementById('totalAccesos').innerText = accesos.length;

        return { usuarios, accesos };

    } catch (err) {
        console.error("Error cargando KPIs:", err);
        alert("No se pudieron cargar los KPIs de usuarios.");
        return { usuarios: [], accesos: [] };
    }
}

// ================== Generar gráficos ==================
function generarGraficos(usuarios, accesos) {
    // Usuarios por área
    const areaCounts = {};
    usuarios.forEach(u => {
        const area = u.area || 'Sin área';
        areaCounts[area] = (areaCounts[area] || 0) + 1;
    });
    new Chart(document.getElementById('usuariosAreaChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(areaCounts),
            datasets: [{
                label: 'Cantidad de usuarios',
                data: Object.values(areaCounts),
                backgroundColor: '#4caf50'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });

    // Accesos por tipo de acción
    const tipoCounts = {};
    accesos.forEach(a => {
        const t = a.accion || 'Desconocido';
        tipoCounts[t] = (tipoCounts[t] || 0) + 1;
    });
    new Chart(document.getElementById('accesosTipoChart'), {
        type: 'pie',
        data: {
            labels: Object.keys(tipoCounts),
            datasets: [{
                label: 'Accesos',
                data: Object.values(tipoCounts),
                backgroundColor: ['#2196f3','#ff9800','#f44336','#9c27b0','#00bcd4']
            }]
        },
        options: { responsive: true }
    });

    // Accesos por fecha últimos 30 días
    const fechaCounts = {};
    const hoy = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(hoy);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        fechaCounts[key] = 0;
    }
    accesos.forEach(a => {
        const key = new Date(a.fecha_hora).toISOString().split('T')[0];
        if (key in fechaCounts) fechaCounts[key]++;
    });
    new Chart(document.getElementById('accesosFechaChart'), {
        type: 'line',
        data: {
            labels: Object.keys(fechaCounts),
            datasets: [{
                label: 'Accesos diarios',
                data: Object.values(fechaCounts),
                borderColor: '#ff5722',
                backgroundColor: 'rgba(255,87,34,0.2)',
                fill: true,
            }]
        },
        options: { responsive: true }
    });

    // Top 5 usuarios más activos
    const accesosPorUsuario = {};
    accesos.forEach(a => {
        accesosPorUsuario[a.usuario_id] = (accesosPorUsuario[a.usuario_id] || 0) + 1;
    });
    const topUsuarios = Object.entries(accesosPorUsuario)
        .sort((a,b) => b[1]-a[1])
        .slice(0,5)
        .map(([id, count]) => {
            const u = usuarios.find(x => x.id == id);
            return { name: u ? u.name : `ID ${id}`, count };
        });

    const tbody = document.querySelector('#topUsuariosTable tbody');
    tbody.innerHTML = '';
    topUsuarios.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${u.name}</td><td>${u.count}</td>`;
        tbody.appendChild(tr);
    });
}

// ================== Inicialización ==================
document.addEventListener('DOMContentLoaded', async () => {
    const { usuarios, accesos } = await cargarKPIs();
    generarGraficos(usuarios, accesos);
});
