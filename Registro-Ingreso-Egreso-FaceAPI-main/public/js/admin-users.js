// ===================== FUNCIONES GENERALES =====================
function mostrarSeccion(seccionId) {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
  document.getElementById(seccionId).style.display = 'block';

  if (seccionId === 'usuarios') listarUsuarios();
  if (seccionId === 'accesos') listarAccesos();
}

function volverPanel() {
  document.querySelectorAll('.seccion').forEach(sec => sec.style.display = 'none');
}

// ===================== USUARIOS =====================
async function listarUsuarios() {
  const { data, error } = await supabaseClient
    .from('usuarios')
    .select('*')
    .order('id', { ascending: true });
  if (error) return console.error(error);

  const tbody = document.querySelector('#tablaUsuarios tbody');
  tbody.innerHTML = '';

  data.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.id ?? ''}</td>
      <td>${user.codigo_operario ?? ''}</td>
      <td>${user.DNI ?? ''}</td>
      <td>${user.nombre ?? ''}</td>
      <td>${user.area ?? ''}</td>
      <td>${user.creado_en ? new Date(user.creado_en).toLocaleString() : ''}</td>
      <td>
        <button onclick="editarUsuario(${user.id})" class="btn-submit">✏️ Editar</button>
        <button onclick="borrarUsuario(${user.id})" class="btn-submit" style="background-color:#e74c3c;">❌ Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Editar usuario usando prompts (cuestionario)
async function editarUsuario(id) {
  const { data, error } = await supabaseClient.from('usuarios').select('*').eq('id', id).single();
  if (error) return console.error(error);
  if (!data) return alert('Usuario no encontrado');

  const codigo_operario = prompt("Código de Operario:", data.codigo_operario ?? '') ?? data.codigo_operario;
  const DNI = prompt("DNI:", data.DNI ?? '') ?? data.DNI;
  const nombre = prompt("Nombre:", data.nombre ?? '') ?? data.nombre;
  const area = prompt("Área:", data.area ?? '') ?? data.area;

  const { error: updateError } = await supabaseClient
    .from('usuarios')
    .update({ codigo_operario, DNI, nombre, area })
    .eq('id', id);
  if (updateError) return console.error(updateError);

  alert(`Usuario "${nombre}" actualizado correctamente.`);
  listarUsuarios();
}

// Borrar usuario
async function borrarUsuario(id) {
  if (!confirm('¿Desea borrar este usuario?')) return;
  const { error } = await supabaseClient.from('usuarios').delete().eq('id', id);
  if (error) return console.error(error);
  listarUsuarios();
}

// ===================== ACCESOS =====================
async function listarAccesos() {
  const { data, error } = await supabaseClient.from('accesos').select('*').order('id', { ascending: true });
  if (error) return console.error(error);

  const tbody = document.querySelector('#tablaAccesos tbody');
  tbody.innerHTML = '';

  data.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.id ?? ''}</td>
      <td>${a.usuario ?? ''}</td>
      <td>${a.tabla ?? ''}</td>
      <td>${a.permiso ?? ''}</td>
      <td>${a.fecha_ultimo_acceso ? new Date(a.fecha_ultimo_acceso).toLocaleString() : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===================== INICIALIZACIÓN =====================
mostrarSeccion('usuarios');
listarUsuarios();
