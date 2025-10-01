// gerente.js

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
// Requerimientos
// =============================
let requerimientos = cargarDatos("requerimientos");

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
        <td class="${r.estado === 'Aprobado' ? 'estado-aprobado' : r.estado === 'Rechazado' ? 'estado-rechazado' : 'estado-pendiente'}">${r.estado}</td>
        <td>
          <button onclick="aprobar(${r.id})">Aprobar</button>
          <button onclick="rechazar(${r.id})">Rechazar</button>
        </td>
      </tr>`;
  });
}

function aprobar(id) {
  requerimientos = requerimientos.map(r => r.id === id ? { ...r, estado: 'Aprobado' } : r);
  guardarDatos("requerimientos", requerimientos);
  renderRequerimientos();
}

function rechazar(id) {
  requerimientos = requerimientos.map(r => r.id === id ? { ...r, estado: 'Rechazado' } : r);
  guardarDatos("requerimientos", requerimientos);
  renderRequerimientos();
}

// =============================
// Órdenes de Compra
// =============================
let ordenes = cargarDatos("ordenes");

const formOrden = document.getElementById("formOrden");
formOrden?.addEventListener("submit", e => {
  e.preventDefault();
  const idRequerimiento = parseInt(document.getElementById("ordenRequerimiento").value);
  const req = requerimientos.find(r => r.id === idRequerimiento && r.estado === 'Aprobado');
  if (!req) { alert("Requerimiento no encontrado o no aprobado"); return; }

  const orden = {
    id_orden: Date.now(),
    id_requerimiento: idRequerimiento,
    proveedor: document.getElementById("ordenProveedor").value,
    items: [{ ...req, subtotal: req.cantidad * 10 }], // ejemplo precio fijo
    total: req.cantidad * 10,
    condiciones_pago: document.getElementById("ordenPago").value,
    estado: 'Pendiente'
  };
  ordenes.push(orden);
  guardarDatos("ordenes", ordenes);
  renderOrdenes();
  formOrden.reset();
});

function renderOrdenes() {
  const tbody = document.querySelector("#tablaOrdenes tbody");
  tbody.innerHTML = "";
  ordenes.forEach(o => {
    tbody.innerHTML += `
      <tr>
        <td>${o.id_orden}</td>
        <td>${o.id_requerimiento}</td>
        <td>${o.proveedor}</td>
        <td>${o.total}</td>
        <td>${o.estado}</td>
      </tr>`;
  });
}

// =============================
// Proveedores
// =============================
let proveedores = cargarDatos("proveedores");

const formProveedor = document.getElementById("formProveedor");
formProveedor?.addEventListener("submit", e => {
  e.preventDefault();
  const prov = {
    nombre: document.getElementById("provNombre").value,
    contacto: document.getElementById("provContacto").value,
    condiciones: document.getElementById("provCondiciones").value
  };
  proveedores.push(prov);
  guardarDatos("proveedores", proveedores);
  renderProveedores();
  formProveedor.reset();
});

function renderProveedores() {
  const tbody = document.querySelector("#tablaProveedores tbody");
  tbody.innerHTML = "";
  proveedores.forEach(p => {
    tbody.innerHTML += `<tr>
      <td>${p.nombre}</td>
      <td>${p.contacto}</td>
      <td>${p.condiciones}</td>
    </tr>`;
  });
}

// =============================
// Incidencias
// =============================
let incidencias = cargarDatos("incidencias");

function renderIncidencias() {
  const tbody = document.querySelector("#tablaIncidencias tbody");
  tbody.innerHTML = "";
  incidencias.forEach(i => {
    tbody.innerHTML += `<tr>
      <td>${i.id_orden}</td>
      <td>${i.tipo}</td>
      <td>${i.obs}</td>
    </tr>`;
  });
}

// =============================
// Inicialización
// =============================
renderRequerimientos();
renderOrdenes();
renderProveedores();
renderIncidencias();
