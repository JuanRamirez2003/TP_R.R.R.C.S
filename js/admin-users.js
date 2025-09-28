console.log("Iniciando Panel de Admin...");

// ================== Supabase ==================
const supabaseUrl = "https://ldgrlfnmuvvaqsezjsvj.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkZ3JsZm5tdXZ2YXFzZXpqc3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MzEwNDMsImV4cCI6MjA3NDUwNzA0M30.NrUTqCLkzMWUGqn2XIAsCY8H90vgHpuxhMT2zIVt3Zo";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ================== FUNCIONES ==================

// Mostrar sección
function mostrarSeccion(seccionId) {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
  const seccion = document.getElementById(seccionId);
  if (seccion) seccion.style.display = 'block';
}

// Cargar usuarios
async function cargarUsuarios() {
  const usuariosDemo = [
    { id: 1, dni: '12345678', full_name: 'Juan Perez', tipo: 'Admin', area: 'Producción', created_at: '2025-01-01' },
    { id: 2, dni: '87654321', full_name: 'Ana Gómez', tipo: 'Usuario', area: 'Ventas', created_at: '2025-01-05' }
  ];

  let { data, error } = await supabaseClient.from('usuarios').select('*');
  if (error || !data || data.length === 0) {
    console.warn('Usando datos de prueba para usuarios');
    data = usuariosDemo;
  }

  const tbody = document.querySelector('#tablaUsuarios tbody');
  tbody.innerHTML = '';

  data.forEach(u => {
    const tr = document.createElement('tr');
    tr.dataset.id = u.id; // importante para editar/eliminar
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.dni}</td>
      <td>${u.name}</td>
      <td>${u.tipo}</td>
      <td>${u.area}</td>
      <td>${u.created_at}</td>
      <td>
        <button class="btn-edit">Editar</button>
        <button class="btn-delete">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Cargar accesos
async function cargarAccesos() {
  const accesosDemo = [
    { id: 1, usuario_id: 1, tipo: 'Login', accion: 'Ingreso al sistema', fecha_hora: '2025-09-28 10:00' },
    { id: 2, usuario_id: 2, tipo: 'Logout', accion: 'Cierre de sesión', fecha_hora: '2025-09-28 10:30' }
  ];

  let { data, error } = await supabaseClient.from('accesos').select('*');
  if (error || !data || data.length === 0) {
    console.warn('Usando datos de prueba para accesos');
    data = accesosDemo;
  }

  const tbody = document.querySelector('#tablaAccesos tbody');
  tbody.innerHTML = '';
  data.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${a.usuario_id}</td>
      <td>${a.tipo}</td>
      <td>${a.accion}</td>
      <td>${a.fecha_hora}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ================== FUNCIONES DE EDICIÓN ==================
async function editarUsuario(e) {
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;

  // Obtener usuario
  let { data: usuario, error } = await supabaseClient.from('usuarios').select('*').eq('id', id).single();
  if (error || !usuario) return alert('No se encontró el usuario');

  // Pedir nuevos valores (puedes reemplazar con modal)
  const nuevoNombre = prompt('Nombre:', usuario.name);  // usar 'name'
  const nuevoDNI = prompt('DNI:', usuario.dni);
  const nuevoTipo = prompt('Tipo:', usuario.tipo);
  const nuevaArea = prompt('Área:', usuario.area);

  if (!nuevoNombre || !nuevoDNI || !nuevoTipo || !nuevaArea) return;

  const { error: errUpdate } = await supabaseClient
    .from('usuarios')
    .update({ name: nuevoNombre, dni: nuevoDNI, tipo: nuevoTipo, area: nuevaArea }) // usar 'name'
    .eq('id', id);

  if (errUpdate) return alert('Error al actualizar usuario: ' + errUpdate.message);

  alert('Usuario actualizado');
  cargarUsuarios();
}

// ================== FUNCIONES DE ELIMINAR ==================
async function eliminarUsuario(e) {
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;

  if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;

  const { error } = await supabaseClient.from('usuarios').delete().eq('id', id);
  if (error) return alert('Error al eliminar usuario: ' + error.message);

  alert('Usuario eliminado');
  cargarUsuarios();
}

// ================== EVENT DELEGATION ==================
document.querySelector('#tablaUsuarios tbody').addEventListener('click', function(e) {
  if (e.target.classList.contains('btn-edit')) {
    editarUsuario(e);
  } else if (e.target.classList.contains('btn-delete')) {
    eliminarUsuario(e);
  }
});

// ================== INICIALIZACIÓN ==================
document.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();
  cargarAccesos();
  mostrarSeccion('usuarios');
});
