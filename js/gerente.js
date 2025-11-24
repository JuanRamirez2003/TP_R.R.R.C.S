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
/* ================ Cargar datos y KPIs ================ */
async function cargarProduccionYProveedores(){
  try {
    // Traer líneas de producción
    const { data: lineas, error: errLineas } = await supabaseClient
      .from('linea_produccion')
      .select('id, id_producto, duracion, id_linea, horas_jornada, eficiencia, estado, capacidad_diaria');
    if (errLineas) throw errLineas;

    // Traer proveedores
    const { data: proveedores, error: errProv } = await supabaseClient
      .from('proveedor')
      .select('id_proveedor, nombre, estado, fecha_creacion, puntaje, tipo_proveedor');
    if (errProv) throw errProv;

    // Traer lotes
    const { data: lotes, error: errLotes } = await supabaseClient
      .from('lote_mp')
      .select('id_lote, id_mp, lote, cantidad, cantidad_disponible, cantidad_consumida, cantidad_reservada, fecha_ingreso, fecha_caducidad, estado, id_proveedor');
    if (errLotes) throw errLotes;

    // Traer relaciones materia-prveedor y productos para nombres
    const { data: mprov, error: errMProv } = await supabaseClient
      .from('materiaprima_proveedor')
      .select('id_mp, id_proveedor');
    if (errMProv) throw errMProv;

    const { data: productos, error: errProductos } = await supabaseClient
      .from('productos')
      .select('id_producto, nombre');
    if (errProductos) throw errProductos;

    // KPIs calculados
    const lineasActivas = lineas.filter(l=> (l.estado||'').toLowerCase()==='activa').length;
    const eficienciaVals = lineas.filter(l=> typeof l.eficiencia === 'number' || !isNaN(Number(l.eficiencia))).map(l=>Number(l.eficiencia));
    const eficienciaProm = eficienciaVals.length ? (eficienciaVals.reduce((a,b)=>a+b,0)/eficienciaVals.length) : 0;
    const capacidadTotal = lineas.reduce((s,l)=> s + (Number(l.capacidad_diaria) || 0), 0);
    const duracionVals = lineas.filter(l=> l.duracion !== null && l.duracion !== undefined).map(l=>Number(l.duracion));
    const duracionProm = duracionVals.length ? Math.round(duracionVals.reduce((a,b)=>a+b,0)/duracionVals.length) : 0;

    const proveedoresActivos = proveedores.filter(p=> (p.estado||'').toLowerCase()==='activo').length;
    const lotesTotales = lotes.length;
    const stockDisponible = lotes.reduce((s,l)=> s + (Number(l.cantidad_disponible) || 0), 0);
    const hoy = new Date();
    const lotesVencidos = lotes.filter(l=> l.fecha_caducidad && new Date(l.fecha_caducidad) < hoy).length;

    // Mostrar KPIs
    document.getElementById('kpiLineasActivas').innerText = lineasActivas;
    document.getElementById('kpiEficienciaProm').innerText = `${eficienciaProm.toFixed(1)}%`;
    document.getElementById('kpiCapacidadDiaria').innerText = capacidadTotal;
    document.getElementById('kpiDuracionProm').innerText = duracionProm;
    document.getElementById('kpiProveedoresActivos').innerText = proveedoresActivos;
    document.getElementById('kpiLotesTotales').innerText = lotesTotales;
    document.getElementById('kpiStockDisponible').innerText = stockDisponible;
    document.getElementById('kpiLotesVencidos').innerText = lotesVencidos;

    // Llenar tabla de lotes
    const tbody = document.getElementById('tablaLotes');
    tbody.innerHTML = '';
    for (const l of lotes.slice(0,200)) { // limita 200 filas para rendimiento
      const prov = proveedores.find(p=> p.id_proveedor == l.id_proveedor);
      const mp = productos.find(p=> p.id_producto == l.id_mp);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td style="padding:8px">${l.lote}</td><td style="padding:8px">${mp ? mp.nombre : l.id_mp}</td><td style="padding:8px">${prov ? prov.nombre : (l.id_proveedor || '-')}</td><td style="padding:8px">${l.cantidad_disponible ?? 0}</td><td style="padding:8px">${l.estado}</td><td style="padding:8px">${l.fecha_caducidad ?? ''}</td>`;
      tbody.appendChild(tr);
    }

    // Generar gráficos
    generarGraficosProduccion({
      lineas, proveedores, lotes, mprov, productos
    });

  } catch (err) {
    console.error("Error cargando producción y proveedores:", err);
    alert("No se pudieron cargar los datos de producción.");
  }
}

/* ================ Generar gráficos ================ */
function generarGraficosProduccion({ lineas, proveedores, lotes, mprov, productos }) {
  // Eficiencia por línea (mostrar top 20)
  const eficienciaMap = {};
  lineas.forEach(l=>{
    const key = l.id_linea || `Linea ${l.id}`;
    eficienciaMap[key] = (eficienciaMap[key] || []).concat( (l.eficiencia === null || l.eficiencia === undefined) ? [] : [Number(l.eficiencia)] );
  });
  const eficienciaArr = Object.entries(eficienciaMap).map(([k,arr])=> ({k, avg: arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0}));
  eficienciaArr.sort((a,b)=> b.avg - a.avg);
  const topEficiencia = eficienciaArr.slice(0,20);
  new Chart(document.getElementById('chartEficienciaLinea'), {
    type: 'bar',
    data: { labels: topEficiencia.map(x=>x.k), datasets: [{ label:'Eficiencia %', data: topEficiencia.map(x=>x.avg), backgroundColor:'#4caf50' }] },
    options: { responsive:true, plugins:{ legend:{ display:false } } }
  });

  // Capacidad diaria por línea (top 20)
  const capacidadMap = {};
  lineas.forEach(l=>{
    const key = l.id_linea || `Linea ${l.id}`;
    capacidadMap[key] = (capacidadMap[key] || 0) + (Number(l.capacidad_diaria) || 0);
  });
  const capacidadArr = Object.entries(capacidadMap).map(([k,v])=>({k,v})).sort((a,b)=> b.v - a.v).slice(0,20);
  new Chart(document.getElementById('chartCapacidadLinea'), {
    type: 'bar',
    data: { labels: capacidadArr.map(x=>x.k), datasets: [{ label:'Capacidad', data: capacidadArr.map(x=>x.v), backgroundColor:'#1e88e5' }] },
    options: { responsive:true, plugins:{ legend:{ display:false } } }
  });

  // Stock por materia prima (sum cantidad_disponible por id_mp) top 20
  const stockMP = {};
  lotes.forEach(l=> { stockMP[l.id_mp] = (stockMP[l.id_mp] || 0) + (Number(l.cantidad_disponible) || 0); });
  const stockArr = Object.entries(stockMP).map(([id,v])=> ({ id, v, nombre: (productos.find(p=>p.id_producto==id)?.nombre || id) })).sort((a,b)=> b.v - a.v).slice(0,20);
  new Chart(document.getElementById('chartStockMP'), {
    type: 'bar',
    data: { labels: stockArr.map(x=>x.nombre), datasets: [{ label:'Stock disponible', data: stockArr.map(x=>x.v), backgroundColor:'#ffb300' }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, indexAxis: 'y' }
  });

  // Conformidad de lotes
  const conformidad = { 'Conforme':0, 'No Conforme':0, 'Otro':0 };
  lotes.forEach(l=>{
    const e = l.estado || 'Otro';
    if (e === 'Conforme') conformidad.Conforme++;
    else if (e === 'No Conforme') conformidad['No Conforme']++;
    else conformidad.Otro++;
  });
  new Chart(document.getElementById('chartConformidad'), {
    type: 'pie',
    data: { labels: Object.keys(conformidad), datasets: [{ data: Object.values(conformidad), backgroundColor:['#4caf50','#f44336','#9e9e9e'] }] },
    options: { responsive:true }
  });

  // Vencimientos próximos 30 días (counts per day)
  const vencimientos = {};
  const hoy = new Date();
  for (let i=0;i<30;i++){
    const d = new Date(hoy); d.setDate(hoy.getDate() + i);
    vencimientos[d.toISOString().split('T')[0]] = 0;
  }
  lotes.forEach(l=>{
    if (!l.fecha_caducidad) return;
    const fc = new Date(l.fecha_caducidad);
    const diff = (fc - hoy)/(1000*60*60*24);
    if (diff >= 0 && diff < 30){
      const key = fc.toISOString().split('T')[0];
      if (key in vencimientos) vencimientos[key] += 1;
    }
  });
  new Chart(document.getElementById('chartVencimientos'), {
    type: 'line',
    data: { labels: Object.keys(vencimientos), datasets: [{ label:'Lotes por día', data: Object.values(vencimientos), borderColor:'#d32f2f', backgroundColor:'rgba(211,47,47,0.15)', fill:true }] },
    options: { responsive:true }
  });

  // Top proveedores por cantidad de materias (usar materiaprima_proveedor)
  const provCount = {};
  mprov.forEach(mp=>{
    provCount[mp.id_proveedor] = (provCount[mp.id_proveedor]||0) + 1;
  });
  const provArr = Object.entries(provCount).map(([id,c])=> ({ id, c, nombre: (proveedores.find(p=>p.id_proveedor==id)?.nombre || id) })).sort((a,b)=> b.c - a.c).slice(0,10);
  new Chart(document.getElementById('chartTopProveedores'), {
    type: 'bar',
    data: { labels: provArr.map(x=>x.nombre), datasets: [{ label:'Cantidad MP', data: provArr.map(x=>x.c), backgroundColor:'#8e24aa' }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, indexAxis: 'y' }
  });
}
// ====================== Registro automático de gráficos ======================
window.__graficos = window.__graficos || [];

(function() {
  const OriginalChart = Chart; // guardamos la clase original

  Chart = function(ctx, config) {
    const chartInstance = new OriginalChart(ctx, config);
    window.__graficos.push(chartInstance); // registramos automáticamente
    return chartInstance;
  };

  // Copiamos todas las propiedades estáticas
  Object.keys(OriginalChart).forEach(key => {
    Chart[key] = OriginalChart[key];
  });
})();

// ====================== Función para cargar imagen ======================
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ====================== Generar PDF profesional ======================
async function descargarReportePDF() {
  try {
    console.log("Generando informe PDF...");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    const nombreArchivo = "Informe_Gerente_General.pdf";

    // Esperar un momento para asegurar que los charts estén renderizados
    await new Promise(r => setTimeout(r, 1500));

    // ========= PORTADA =========
    const logo = "logo.png"; // Ruta de tu logo
    const fecha = new Date().toLocaleString();
    const gerente = "Gerente General";

    // Fondo
    doc.setFillColor(245, 247, 250);
    doc.rect(0, 0, 210, 297, "F");

    // Logo
    try {
      const img = await loadImage(logo);
      doc.addImage(img, "PNG", 80, 40, 50, 50);
    } catch (e) {
      console.warn("No se pudo cargar el logo:", e);
    }

    // Título
    doc.setTextColor(30, 58, 138);
    doc.setFontSize(24);
    doc.text("Informe General del Área TI", 105, 110, { align: "center" });
    doc.setFontSize(14);
    doc.setTextColor(80, 80, 80);
    doc.text(`Fecha de generación: ${fecha}`, 105, 130, { align: "center" });
    doc.text(`Responsable: ${gerente}`, 105, 140, { align: "center" });

    doc.addPage();

    // ========= CONTENIDO =========
    const secciones = document.querySelectorAll(".seccion");
    let y = 20;

    for (let i = 0; i < secciones.length; i++) {
      const seccion = secciones[i];
      const titulo = seccion.querySelector("h1, h2, h3")?.innerText || `Sección ${i + 1}`;

      // Título de sección
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(titulo, 10, y);
      y += 8;

      // ================= KPIs =================
      const kpis = seccion.querySelectorAll(".kpi-card");
      if (kpis.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        for (const kpi of kpis) {
          const tituloKpi = kpi.querySelector("h3")?.innerText || "";
          const valorKpi = kpi.querySelector("p")?.innerText || "";
          const desc = kpi.querySelector(".kpi-desc")?.innerText || "";

          doc.text(`• ${tituloKpi}: ${valorKpi}`, 12, y);
          y += 5;
          if (desc) {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`   ${desc}`, 12, y);
            y += 4;
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
          }
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
        }
        y += 6;
      }

      // ================= Gráficos profesionales =================
      const charts = seccion.querySelectorAll("canvas");
      for (const chartCanvas of charts) {
        const chartInstance = Chart.getChart(chartCanvas) ||
                              (window.__graficos && window.__graficos.find(c => c.canvas === chartCanvas));

        if (chartInstance) {
          const imgData = chartInstance.toBase64Image();

          // Tamaño proporcional
          const maxWidth = 170; // ancho máximo en mm
          const maxHeight = 120; // alto máximo en mm
          const canvasWidth = chartCanvas.width;
          const canvasHeight = chartCanvas.height;
          const ratio = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight);
          const imgWidth = canvasWidth * ratio;
          const imgHeight = canvasHeight * ratio;

          // Nueva página si no cabe
          if (y + imgHeight > 270) {
            doc.addPage();
            y = 20;
          }

          // Fondo blanco para resaltar
          doc.setFillColor(255, 255, 255);
          doc.rect(15, y - 2, imgWidth + 10, imgHeight + 4, "F");

          doc.addImage(imgData, "PNG", 20, y, imgWidth, imgHeight);
          y += imgHeight + 12; // separación vertical
        } else {
          console.warn("No se encontró instancia Chart.js para:", chartCanvas);
        }
      }

      // ================= Tablas =================
      const tabla = seccion.querySelector("table");
      if (tabla) {
        const headers = Array.from(tabla.querySelectorAll("thead th")).map(th => th.innerText);
        const cuerpo = Array.from(tabla.querySelectorAll("tbody tr")).map(tr =>
          Array.from(tr.querySelectorAll("td")).map(td => td.innerText)
        );

        if (cuerpo.length > 0) {
          doc.autoTable({
            startY: y,
            head: [headers],
            body: cuerpo,
            theme: "striped",
            headStyles: { fillColor: [30, 58, 138] },
            margin: { left: 10, right: 10 },
            styles: { fontSize: 10 }
          });
          y = doc.lastAutoTable.finalY + 10;
        }
      }

      // Página siguiente para nueva sección
      if (i < secciones.length - 1) {
        doc.addPage();
        y = 20;
      }
    }

    // Guardar PDF
    doc.save(nombreArchivo);
    console.log("Informe PDF generado correctamente.");
  } catch (err) {
    console.error("Error generando PDF:", err);
    alert("No se pudo generar el informe en PDF.");
  }
}

// ================= Función para cargar imágenes =================
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function descargarTrazabilidadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    let y = 10;
    const saltoPagina = 270;

    // ---------------- NOMBRE DEL ARCHIVO ----------------
    const hoy = new Date().toISOString().split("T")[0];
    const nombreArchivo = `reporte_de_trazabilidad_${hoy}.pdf`;
    try {
        // 🔹 Traer todas las OP
        const { data: ops, error: opError } = await supabaseClient.from('orden_produccion').select('*');
        if (opError) throw opError;
        console.log(`OP cargadas: ${ops.length}`);

        // 🔹 Traer relaciones OP → OV
        const { data: opOV, error: opOVError } = await supabaseClient.from('op_ov').select('*');
        if (opOVError) throw opOVError;
        console.log(`Relaciones OP→OV cargadas: ${opOV.length}`);

        // 🔹 Traer OV
        const { data: ordenesVenta, error: ovError } = await supabaseClient.from('orden_ventas').select('*');
        if (ovError) throw ovError;
        console.log(`Órdenes de venta cargadas: ${ordenesVenta.length}`);

        // 🔹 Traer detalle de OV
        const { data: detalleOV, error: detOVError } = await supabaseClient.from('detalle_ordenes').select('*');
        if (detOVError) throw detOVError;
        console.log(`Detalle de OV cargado: ${detalleOV.length}`);

        // 🔹 Traer productos
        const { data: productos, error: prodError } = await supabaseClient.from('productos').select('*');
        if (prodError) throw prodError;
        console.log(`Productos cargados: ${productos.length}`);

        // 🔹 Crear mapas para acceso rápido
        const mapOV = new Map(ordenesVenta.map(o => [Number(o.id_orden), o]));
        const mapDetalleOV = detalleOV.reduce((acc, d) => {
            const key = Number(d.id_orden);
            if (!acc[key]) acc[key] = [];
            acc[key].push(d);
            return acc;
        }, {});
        const mapProductos = new Map(productos.map(p => [Number(p.id_producto), p]));

        // 🔹 Empezar a escribir PDF
        for (let op of ops) {
            doc.setFontSize(14);
            doc.text(`OP N°: ${op.numero_op || op.id_orden_produccion}`, 10, y);
            y += 6;
            doc.setFontSize(11);
            doc.text(`Estado: ${op.estado || 'N/A'}`, 10, y);
            y += 5;

            const producto = mapProductos.get(Number(op.id_producto));
            doc.text(`Producto: ${producto ? producto.nombre : 'N/A'}`, 10, y);
            y += 5;

            doc.text(`Fecha Emisión: ${op.fecha_emision ? new Date(op.fecha_emision).toLocaleDateString() : 'N/A'}`, 10, y);
            y += 5;
            doc.text(`Motivo: ${op.motivo || '-'}`, 10, y);
            y += 6;

            // 🔹 OV asociadas
            const relacionesOV = opOV.filter(r => Number(r.id_op) === Number(op.id_orden_produccion) && (r.id_ov || r.id_detalle_ov));
            if (relacionesOV.length > 0) {
                doc.setFontSize(12);
                doc.text("Órdenes de Venta Relacionadas:", 10, y);
                y += 5;

                relacionesOV.forEach(r => {
                    let ov = null;
                    if (r.id_ov != null) {
                        ov = mapOV.get(Number(r.id_ov));
                    } else if (r.id_detalle_ov != null) {
                        // Buscar detalle de OV para obtener id_orden
                        const detalle = detalleOV.find(d => Number(d.id_detalle) === Number(r.id_detalle_ov));
                        if (detalle) ov = mapOV.get(Number(detalle.id_orden));
                    }
                    if (ov) {
                        doc.setFontSize(10);
                        doc.text(`- OV ID: ${ov.id_orden}, Cliente ID: ${ov.id_cliente}, Estado: ${ov.estado}`, 12, y);
                        y += 5;

                        // Productos de esa OV
                        const detalles = mapDetalleOV[Number(ov.id_orden)] || [];
                        detalles.forEach(d => {
                            const prodOV = mapProductos.get(Number(d.id_producto));
                            doc.setFontSize(9);
                            doc.text(`   * Producto: ${prodOV ? prodOV.nombre : 'N/A'}, Cantidad: ${d.cantidad}`, 14, y);
                            y += 4;
                            if (y > saltoPagina) { doc.addPage(); y = 10; }
                        });
                        if (y > saltoPagina) { doc.addPage(); y = 10; }
                    }
                });
            } else {
                doc.setFontSize(10);
                doc.text("Órdenes de Venta Relacionadas: Ninguna", 10, y);
                y += 5;
            }

            y += 5;
            doc.setDrawColor(0);
            doc.line(10, y, 200, y);
            y += 5;
            if (y > saltoPagina) { doc.addPage(); y = 10; }

            console.log(`OP ${op.numero_op || op.id_orden_produccion} procesada`);
        }

        doc.save(nombreArchivo);
        console.log("PDF generado correctamente");

    } catch (error) {
        console.error("Error generando PDF de trazabilidad:", error);
        alert("Ocurrió un error al generar el PDF. Revisa la consola.");
    }
}
/* ================ Inicializar ================ */
document.addEventListener('DOMContentLoaded', async ()=> {
  await cargarProduccionYProveedores();
});
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
