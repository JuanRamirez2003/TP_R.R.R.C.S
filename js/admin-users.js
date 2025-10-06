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

// ================== MODAL ==================
function abrirModal(usuario) {
  document.getElementById('editarId').value = usuario.id;
  document.getElementById('editarDni').value = usuario.dni || "";
  document.getElementById('editarNombre').value = usuario.name || "";
  document.getElementById('editarTipo').value = usuario.estado || "Activo";
  document.getElementById('editarArea').value = usuario.area || "";

  document.getElementById('modalEditar').style.display = 'flex';
}

function cerrarModal() {
  document.getElementById('modalEditar').style.display = 'none';
}
const messageBox = document.getElementById('messageBox');

function showMessage(text, type = "info") {
    messageBox.textContent = text;

    // Cambiar colores según tipo
    switch(type) {
        case "success": messageBox.style.background = "green"; break;
        case "error": messageBox.style.background = "red"; break;
        case "warning": messageBox.style.background = "orange"; break;
        default: messageBox.style.background = "blue";
    }

    messageBox.style.display = "block";
    messageBox.style.opacity = 1;

    setTimeout(() => {
        messageBox.style.opacity = 0;
        setTimeout(() => messageBox.style.display = "none", 500);
    }, 3000);
}

// ================== EDITAR USUARIO (abre modal) ==================
async function editarUsuario(e) {
  try {
    const tr = e.target.closest('tr');
    const id = tr.dataset.id;

    let { data: usuario, error } = await supabaseClient
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !usuario) return alert('No se encontró el usuario');

    abrirModal(usuario);
  } catch (err) {
    console.error('Error al abrir modal:', err);
    alert('Ocurrió un error al abrir el modal.');
  }
}

async function guardarEdicion() {
  const mensajeModal = document.getElementById('mensajeModal');
  mensajeModal.textContent = '';
  try {
    const id = document.getElementById('editarId').value;
    const dni = document.getElementById('editarDni').value.trim();
    const name = document.getElementById('editarNombre').value.trim();
    const estado = document.getElementById('editarTipo').value;
    const area = document.getElementById('editarArea').value;

    if (!dni || !name || !estado || !area) {
      mensajeModal.textContent = 'Todos los campos son obligatorios';
      return;
    }

    if (!/^\d{7,8}$/.test(dni)) {
      mensajeModal.textContent = 'El DNI debe contener solo números y tener 7 u 8 dígitos';
      return;
    }

    const areasValidas = ["Ventas","Recursos Humanos","TI","Operario","Supervisor","Gerente General"];
    if (!areasValidas.includes(area)) {
      mensajeModal.textContent = 'Área de trabajo inválida';
      return;
    }

    const { data: usuariosConDni, error: errorDni } = await supabaseClient
      .from('usuarios').select('id').eq('dni', dni);

    if (errorDni) {
      mensajeModal.textContent = 'Error al verificar DNI';
      return;
    }

    if (usuariosConDni.some(u => u.id != id)) {
      mensajeModal.textContent = 'El DNI ya pertenece a otro usuario';
      return;
    }

    const { error } = await supabaseClient
      .from('usuarios').update({ dni, name, estado, area }).eq('id', id);

    if (error) {
      mensajeModal.textContent = 'Error al actualizar usuario';
      return;
    }

    mensajeModal.style.color = 'green';
    mensajeModal.textContent = 'Usuario actualizado correctamente';
    setTimeout(() => {
        cerrarModal();
        cargarUsuarios();
        mensajeModal.textContent = '';
    }, 1500);

  } catch (err) {
    mensajeModal.textContent = 'Error inesperado';
    console.error(err);
  }
}
// ================== CARGAR USUARIOS ==================
async function cargarUsuarios() {
  try {
    const usuariosDemo = [
      { id: 1, dni: '12345678', name: 'Juan Perez', estado: 'Activo', area: 'Producción', created_at: '2025-01-01' },
      { id: 2, dni: '87654321', name: 'Ana Gómez', estado: 'Inactivo', area: 'Ventas', created_at: '2025-01-05' }
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
      tr.dataset.id = u.id;
      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.dni}</td>
        <td>${u.name}</td>
        <td>${u.estado}</td>
        <td>${u.area}</td>
        <td>${u.created_at}</td>
        <td>
          <button class="btn-edit">Editar</button>
          <button class="btn-delete">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error al cargar usuarios:', err);
    alert('Ocurrió un error al cargar los usuarios.');
  }
}

// ================== CARGAR ACCESOS ==================
async function cargarAccesos() {
  try {
    const accesosDemo = [
      { id: 1, usuario: { name: 'Juan Perez' }, accion: 'Ingreso al sistema', fecha_hora: '2025-09-28 10:00' },
      { id: 2, usuario: { name: 'Ana Gómez' }, accion: 'Cierre de sesión', fecha_hora: '2025-09-28 10:30' }
    ];

    let { data, error } = await supabaseClient
      .from('accesos')
      .select('id, accion, fecha_hora, usuario:usuarios(name)');

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
        <td>${a.usuario ? a.usuario.name : 'Desconocido'}</td>
        <td>${a.accion}</td>
        <td>${a.fecha_hora}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error al cargar accesos:', err);
    alert('Ocurrió un error al cargar los accesos.');
  }
}

async function eliminarUsuario(e) {
  const tr = e.target.closest('tr');
  const id = tr.dataset.id;

  // Confirmación opcional con HTML en lugar de confirm()
  if (!id) return;

  try {
    const { error } = await supabaseClient.from('usuarios').delete().eq('id', id);
    if (error) {
      showMessage('Error al eliminar usuario', 'error');
      return;
    }
    showMessage('Usuario eliminado correctamente', 'success');
    cargarUsuarios();
  } catch (err) {
    console.error(err);
    showMessage('Ocurrió un error inesperado', 'error');
  }
}


// ================== EVENT DELEGATION ==================
document.querySelector('#tablaUsuarios tbody').addEventListener('click', function(e) {
  if (e.target.classList.contains('btn-edit')) {
    editarUsuario(e);
  } else if (e.target.classList.contains('btn-delete')) {
    eliminarUsuario(e);
  }
});
// ================== FILTRADO UNIVERSAL ==================
function filtrarTabla(inputId, tablaId) {
  const filtro = document.getElementById(inputId).value.toLowerCase();
  const filas = document.querySelectorAll(`#${tablaId} tbody tr`);

  filas.forEach(tr => {
    let textoFila = '';
    Array.from(tr.children).forEach(td => {
      textoFila += td.textContent.toLowerCase() + ' ';
    });

    tr.style.display = textoFila.includes(filtro) ? '' : 'none';
  });
}

// Event listeners de los inputs
document.getElementById('filtroUsuarios').addEventListener('input', () => filtrarTabla('filtroUsuarios', 'tablaUsuarios'));
document.getElementById('filtroAccesos').addEventListener('input', () => filtrarTabla('filtroAccesos', 'tablaAccesos'));

// ================== INICIALIZACIÓN ==================
document.addEventListener('DOMContentLoaded', () => {
  cargarUsuarios();
  cargarAccesos();
  mostrarSeccion('usuarios');
});
