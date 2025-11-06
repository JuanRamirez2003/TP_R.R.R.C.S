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
// ================== Cargar KPIs de Órdenes ==================
async function cargarKPIOrdenes() {
  try {
    const { data: ordenes, error } = await supabaseClient
      .from('orden_produccion')
      .select('id_orden_produccion, estado, fecha_emision, prioridad, fecha_estimada_entrega');

    if (error) throw error;

    const total = ordenes.length;
    const completadas = ordenes.filter(o => o.estado?.toLowerCase().includes('final')).length;
    const prioridadAlta = ordenes.filter(o => o.prioridad?.toLowerCase() === 'alta').length;
    const pendientes = ordenes.filter(o => !o.estado?.toLowerCase().includes('final')).length;

    document.getElementById('totalOrdenes').innerText = total;
    document.getElementById('ordenesCompletadas').innerText = completadas;
    document.getElementById('ordenesPrioridadAlta').innerText = prioridadAlta;
    document.getElementById('ordenesPendientes').innerText = pendientes;

    generarGraficosOrdenes(ordenes);

  } catch (err) {
    console.error("Error cargando KPIs de órdenes:", err);
    alert("No se pudieron cargar los KPIs de órdenes.");
  }
}

// ================== Generar gráficos de Órdenes ==================
function generarGraficosOrdenes(ordenes) {
  // 1. Órdenes por estado
  const estadoCounts = {};
  ordenes.forEach(o => {
    const e = o.estado || 'Sin estado';
    estadoCounts[e] = (estadoCounts[e] || 0) + 1;
  });
  new Chart(document.getElementById('ordenesEstadoChart'), {
    type: 'bar',
    data: {
      labels: Object.keys(estadoCounts),
      datasets: [{
        label: 'Órdenes',
        data: Object.values(estadoCounts),
        backgroundColor: '#4caf50'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }
    }
  });

  // 2. Órdenes por prioridad
  const prioridadCounts = { baja: 0, normal: 0, alta: 0, urgente: 0 };
  ordenes.forEach(o => {
    const p = (o.prioridad || 'normal').toLowerCase();
    if (prioridadCounts[p] !== undefined) prioridadCounts[p]++;
    else prioridadCounts[p] = 1;
  });
  new Chart(document.getElementById('ordenesPrioridadChart'), {
    type: 'pie',
    data: {
      labels: Object.keys(prioridadCounts),
      datasets: [{
        data: Object.values(prioridadCounts),
        backgroundColor: ['#4caf50','#2196f3','#f44336','#9c27b0']
      }]
    },
    options: { responsive: true }
  });

  // 3. Órdenes por fecha (últimos 30 días)
  const fechaCounts = {};
  const hoy = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    fechaCounts[key] = 0;
  }
  ordenes.forEach(o => {
    if (!o.fecha_emision) return;
    const key = new Date(o.fecha_emision).toISOString().split('T')[0];
    if (key in fechaCounts) fechaCounts[key]++;
  });
  new Chart(document.getElementById('ordenesFechaChart'), {
    type: 'line',
    data: {
      labels: Object.keys(fechaCounts),
      datasets: [{
        label: 'Órdenes emitidas',
        data: Object.values(fechaCounts),
        borderColor: '#ff9800',
        backgroundColor: 'rgba(255,152,0,0.2)',
        fill: true,
      }]
    },
    options: { responsive: true }
  });
}
// ===================== DASHBOARD CLIENTES =====================
async function cargarDashboardClientes() {
  try {
    // --- Tablas base ---
    const { data: clientes, error: errClientes } = await supabaseClient
      .from('clientes')
      .select('id_cliente, nombre, estado, fecha_creacion, tipo_cliente');
    if (errClientes) throw errClientes;

    const { data: facturas, error: errFacturas } = await supabaseClient
      .from('factura')
      .select('id_cliente, total, fecha');
    if (errFacturas) throw errFacturas;

    // ==================== KPIs ====================
    const total = clientes.length;
    const activos = clientes.filter(c => (c.estado || '').toLowerCase() === 'activo').length;

    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    const nuevos = clientes.filter(c => c.fecha_creacion && new Date(c.fecha_creacion) >= hace30).length;

    const clientesConFacturas = new Set(facturas.map(f => f.id_cliente));
    const conCompras = clientes.filter(c => clientesConFacturas.has(c.id_cliente)).length;
    const sinCompras = total - conCompras;

    const totalesPorCliente = {};
    facturas.forEach(f => {
      if (!f.id_cliente || !f.total) return;
      totalesPorCliente[f.id_cliente] = (totalesPorCliente[f.id_cliente] || 0) + Number(f.total);
    });

    const ticketPromedio = Object.values(totalesPorCliente).length
      ? Object.values(totalesPorCliente).reduce((a,b)=>a+b,0) / Object.values(totalesPorCliente).length
      : 0;

    // Mostrar KPIs
    document.getElementById('kpiTotalClientes').innerText = total;
    document.getElementById('kpiClientesActivos').innerText = activos;
    document.getElementById('kpiClientesNuevos').innerText = nuevos;
    document.getElementById('kpiClientesConCompras').innerText = conCompras;
    document.getElementById('kpiTicketPromedio').innerText = `$ ${ticketPromedio.toFixed(2)}`;
    document.getElementById('kpiClientesSinCompras').innerText = sinCompras;

    // ==================== GRÁFICOS ====================
    generarGraficosClientes(clientes, facturas);

  } catch (err) {
    console.error("Error cargando dashboard de clientes:", err);
  }
}

// -------------------- Generar Gráficos --------------------
function generarGraficosClientes(clientes, facturas) {

  // 1️⃣ Clientes por tipo
  const tipoCounts = {};
  clientes.forEach(c => {
    const tipo = c.tipo_cliente || 'Sin tipo';
    tipoCounts[tipo] = (tipoCounts[tipo] || 0) + 1;
  });
  new Chart(document.getElementById('chartClientesTipo'), {
    type: 'pie',
    data: { labels: Object.keys(tipoCounts),
      datasets: [{ data: Object.values(tipoCounts), backgroundColor: ['#42a5f5','#66bb6a','#ffa726','#ab47bc','#ef5350'] }] },
    options: { responsive: true }
  });

  // 2️⃣ Clientes por estado
  const estadoCounts = {};
  clientes.forEach(c => {
    const e = c.estado || 'Sin estado';
    estadoCounts[e] = (estadoCounts[e] || 0) + 1;
  });
  new Chart(document.getElementById('chartClientesEstado'), {
    type: 'bar',
    data: {
      labels: Object.keys(estadoCounts),
      datasets: [{ label: 'Clientes', data: Object.values(estadoCounts), backgroundColor: '#26c6da' }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });

  // 3️⃣ Altas últimas 30 días
  const fechaCounts = {};
  const hoy = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    fechaCounts[d.toISOString().split('T')[0]] = 0;
  }
  clientes.forEach(c => {
    if (!c.fecha_creacion) return;
    const f = new Date(c.fecha_creacion).toISOString().split('T')[0];
    if (fechaCounts[f] !== undefined) fechaCounts[f]++;
  });
  new Chart(document.getElementById('chartClientesAltas'), {
    type: 'line',
    data: {
      labels: Object.keys(fechaCounts),
      datasets: [{
        label: 'Altas',
        data: Object.values(fechaCounts),
        borderColor: '#ff7043',
        backgroundColor: 'rgba(255,112,67,0.2)',
        fill: true
      }]
    },
    options: { responsive: true }
  });

  // 4️⃣ Top 10 por facturación
  const totalesPorCliente = {};
  facturas.forEach(f => {
    if (!f.id_cliente || !f.total) return;
    totalesPorCliente[f.id_cliente] = (totalesPorCliente[f.id_cliente] || 0) + Number(f.total);
  });
  const top = Object.entries(totalesPorCliente)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,10)
    .map(([id, total])=>{
      const c = clientes.find(x=>x.id_cliente==id);
      return { nombre: c ? c.nombre : `ID ${id}`, total };
    });

  new Chart(document.getElementById('chartTopClientes'), {
    type: 'bar',
    data: {
      labels: top.map(c=>c.nombre),
      datasets: [{ label: 'Total Facturado', data: top.map(c=>c.total), backgroundColor: '#8e24aa' }]
    },
    options: { responsive: true, plugins: { legend: { display:false } }, indexAxis: 'y' }
  });

  // 5️⃣ Nuevos vs Recurrentes últimos 6 meses
  const meses = [];
  const hoy2 = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(hoy2.getFullYear(), hoy2.getMonth()-i, 1);
    const key = m.toISOString().slice(0,7);
    meses.push(key);
  }
  const facturasPorCliente = {};
  facturas.forEach(f=>{
    if (!f.id_cliente || !f.fecha) return;
    const mes = new Date(f.fecha).toISOString().slice(0,7);
    facturasPorCliente[f.id_cliente] = facturasPorCliente[f.id_cliente] || {};
    facturasPorCliente[f.id_cliente][mes] = (facturasPorCliente[f.id_cliente][mes]||0)+1;
  });

  const nuevosMes = {};
  const recurrentesMes = {};
  meses.forEach(m=>{
    nuevosMes[m]=0; recurrentesMes[m]=0;
  });
  for (const [id, compras] of Object.entries(facturasPorCliente)) {
    const ordenados = Object.keys(compras).sort();
    ordenados.forEach((mes,i)=>{
      if (nuevosMes[mes]!==undefined){
        if (i===0) nuevosMes[mes]++;
        else recurrentesMes[mes]++;
      }
    });
  }

  new Chart(document.getElementById('chartClientesRecurrentes'), {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [
        { label:'Nuevos', data: Object.values(nuevosMes), backgroundColor:'#4caf50' },
        { label:'Recurrentes', data: Object.values(recurrentesMes), backgroundColor:'#42a5f5' }
      ]
    },
    options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
  });
}

// Inicializar
document.addEventListener('DOMContentLoaded', async ()=> {
  await cargarDashboardClientes();
});


// ================== Inicializar sección Órdenes ==================
document.addEventListener('DOMContentLoaded', async () => {
  await cargarKPIOrdenes();
});
// ================== Inicialización ==================
document.addEventListener('DOMContentLoaded', async () => {
    const { usuarios, accesos } = await cargarKPIs();
    generarGraficos(usuarios, accesos);
});
