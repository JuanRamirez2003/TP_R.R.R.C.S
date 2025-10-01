// supervisor.js

// =============================
// Manejo de Secciones SPA
// =============================
function mostrarSeccion(id) {
  document.querySelectorAll(".seccion").forEach(sec => sec.classList.remove("activa"));
  document.getElementById(id).classList.add("activa");
}

// =============================
// LocalStorage helpers
// =============================
function guardarDatos(clave, datos) {
  localStorage.setItem(clave, JSON.stringify(datos));
}

function cargarDatos(clave) {
  return JSON.parse(localStorage.getItem(clave)) || [];
}

// =============================
// Stock de Materias Primas
// =============================
let stock = cargarDatos("stock");

function renderStock() {
  const tbody = document.querySelector("#tablaStock tbody");
  tbody.innerHTML = "";
  stock.forEach(mp => {
    let estado = "";
    if (mp.cantidad > mp.maximo) estado = `<span class='estado-ok'>Suficiente</span>`;
    else if (mp.cantidad <= mp.minimo && mp.cantidad > 0) estado = `<span class='estado-bajo'>Bajo</span>`;
    else if (mp.cantidad === 0) estado = `<span class='estado-critico'>Crítico</span>`;
    else estado = `<span class='estado-ok'>Normal</span>`;

    tbody.innerHTML += `
      <tr>
        <td>${mp.nombre}</td>
        <td>${mp.cantidad}</td>
        <td>${mp.minimo}</td>
        <td>${mp.maximo}</td>
        <td>${estado}</td>
      </tr>`;
  });
}

function cargarEjemplo() {
  stock = [
    { nombre: "Harina 000", cantidad: 50, minimo: 20, maximo: 100 },
    { nombre: "Azúcar", cantidad: 10, minimo: 15, maximo: 80 },
    { nombre: "Envases Plásticos", cantidad: 0, minimo: 50, maximo: 200 }
  ];
  guardarDatos("stock", stock);
  renderStock();
}

function borrarDatos() {
  localStorage.clear();
  stock = [];
  renderStock();
  renderRequerimientos();
  renderRecepciones();
  renderIncidencias();
}

// =============================
// Requerimientos
// =============================
let requerimientos = cargarDatos("requerimientos");

const formRequerimiento = document.getElementById("formRequerimiento");
formRequerimiento?.addEventListener("submit", e => {
  e.preventDefault();
  const req = {
    id: Date.now(),
    materia: document.getElementById("reqMateria").value,
    cantidad: parseInt(document.getElementById("reqCantidad").value),
    justificacion: document.getElementById("reqJustificacion").value,
    estado: "Pendiente" // siempre pendiente hasta revisión del gerente
  };
  requerimientos.push(req);
  guardarDatos("requerimientos", requerimientos);
  renderRequerimientos();
  formRequerimiento.reset();
});

function renderRequerimientos() {
  const tbody = document.querySelector("#tablaRequerimientos tbody");
  tbody.innerHTML = "";
  requerimientos.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.id}</td>
        <td>${r.materia}</td>
        <td>${r.cantidad}</td>
        <td>${r.justificacion}</td>
        <td>${r.estado}</td>
        <td>
          <button onclick="editarRequerimiento(${r.id})">Editar</button>
          <button onclick="eliminarRequerimiento(${r.id})">Eliminar</button>
        </td>
      </tr>`;
  });
}

function editarRequerimiento(id) {
  const req = requerimientos.find(r => r.id === id);
  if (!req || req.estado !== 'Pendiente') { alert('No se puede editar requerimiento ya revisado'); return; }
  const nuevaMateria = prompt('Materia Prima:', req.materia);
  const nuevaCantidad = prompt('Cantidad:', req.cantidad);
  const nuevaJustificacion = prompt('Justificación:', req.justificacion);
  if (nuevaMateria && nuevaCantidad && nuevaJustificacion) {
    req.materia = nuevaMateria;
    req.cantidad = parseInt(nuevaCantidad);
    req.justificacion = nuevaJustificacion;
    guardarDatos('requerimientos', requerimientos);
    renderRequerimientos();
  }
}

function eliminarRequerimiento(id) {
  const req = requerimientos.find(r => r.id === id);
  if (!req || req.estado !== 'Pendiente') { alert('No se puede eliminar requerimiento ya revisado'); return; }
  requerimientos = requerimientos.filter(r => r.id !== id);
  guardarDatos('requerimientos', requerimientos);
  renderRequerimientos();
}

// =============================
// Recepción de Materiales
// =============================
let recepciones = cargarDatos("recepciones");

const formRecepcion = document.getElementById("formRecepcion");
formRecepcion?.addEventListener("submit", e => {
  e.preventDefault();
  const rec = {
    orden: document.getElementById("recOrden").value,
    materia: document.getElementById("recMateria").value,
    cantidad: parseInt(document.getElementById("recCantidad").value),
    vencimiento: document.getElementById("recVencimiento").value,
    calidad: document.getElementById("recCalidad").value,
    obs: document.getElementById("recObs").value
  };
  recepciones.push(rec);
  guardarDatos("recepciones", recepciones);

  // Actualizar stock si existe esa materia
  const mp = stock.find(s => s.nombre === rec.materia);
  if (mp) mp.cantidad += rec.cantidad;
  else stock.push({ nombre: rec.materia, cantidad: rec.cantidad, minimo: 10, maximo: 100 });
  guardarDatos("stock", stock);
  renderStock();

  renderRecepciones();
  formRecepcion.reset();
});

function renderRecepciones() {
  const tbody = document.querySelector("#tablaRecepcion tbody");
  tbody.innerHTML = "";
  recepciones.forEach(r => {
    tbody.innerHTML += `
      <tr>
        <td>${r.orden}</td>
        <td>${r.materia}</td>
        <td>${r.cantidad}</td>
        <td>${r.vencimiento}</td>
        <td>${r.calidad}</td>
        <td>${r.obs}</td>
      </tr>`;
  });
}

// =============================
// Incidencias
// =============================
let incidencias = cargarDatos("incidencias");

const formIncidencia = document.getElementById("formIncidencia");
formIncidencia?.addEventListener("submit", e => {
  e.preventDefault();
  const inc = {
    materia: document.getElementById("incMateria").value,
    tipo: document.getElementById("incTipo").value,
    obs: document.getElementById("incObs").value
  };
  incidencias.push(inc);
  guardarDatos("incidencias", incidencias);
  renderIncidencias();
  formIncidencia.reset();
});

function renderIncidencias() {
  const tbody = document.querySelector("#tablaIncidencias tbody");
  tbody.innerHTML = "";
  incidencias.forEach(i => {
    tbody.innerHTML += `
      <tr>
        <td>${i.materia}</td>
        <td>${i.tipo}</td>
        <td>${i.obs}</td>
      </tr>`;
  });
}

// =============================
// Inicialización
// =============================
renderStock();
renderRequerimientos();
renderRecepciones();
renderIncidencias();